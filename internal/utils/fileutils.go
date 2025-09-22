package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// CleanDirPath expands ~ to the user's home directory
func CleanDirPath(path string) string {
	if strings.Contains(path, "~") {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			// Fallback to current directory if home directory can't be determined
			return path
		}
		return strings.Replace(path, "~", homeDir, 1)
	}
	return path
}

// MassagePath creates a proper output file path
func MassagePath(outputDir, filename string) string {
	// Remove trailing slash from output directory
	outputDir = strings.TrimSuffix(outputDir, "/")
	
	// Add .json extension if not present
	if !strings.HasSuffix(filename, ".json") {
		filename += ".json"
	}
	
	return filepath.Join(outputDir, filename)
}

// EnsureDirExists creates a directory if it doesn't exist
func EnsureDirExists(dirPath string) error {
	return os.MkdirAll(dirPath, 0755)
}

// WriteJSONFile writes data to a JSON file
func WriteJSONFile(data interface{}, filePath string) error {
	// Ensure directory exists
	dir := filepath.Dir(filePath)
	if err := EnsureDirExists(dir); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	// Marshal data to JSON
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal data to JSON: %w", err)
	}

	// Write to file
	if err := os.WriteFile(filePath, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", filePath, err)
	}

	return nil
}

// FormatFileSize formats a file size in bytes to a human-readable string
func FormatFileSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(bytes)/float64(div), "KMGTPE"[exp])
}

// GetFileSize returns the size of a file in bytes
func GetFileSize(filePath string) (int64, error) {
	info, err := os.Stat(filePath)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}
