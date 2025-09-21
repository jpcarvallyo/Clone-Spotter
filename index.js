#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const {
  searchDuplicates,
  processFile,
  gatherDuplicates,
  getDuplicateStats,
  validateDirectory,
  DEFAULT_HASH_ALGORITHM,
  DEFAULT_EXCLUDED_DIRS,
  SUPPORTED_HASH_ALGORITHMS,
} = require("./findDuplicates");
const { cleanDirPath } = require("./utils");

// CLI Configuration
const CLI_CONFIG = {
  name: "Clone Spotter",
  version: "2.0.0",
  description: "Find duplicate files based on content",
  author: "James Carvallyo II",
};

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

// Utility functions
function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = "white") {
  console.log(colorize(message, color));
}

function logError(message) {
  console.error(colorize(`❌ Error: ${message}`, "red"));
}

function logSuccess(message) {
  console.log(colorize(`✅ ${message}`, "green"));
}

function logWarning(message) {
  console.log(colorize(`⚠️  ${message}`, "yellow"));
}

function logInfo(message) {
  console.log(colorize(`ℹ️  ${message}`, "cyan"));
}

// Progress indicator
class ProgressIndicator {
  constructor(total, message = "Processing") {
    this.total = total;
    this.current = 0;
    this.message = message;
    this.startTime = Date.now();
    this.lastUpdate = 0;
  }

  update(increment = 1) {
    this.current += increment;
    const now = Date.now();

    // Only update every 100ms to avoid spam
    if (now - this.lastUpdate < 100) return;
    this.lastUpdate = now;

    const percentage = Math.round((this.current / this.total) * 100);
    const elapsed = (now - this.startTime) / 1000;
    const rate = this.current / elapsed;
    const eta =
      this.total > this.current ? (this.total - this.current) / rate : 0;

    process.stdout.write(
      `\r${colorize(`${this.message}: `, "cyan")}${percentage}% (${
        this.current
      }/${this.total}) ` + `${colorize(`ETA: ${eta.toFixed(1)}s`, "yellow")}`
    );
  }

  complete() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    console.log(
      `\n${colorize(`Completed in ${elapsed.toFixed(1)}s`, "green")}`
    );
  }
}

// Command line argument parser
function parseArguments() {
  const args = process.argv.slice(2);
  const config = {
    interactive: false,
    rootDir: null,
    outputDir: "./output",
    filename: "duplicates",
    algorithm: DEFAULT_HASH_ALGORITHM,
    excludedDirs: DEFAULT_EXCLUDED_DIRS,
    verbose: false,
    quiet: false,
    help: false,
    version: false,
    terminal: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "-h":
      case "--help":
        config.help = true;
        break;
      case "-v":
      case "--version":
        config.version = true;
        break;
      case "-i":
      case "--interactive":
        config.interactive = true;
        break;
      case "-d":
      case "--directory":
        config.rootDir = args[++i];
        break;
      case "-o":
      case "--output":
        config.outputDir = args[++i];
        break;
      case "-f":
      case "--filename":
        config.filename = args[++i];
        break;
      case "-a":
      case "--algorithm":
        const algo = args[++i];
        if (SUPPORTED_HASH_ALGORITHMS.includes(algo)) {
          config.algorithm = algo;
        } else {
          logError(
            `Unsupported algorithm: ${algo}. Supported: ${SUPPORTED_HASH_ALGORITHMS.join(
              ", "
            )}`
          );
          process.exit(1);
        }
        break;
      case "-e":
      case "--exclude":
        config.excludedDirs = args[++i].split(",");
        break;
      case "--verbose":
        config.verbose = true;
        break;
      case "-q":
      case "--quiet":
        config.quiet = true;
        break;
      case "-t":
      case "--terminal":
        config.terminal = true;
        break;
      default:
        if (!arg.startsWith("-")) {
          // Treat as root directory if no flag
          config.rootDir = arg;
        } else {
          logError(`Unknown argument: ${arg}`);
          showHelp();
          process.exit(1);
        }
    }
  }

  return config;
}

