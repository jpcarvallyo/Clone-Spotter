package cli

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"

	"clone-spotter/internal/core"
	"clone-spotter/internal/utils"

	"github.com/spf13/cobra"
)

var interactiveCmd = &cobra.Command{
	Use:   "interactive",
	Short: "Run in interactive mode",
	Long:  `Run Clone Spotter in interactive mode with guided prompts for all options.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runInteractiveMode()
	},
}

func runInteractiveMode() error {
	utils.LogBold(fmt.Sprintf("\n🔍 %s Interactive Mode", AppName))
	utils.LogCyan(strings.Repeat("=", 50))

	// Get root directory
	rootDir, err := promptForDirectory()
	if err != nil {
		return err
	}

	// Get algorithm
	algorithm, err := promptForAlgorithm()
	if err != nil {
		return err
	}

	// Get excluded directories
	excludedDirs, err := promptForExcludedDirs()
	if err != nil {
		return err
	}

	// Get output configuration
	outputDir, filename, terminal, verbose, err := promptForOutput()
	if err != nil {
		return err
	}

	// Execute search
	return executeSearch(rootDir, outputDir, filename, algorithm, excludedDirs, terminal, verbose, false)
}

func promptForDirectory() (string, error) {
	reader := bufio.NewReader(os.Stdin)
	
	for {
		fmt.Print("\n📁 Directory to search: ")
		input, err := reader.ReadString('\n')
		if err != nil {
			return "", err
		}
		
		rootDir := strings.TrimSpace(input)
		if rootDir == "" {
			utils.LogError("Directory is required")
			continue
		}

		cleanRootDir := utils.CleanDirPath(rootDir)
		if !core.ValidateDirectory(cleanRootDir) {
			utils.LogError(fmt.Sprintf("Directory not found or not accessible: %s", cleanRootDir))
			continue
		}

		return cleanRootDir, nil
	}
}

func promptForAlgorithm() (string, error) {
	algorithms := core.GetSupportedAlgorithms()
	
	utils.LogBold("\n🔐 Available hash algorithms:")
	for i, algo := range algorithms {
		marker := ""
		if algo == core.MD5 {
			marker = " (default)"
		}
		fmt.Printf("  %d. %s%s\n", i+1, algo, marker)
	}

	reader := bufio.NewReader(os.Stdin)
	fmt.Printf("\n🔐 Choose algorithm [1-%d] (default: 1): ", len(algorithms))
	
	input, err := reader.ReadString('\n')
	if err != nil {
		return "", err
	}
	
	input = strings.TrimSpace(input)
	if input == "" {
		return string(core.MD5), nil
	}
	
	choice, err := strconv.Atoi(input)
	if err != nil || choice < 1 || choice > len(algorithms) {
		utils.LogWarning("Invalid choice, using default (MD5)")
		return string(core.MD5), nil
	}
	
	return string(algorithms[choice-1]), nil
}

func promptForExcludedDirs() ([]string, error) {
	utils.LogBold("\n🚫 Default excluded directories:")
	fmt.Printf("  %s\n", strings.Join(core.DefaultExcludedDirs, ", "))

	reader := bufio.NewReader(os.Stdin)
	fmt.Print("\n🚫 Additional directories to exclude (comma-separated, or press Enter for default): ")
	
	input, err := reader.ReadString('\n')
	if err != nil {
		return nil, err
	}
	
	input = strings.TrimSpace(input)
	if input == "" {
		return core.DefaultExcludedDirs, nil
	}
	
	additionalDirs := strings.Split(input, ",")
	for i, dir := range additionalDirs {
		additionalDirs[i] = strings.TrimSpace(dir)
	}
	
	return append(core.DefaultExcludedDirs, additionalDirs...), nil
}

func promptForOutput() (string, string, bool, bool, error) {
	reader := bufio.NewReader(os.Stdin)
	
	// Output directory
	fmt.Print("\n📤 Output directory (default: ./output): ")
	input, err := reader.ReadString('\n')
	if err != nil {
		return "", "", false, false, err
	}
	outputDir := strings.TrimSpace(input)
	if outputDir == "" {
		outputDir = "./output"
	}
	
	// Filename
	fmt.Print("📄 Output filename (default: duplicates): ")
	input, err = reader.ReadString('\n')
	if err != nil {
		return "", "", false, false, err
	}
	filename := strings.TrimSpace(input)
	if filename == "" {
		filename = "duplicates"
	}
	
	// Terminal output
	fmt.Print("🖥️  Display results in terminal? [y/N]: ")
	input, err = reader.ReadString('\n')
	if err != nil {
		return "", "", false, false, err
	}
	terminal := strings.ToLower(strings.TrimSpace(input)) == "y"
	
	// Verbose output
	fmt.Print("📊 Verbose output? [y/N]: ")
	input, err = reader.ReadString('\n')
	if err != nil {
		return "", "", false, false, err
	}
	verbose := strings.ToLower(strings.TrimSpace(input)) == "y"
	
	return outputDir, filename, terminal, verbose, nil
}
