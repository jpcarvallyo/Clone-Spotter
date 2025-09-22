package core

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/sha512"
	"fmt"
	"hash"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sync"
)

// HashAlgorithm represents the supported hash algorithms
type HashAlgorithm string

const (
	MD5    HashAlgorithm = "md5"
	SHA1   HashAlgorithm = "sha1"
	SHA256 HashAlgorithm = "sha256"
	SHA512 HashAlgorithm = "sha512"
)

// DefaultExcludedDirs are the default directories to exclude from scanning
var DefaultExcludedDirs = []string{
	"node_modules",
	".git",
	".DS_Store",
	"dist",
	"build",
}

// Duplicate represents a duplicate file pair
type Duplicate struct {
	Original  string `json:"original"`
	Duplicate string `json:"duplicate"`
}

// DuplicateStats contains statistics about found duplicates
type DuplicateStats struct {
	TotalDuplicates     int                    `json:"totalDuplicates"`
	UniqueOriginals     int                    `json:"uniqueOriginals"`
	TotalDuplicateFiles int                    `json:"totalDuplicateFiles"`
	DuplicateGroups     map[string][]string    `json:"duplicateGroups"`
}

// FileHash represents a file with its hash
type FileHash struct {
	Path string
	Hash string
}

// DuplicateFinder handles the duplicate detection logic
type DuplicateFinder struct {
	algorithm     HashAlgorithm
	excludedDirs  []string
	excludedRegex *regexp.Regexp
	fileHashes    map[string]string
	duplicates    []Duplicate
	mu            sync.RWMutex
}

// NewDuplicateFinder creates a new DuplicateFinder instance
func NewDuplicateFinder(algorithm HashAlgorithm, excludedDirs []string) *DuplicateFinder {
	df := &DuplicateFinder{
		algorithm:    algorithm,
		excludedDirs: excludedDirs,
		fileHashes:   make(map[string]string),
		duplicates:   make([]Duplicate, 0),
	}

	// Create regex for excluded directories
	if len(excludedDirs) > 0 {
		pattern := ""
		for i, dir := range excludedDirs {
			if i > 0 {
				pattern += "|"
			}
			pattern += regexp.QuoteMeta(dir)
		}
		df.excludedRegex = regexp.MustCompile(pattern)
	}

	return df
}

// getHashAlgorithm returns the appropriate hash.Hash for the given algorithm
func (df *DuplicateFinder) getHashAlgorithm() hash.Hash {
	switch df.algorithm {
	case MD5:
		return md5.New()
	case SHA1:
		return sha1.New()
	case SHA256:
		return sha256.New()
	case SHA512:
		return sha512.New()
	default:
		return md5.New() // Default to MD5
	}
}

// calculateFileHash calculates the hash of a file
func (df *DuplicateFinder) calculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer file.Close()

	hash := df.getHashAlgorithm()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("failed to read file %s: %w", filePath, err)
	}

	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// isExcluded checks if a path should be excluded from scanning
func (df *DuplicateFinder) isExcluded(path string) bool {
	if df.excludedRegex == nil {
		return false
	}
	return df.excludedRegex.MatchString(path)
}

// processFile processes a single file and checks for duplicates
func (df *DuplicateFinder) processFile(filePath string) error {
	hash, err := df.calculateFileHash(filePath)
	if err != nil {
		return err
	}

	df.mu.Lock()
	defer df.mu.Unlock()

	if originalPath, exists := df.fileHashes[hash]; exists {
		df.duplicates = append(df.duplicates, Duplicate{
			Original:  originalPath,
			Duplicate: filePath,
		})
	} else {
		df.fileHashes[hash] = filePath
	}

	return nil
}

// processDirectory recursively processes a directory
func (df *DuplicateFinder) processDirectory(dirPath string, progressChan chan<- int) error {
	entries, err := os.ReadDir(dirPath)
	if err != nil {
		return fmt.Errorf("failed to read directory %s: %w", dirPath, err)
	}

	for _, entry := range entries {
		fullPath := filepath.Join(dirPath, entry.Name())

		if entry.IsDir() {
			if !df.isExcluded(fullPath) {
				if err := df.processDirectory(fullPath, progressChan); err != nil {
					// Log warning but continue processing
					fmt.Fprintf(os.Stderr, "Warning: %v\n", err)
				}
			}
		} else if !entry.IsDir() {
			if err := df.processFile(fullPath); err != nil {
				// Log warning but continue processing
				fmt.Fprintf(os.Stderr, "Warning: %v\n", err)
			}
			progressChan <- 1
		}
	}

	return nil
}

// SearchDuplicates finds duplicate files in the specified directory
func (df *DuplicateFinder) SearchDuplicates(rootDir string, progressChan chan<- int) ([]Duplicate, error) {
	// Verify root directory exists
	if _, err := os.Stat(rootDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("directory does not exist: %s", rootDir)
	}

	// Reset state
	df.fileHashes = make(map[string]string)
	df.duplicates = make([]Duplicate, 0)

	// Process directory
	if err := df.processDirectory(rootDir, progressChan); err != nil {
		return nil, err
	}

	return df.duplicates, nil
}

// GatherDuplicates groups duplicate files by their original file path
func GatherDuplicates(duplicates []Duplicate) map[string][]string {
	duplicateMap := make(map[string][]string)

	for _, dup := range duplicates {
		if _, exists := duplicateMap[dup.Original]; !exists {
			duplicateMap[dup.Original] = make([]string, 0)
		}
		duplicateMap[dup.Original] = append(duplicateMap[dup.Original], dup.Duplicate)
	}

	return duplicateMap
}

// GetDuplicateStats generates statistics about found duplicates
func GetDuplicateStats(duplicates []Duplicate) DuplicateStats {
	duplicateGroups := GatherDuplicates(duplicates)
	
	// Count unique originals
	uniqueOriginals := len(duplicateGroups)
	
	// Count total duplicate files (originals + duplicates)
	totalDuplicateFiles := len(duplicates) + uniqueOriginals

	return DuplicateStats{
		TotalDuplicates:     len(duplicates),
		UniqueOriginals:     uniqueOriginals,
		TotalDuplicateFiles: totalDuplicateFiles,
		DuplicateGroups:     duplicateGroups,
	}
}

// ValidateDirectory checks if a directory exists and is accessible
func ValidateDirectory(dirPath string) bool {
	info, err := os.Stat(dirPath)
	return err == nil && info.IsDir()
}

// GetSupportedAlgorithms returns the list of supported hash algorithms
func GetSupportedAlgorithms() []HashAlgorithm {
	return []HashAlgorithm{MD5, SHA1, SHA256, SHA512}
}

// IsValidAlgorithm checks if the given algorithm is supported
func IsValidAlgorithm(algorithm string) bool {
	algo := HashAlgorithm(algorithm)
	for _, supported := range GetSupportedAlgorithms() {
		if algo == supported {
			return true
		}
	}
	return false
}
