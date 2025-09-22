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

// ConcurrentDuplicateFinder handles concurrent duplicate detection
type ConcurrentDuplicateFinder struct {
	algorithm     HashAlgorithm
	excludedDirs  []string
	excludedRegex *regexp.Regexp
	fileHashes    map[string]string
	duplicates    []Duplicate
	mu            sync.RWMutex
	workerCount   int
}

// NewConcurrentDuplicateFinder creates a new concurrent duplicate finder
func NewConcurrentDuplicateFinder(algorithm HashAlgorithm, excludedDirs []string, workerCount int) *ConcurrentDuplicateFinder {
	if workerCount <= 0 {
		workerCount = 4 // Default to 4 workers
	}

	df := &ConcurrentDuplicateFinder{
		algorithm:    algorithm,
		excludedDirs: excludedDirs,
		fileHashes:   make(map[string]string),
		duplicates:   make([]Duplicate, 0),
		workerCount:  workerCount,
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

// isExcluded checks if a path should be excluded from scanning
func (df *ConcurrentDuplicateFinder) isExcluded(path string) bool {
	if df.excludedRegex == nil {
		return false
	}
	return df.excludedRegex.MatchString(path)
}

// processFile processes a single file and checks for duplicates
func (df *ConcurrentDuplicateFinder) processFile(filePath string) error {
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

// collectFiles recursively collects all files to process
func (df *ConcurrentDuplicateFinder) collectFiles(rootDir string) ([]string, error) {
	var files []string
	
	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Log warning but continue
			fmt.Fprintf(os.Stderr, "Warning: %v\n", err)
			return nil
		}
		
		if info.IsDir() && df.isExcluded(path) {
			return filepath.SkipDir
		}
		
		if !info.IsDir() {
			files = append(files, path)
		}
		
		return nil
	})
	
	return files, err
}

// SearchDuplicatesConcurrent finds duplicate files using concurrent processing
func (df *ConcurrentDuplicateFinder) SearchDuplicatesConcurrent(rootDir string, progressChan chan<- int) ([]Duplicate, error) {
	// Verify root directory exists
	if _, err := os.Stat(rootDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("directory does not exist: %s", rootDir)
	}

	// Reset state
	df.fileHashes = make(map[string]string)
	df.duplicates = make([]Duplicate, 0)

	// Collect all files first
	files, err := df.collectFiles(rootDir)
	if err != nil {
		return nil, fmt.Errorf("failed to collect files: %w", err)
	}

	// Create channels for work distribution
	fileChan := make(chan string, len(files))
	resultChan := make(chan error, len(files))

	// Start workers
	var wg sync.WaitGroup
	for i := 0; i < df.workerCount; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for filePath := range fileChan {
				if err := df.processFile(filePath); err != nil {
					// Log warning but continue
					fmt.Fprintf(os.Stderr, "Warning: %v\n", err)
				}
				resultChan <- nil
				if progressChan != nil {
					progressChan <- 1
				}
			}
		}()
	}

	// Send files to workers
	go func() {
		for _, file := range files {
			fileChan <- file
		}
		close(fileChan)
	}()

	// Wait for all workers to complete
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	for range resultChan {
		// Results are handled by workers
	}

	return df.duplicates, nil
}

// calculateFileHash calculates the hash of a file (same as DuplicateFinder)
func (df *ConcurrentDuplicateFinder) calculateFileHash(filePath string) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer file.Close()

	hash := df.getHashAlgorithm()
	if _, err := io.Copy(hash, file); err != nil {
		return "", fmt.Errorf("failed to read file %s: %w", err)
	}

	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// getHashAlgorithm returns the appropriate hash.Hash for the given algorithm
func (df *ConcurrentDuplicateFinder) getHashAlgorithm() hash.Hash {
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
