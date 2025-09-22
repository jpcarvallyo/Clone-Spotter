package cli

import (
	"fmt"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Show version information",
	Long:  `Display the version number and build information for Clone Spotter.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("%s v%s\n", AppName, AppVersion)
		fmt.Printf("Made with ❤️ by %s\n", AppAuthor)
	},
}
