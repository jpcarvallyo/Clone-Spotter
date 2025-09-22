package cli

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"strings"

	"clone-spotter/internal/core"
	"clone-spotter/internal/utils"

	"github.com/spf13/cobra"
)

const (
	AppName    = "Clone Spotter"
	AppVersion = "2.0.0"
	AppAuthor  = "James Carvallyo II"
)

var (
	rootDir     string
	outputDir   string
	filename    string
	algorithm   string
	excludeDirs string
	terminal    bool
	verbose     bool
	quiet       bool
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "clone-spotter [DIRECTORY]",
	Short: "Find duplicate files based on content",
	Long: `A powerful command-line tool that finds duplicate files based on their content, 
not their names. Perfect for cleaning up your file system and reclaiming disk space.

Features:
- Content-based Detection: Finds duplicates by comparing file hashes
- Multiple Hash Algorithms: Support for MD5, SHA1, SHA256, and SHA512
- Configurable Exclusions: Automatically skips common directories
- Flexible Output: Save results to JSON file with optional terminal output
- Robust Error Handling: Graceful handling of file system errors
- Comprehensive Statistics: Detailed reports on duplicate file counts and groups`,
	Args: cobra.MaximumNArgs(1),
	RunE: runSearch,
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// Add flags
	rootCmd.Flags().StringVarP(&rootDir, "directory", "d", "", "Directory to search for duplicates")
	rootCmd.Flags().StringVarP(&outputDir, "output", "o", "./output", "Output directory")
	rootCmd.Flags().StringVarP(&filename, "filename", "f", "duplicates", "Output filename without extension")
	rootCmd.Flags().StringVarP(&algorithm, "algorithm", "a", "md5", "Hash algorithm (md5, sha1, sha256, sha512)")
	rootCmd.Flags().StringVarP(&excludeDirs, "exclude", "e", "", "Comma-separated list of directories to exclude")
	rootCmd.Flags().BoolVarP(&terminal, "terminal", "t", false, "Also output results to terminal")
	rootCmd.Flags().BoolVar(&verbose, "verbose", false, "Verbose output with detailed information")
	rootCmd.Flags().BoolVarP(&quiet, "quiet", "q", false, "Minimal output")

	// Add version command
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(interactiveCmd)
}

func runSearch(cmd *cobra.Command, args []string) error {
	// Get root directory from args or flag
	if len(args) > 0 {
		rootDir = args[0]
	}

	// If no directory specified, run interactive mode
	if rootDir == "" {
		return runInteractiveMode()
	}

	// Validate algorithm
	if !core.IsValidAlgorithm(algorithm) {
		return fmt.Errorf("unsupported algorithm: %s. Supported: %v", algorithm, core.GetSupportedAlgorithms())
	}

	// Clean and validate root directory
	cleanRootDir := utils.CleanDirPath(rootDir)
	if !core.ValidateDirectory(cleanRootDir) {
		return fmt.Errorf("directory not found or not accessible: %s", cleanRootDir)
	}

	// Parse excluded directories
	excludedDirs := core.DefaultExcludedDirs
	if excludeDirs != "" {
		excludedDirs = append(excludedDirs, strings.Split(excludeDirs, ",")...)
		// Trim spaces
		for i, dir := range excludedDirs {
			excludedDirs[i] = strings.TrimSpace(dir)
		}
	}

	// Execute search
	return executeSearch(cleanRootDir, outputDir, filename, algorithm, excludedDirs, terminal, verbose, quiet)
}

func executeSearch(rootDir, outputDir, filename, algorithm string, excludedDirs []string, terminal, verbose, quiet bool) error {
	if !quiet {
		utils.LogBold(fmt.Sprintf("\n🚀 %s Starting Search", AppName))
		utils.LogCyan(strings.Repeat("=", 50))
		utils.LogInfo(fmt.Sprintf("Searching: %s", rootDir))
		utils.LogInfo(fmt.Sprintf("Algorithm: %s", algorithm))
		utils.LogInfo(fmt.Sprintf("Excluded: %s", strings.Join(excludedDirs, ", ")))
		utils.LogInfo(fmt.Sprintf("Output: %s", filepath.Join(outputDir, filename+".json")))
		
		if terminal {
			utils.LogInfo("Terminal output: enabled")
		}
		fmt.Println()
	}

	// Create duplicate finder
	finder := core.NewDuplicateFinder(core.HashAlgorithm(algorithm), excludedDirs)

	// Create progress channel
	progressChan := make(chan int, 100)
	go func() {
		total := 0
		for range progressChan {
			total++
			if !quiet {
				fmt.Printf("\rProcessing files: %d", total)
			}
		}
		if !quiet {
			fmt.Println()
		}
	}()

	// Search for duplicates
	duplicates, err := finder.SearchDuplicates(rootDir, progressChan)
	close(progressChan)
	
	if err != nil {
		return fmt.Errorf("search failed: %w", err)
	}

	if !quiet {
		utils.LogSuccess("Search completed")
	}

	// Process results
	duplicateMap := core.GatherDuplicates(duplicates)
	stats := core.GetDuplicateStats(duplicates)

	if !quiet {
		utils.LogBold("\n📊 Results Summary")
		utils.LogCyan(strings.Repeat("-", 30))
		utils.LogSuccess(fmt.Sprintf("Found %d duplicate files", stats.TotalDuplicates))
		utils.LogInfo(fmt.Sprintf("Unique originals: %d", stats.UniqueOriginals))
		utils.LogInfo(fmt.Sprintf("Total duplicate files: %d", stats.TotalDuplicateFiles))

		if stats.TotalDuplicates > 0 {
			// Rough estimate of space savings (assuming average file size)
			estimatedSize := int64(stats.TotalDuplicates) * 1024 // 1KB average
			utils.LogWarning(fmt.Sprintf("Potential space savings: ~%s", utils.FormatFileSize(estimatedSize)))
		}
	}

	// Save results
	outputPath := utils.MassagePath(outputDir, filename)
	if err := utils.WriteJSONFile(duplicateMap, outputPath); err != nil {
		return fmt.Errorf("failed to save results: %w", err)
	}

	utils.LogSuccess(fmt.Sprintf("Results saved to %s", outputPath))

	// Terminal output if requested
	if terminal {
		fmt.Println("\n=== Output Data ===")
		// Convert to JSON for display
		jsonData, err := json.MarshalIndent(duplicateMap, "", "  ")
		if err == nil {
			fmt.Println(string(jsonData))
		}
		fmt.Println("==================\n")
	}

	// Verbose output
	if verbose && stats.TotalDuplicates > 0 {
		utils.LogBold("\n📋 Detailed Results")
		utils.LogCyan(strings.Repeat("-", 30))

		count := 0
		for original, duplicates := range stats.DuplicateGroups {
			if count >= 10 { // Show first 10 groups
				utils.LogWarning(fmt.Sprintf("\n... and %d more groups", len(stats.DuplicateGroups)-10))
				break
			}
			fmt.Printf("\n%s", utils.Yellow(fmt.Sprintf("Group %d:", count+1)))
			fmt.Printf("\n  Original: %s", utils.Green(original))
			for _, dup := range duplicates {
				fmt.Printf("\n  Duplicate: %s", utils.Red(dup))
			}
			count++
		}
	}

	if !quiet {
		utils.LogBold(fmt.Sprintf("\n🎉 %s Complete!", AppName))
	}

	return nil
}