function showHelp() {
  console.log(`
${colorize(CLI_CONFIG.name, "bright")} v${CLI_CONFIG.version}
${colorize(CLI_CONFIG.description, "cyan")}

${colorize("USAGE:", "bright")}
  clone-spotter [OPTIONS] [DIRECTORY]

${colorize("ARGUMENTS:", "bright")}
  DIRECTORY              Directory to search for duplicates (default: interactive mode)

${colorize("OPTIONS:", "bright")}
  -h, --help             Show this help message
  -v, --version          Show version information
  -i, --interactive      Run in interactive mode
  -d, --directory DIR    Directory to search (alternative to positional argument)
  -o, --output DIR       Output directory (default: ./output)
  -f, --filename NAME    Output filename without extension (default: duplicates)
  -a, --algorithm ALGO   Hash algorithm: md5, sha1, sha256, sha512 (default: md5)
  -e, --exclude DIRS     Comma-separated list of directories to exclude
  -t, --terminal         Also output results to terminal
  --verbose              Verbose output with detailed information
  -q, --quiet            Minimal output

${colorize("EXAMPLES:", "bright")}
  ${colorize(
    "clone-spotter ~/Documents",
    "green"
  )}                    # Search Documents folder
  ${colorize(
    "clone-spotter -d ~/Pictures -o ~/reports -f pics",
    "green"
  )}  # Custom output
  ${colorize(
    "clone-spotter -a sha256 --exclude node_modules,dist",
    "green"
  )} # SHA256 with exclusions
  ${colorize(
    "clone-spotter --interactive",
    "green"
  )}                  # Interactive mode

${colorize("DEFAULT EXCLUDED DIRECTORIES:", "bright")}
  ${DEFAULT_EXCLUDED_DIRS.join(", ")}

${colorize("SUPPORTED HASH ALGORITHMS:", "bright")}
  ${SUPPORTED_HASH_ALGORITHMS.join(", ")}

Made with ❤️ by ${CLI_CONFIG.author}
`);
}

function showVersion() {
  console.log(`${CLI_CONFIG.name} v${CLI_CONFIG.version}`);
  console.log(`Made with ❤️ by ${CLI_CONFIG.author}`);
}

// Enhanced interactive mode
async function interactiveMode() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) =>
    new Promise((resolve) => {
      rl.question(colorize(prompt, "cyan"), resolve);
    });

  try {
    console.log(colorize(`\n🔍 ${CLI_CONFIG.name} Interactive Mode`, "bright"));
    console.log(colorize("=".repeat(50), "cyan"));

    // Directory selection
    let rootDir;
    while (true) {
      rootDir = await question("\n📁 Directory to search: ");
      if (!rootDir) {
        logError("Directory is required");
        continue;
      }

      const cleanDir = cleanDirPath(rootDir);
      const isValid = await validateDirectory(cleanDir);

      if (!isValid) {
        logError(`Directory not found or not accessible: ${cleanDir}`);
        continue;
      }

      rootDir = cleanDir;
      break;
    }

    // Hash algorithm selection
    console.log(colorize(`\n🔐 Available hash algorithms:`, "bright"));
    SUPPORTED_HASH_ALGORITHMS.forEach((algo, index) => {
      const marker = algo === DEFAULT_HASH_ALGORITHM ? " (default)" : "";
      console.log(`  ${index + 1}. ${algo}${marker}`);
    });

    let algorithm = DEFAULT_HASH_ALGORITHM;
    const algoChoice = await question(
      `\n🔐 Choose algorithm [1-${SUPPORTED_HASH_ALGORITHMS.length}] (default: 1): `
    );

    if (algoChoice && !isNaN(algoChoice)) {
      const index = parseInt(algoChoice) - 1;
      if (index >= 0 && index < SUPPORTED_HASH_ALGORITHMS.length) {
        algorithm = SUPPORTED_HASH_ALGORITHMS[index];
      }
    }

    // Exclusions
    console.log(colorize(`\n🚫 Default excluded directories:`, "bright"));
    console.log(`  ${DEFAULT_EXCLUDED_DIRS.join(", ")}`);

    const customExclude = await question(
      "\n🚫 Additional directories to exclude (comma-separated, or press Enter for default): "
    );
    const excludedDirs = customExclude
      ? [
          ...DEFAULT_EXCLUDED_DIRS,
          ...customExclude.split(",").map((d) => d.trim()),
        ]
      : DEFAULT_EXCLUDED_DIRS;

    // Output configuration
    const outputDir =
      (await question("\n📤 Output directory (default: ./output): ")) ||
      "./output";
    const filename =
      (await question("📄 Output filename (default: duplicates): ")) ||
      "duplicates";
    const terminalOutput = await question(
      "🖥️  Display results in terminal? [y/N]: "
    );
    const verbose = await question("📊 Verbose output? [y/N]: ");

    rl.close();

    // Execute search
    await executeSearch({
      rootDir,
      algorithm,
      excludedDirs,
      outputDir: cleanDirPath(outputDir),
      filename,
      terminal: ["y", "yes", "true"].includes(terminalOutput.toLowerCase()),
      verbose: ["y", "yes", "true"].includes(verbose.toLowerCase()),
      quiet: false,
    });
  } catch (error) {
    rl.close();
    logError(`Interactive mode failed: ${error.message}`);
    process.exit(1);
  }
}

