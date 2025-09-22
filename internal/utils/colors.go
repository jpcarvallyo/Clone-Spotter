package utils

import (
	"github.com/fatih/color"
)

// Color constants for terminal output
var (
	Red     = color.New(color.FgRed).SprintFunc()
	Green   = color.New(color.FgGreen).SprintFunc()
	Yellow  = color.New(color.FgYellow).SprintFunc()
	Blue    = color.New(color.FgBlue).SprintFunc()
	Magenta = color.New(color.FgMagenta).SprintFunc()
	Cyan    = color.New(color.FgCyan).SprintFunc()
	White   = color.New(color.FgWhite).SprintFunc()
	Bold    = color.New(color.Bold).SprintFunc()
)

// Colorized output functions
func LogError(message string) {
	color.Red("❌ Error: %s", message)
}

func LogSuccess(message string) {
	color.Green("✅ %s", message)
}

func LogWarning(message string) {
	color.Yellow("⚠️  %s", message)
}

func LogInfo(message string) {
	color.Cyan("ℹ️  %s", message)
}

func LogBold(message string) {
	color.New(color.Bold).Println(message)
}

func LogCyan(message string) {
	color.Cyan(message)
}