// Main execution function
async function executeSearch(config) {
  try {
    if (!config.quiet) {
      console.log(
        colorize(`\n🚀 ${CLI_CONFIG.name} Starting Search`, "bright")
      );
      console.log(colorize("=".repeat(50), "cyan"));
      logInfo(`Searching: ${config.rootDir}`);
      logInfo(`Algorithm: ${config.algorithm}`);
      logInfo(`Excluded: ${config.excludedDirs.join(", ")}`);
      logInfo(
        `Output: ${path.join(config.outputDir, config.filename + ".json")}`
      );

      if (config.terminal) {
        logInfo("Terminal output: enabled");
      }

      console.log();
    }

    const startTime = Date.now();

    // Execute the search
    const duplicates = await searchDuplicates(
      config.rootDir,
      config.algorithm,
      config.excludedDirs
    );

    const searchTime = Date.now() - startTime;

    if (!config.quiet) {
      logSuccess(`Search completed in ${(searchTime / 1000).toFixed(2)}s`);
    }

    // Process results
    const dupMap = gatherDuplicates(duplicates);
    const stats = getDuplicateStats(duplicates);

    if (!config.quiet) {
      console.log(colorize(`\n📊 Results Summary`, "bright"));
      console.log(colorize("-".repeat(30), "cyan"));
      logSuccess(`Found ${stats.totalDuplicates} duplicate files`);
      logInfo(`Unique originals: ${stats.uniqueOriginals}`);
      logInfo(`Total duplicate files: ${stats.totalDuplicateFiles}`);

      if (stats.totalDuplicates > 0) {
        const totalSize = stats.totalDuplicates * 1024; // Rough estimate
        logWarning(
          `Potential space savings: ~${(totalSize / 1024 / 1024).toFixed(2)} MB`
        );
      }
    }

    // Save results
    await processFile(
      dupMap,
      config.outputDir,
      config.filename,
      config.terminal
    );

    if (config.verbose && stats.totalDuplicates > 0) {
      console.log(colorize(`\n📋 Detailed Results`, "bright"));
      console.log(colorize("-".repeat(30), "cyan"));

      Object.entries(stats.duplicateGroups).forEach(
        ([original, duplicates], index) => {
          if (index < 10) {
            // Show first 10 groups
            console.log(`\n${colorize(`Group ${index + 1}:`, "yellow")}`);
            console.log(`  Original: ${colorize(original, "green")}`);
            duplicates.forEach((dup) => {
              console.log(`  Duplicate: ${colorize(dup, "red")}`);
            });
          }
        }
      );

      if (Object.keys(stats.duplicateGroups).length > 10) {
        console.log(
          colorize(
            `\n... and ${
              Object.keys(stats.duplicateGroups).length - 10
            } more groups`,
            "yellow"
          )
        );
      }
    }

    if (!config.quiet) {
      console.log(colorize(`\n🎉 ${CLI_CONFIG.name} Complete!`, "bright"));
    }
  } catch (error) {
    logError(`Search failed: ${error.message}`);
    if (!config.quiet) {
      console.log(colorize(`\n💡 Tips:`, "bright"));
      console.log("  - Ensure you have read permissions for the directory");
      console.log("  - Check that the directory path is correct");
      console.log("  - Try running with --verbose for more details");
    }
    process.exit(1);
  }
}

// Main function
async function main() {
  const config = parseArguments();

  // Handle help and version
  if (config.help) {
    showHelp();
    return;
  }

  if (config.version) {
    showVersion();
    return;
  }

  // Determine mode
  if (config.interactive || !config.rootDir) {
    await interactiveMode();
    return;
  }

  // Validate root directory
  const cleanDir = cleanDirPath(config.rootDir);
  const isValid = await validateDirectory(cleanDir);

  if (!isValid) {
    logError(`Directory not found or not accessible: ${cleanDir}`);
    console.log(
      colorize(`\n💡 Try running with --help for usage information`, "yellow")
    );
    process.exit(1);
  }

  config.rootDir = cleanDir;

  // Execute search
  await executeSearch(config);
}

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logError(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run the application
if (require.main === module) {
  main().catch((error) => {
    logError(`Application error: ${error.message}`);
    process.exit(1);
  });
}
