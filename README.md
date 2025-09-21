# 🔍 Clone Spotter

A powerful Node.js command-line tool that finds duplicate files based on their **content**, not their names. Perfect for cleaning up your file system and reclaiming disk space.

## ✨ Features

- **Content-based Detection**: Finds duplicates by comparing file hashes, not just filenames
- **Multiple Hash Algorithms**: Support for MD5, SHA1, SHA256, and SHA512
- **Configurable Exclusions**: Automatically skips common directories like `node_modules`, `.git`, etc.
- **Flexible Output**: Save results to JSON file with optional terminal output
- **Robust Error Handling**: Graceful handling of file system errors and permissions
- **Comprehensive Statistics**: Detailed reports on duplicate file counts and groups
- **Production Ready**: Well-tested with comprehensive input validation

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd cloneSpotter

# Install dependencies (if any)
npm install

# Run the tool
npm start
```

### Basic Usage

```bash
# Interactive mode
npm start

# Or run directly
node index.js
```

The tool will prompt you for:

1. **Directory to search**: Starting directory for duplicate detection
2. **Output directory**: Where to save the results JSON file
3. **Output filename**: Name of the results file (without extension)
4. **Terminal output**: Whether to display results in terminal as well

### Example Session

```
Enter the directory to start search at: ~/Documents
Enter the output file path: ~/Desktop
Enter name of file: duplicate-report
Output to terminal as well? [y/n]: y

✅ Processed data and saved output to ~/Desktop/duplicate-report.json
```

## 📊 Output Format

The tool generates a JSON file with duplicate file groups:

```json
{
  "/path/to/original/file1.txt": [
    "/path/to/duplicate1/file1.txt",
    "/path/to/duplicate2/file1.txt"
  ],
  "/path/to/original/image.jpg": ["/path/to/duplicate/image.jpg"]
}
```

## 🛠️ Advanced Usage

### Programmatic API

```javascript
const {
  searchDuplicates,
  processFile,
  gatherDuplicates,
  getDuplicateStats,
  validateDirectory,
} = require("./findDuplicates");

// Basic duplicate search
const duplicates = await searchDuplicates("/path/to/search");

// Advanced search with custom configuration
const duplicates = await searchDuplicates(
  "/path/to/search",
  "sha256", // Hash algorithm
  ["node_modules", ".git", "dist", "coverage"] // Custom exclusions
);

// Get comprehensive statistics
const stats = getDuplicateStats(duplicates);
console.log(`Found ${stats.totalDuplicates} duplicate files`);

// Process and save results
await processFile(stats, "./output", "report", true);
```

### Configuration Options

#### Supported Hash Algorithms

- `md5` (default) - Fast, good for most use cases
- `sha1` - More secure, slightly slower
- `sha256` - High security, moderate speed
- `sha512` - Highest security, slowest

#### Default Excluded Directories

- `node_modules`
- `.git`
- `.DS_Store`
- `dist`
- `build`

## 🔧 Shell Integration

Create a convenient alias in your shell configuration:

### Bash/Zsh

```bash
# Add to ~/.bashrc or ~/.zshrc
alias findDups="cd ~/Documents/code/cloneSpotter; node index.js; cd -"
```

### Fish Shell

```fish
# Add to ~/.config/fish/config.fish
alias findDups="cd ~/Documents/code/cloneSpotter; and node index.js; and cd -"
```

Then run from anywhere:

```bash
findDups
```

## 📁 Project Structure

```
cloneSpotter/
├── findDuplicates.js    # Core duplicate detection logic
├── index.js            # CLI interface
├── utils.js            # Utility functions
├── package.json        # Project configuration
└── README.md          # This file
```

## 🧪 API Reference

### `searchDuplicates(rootDir, hashAlgorithm, excludedDirs)`

Recursively searches for duplicate files in a directory tree.

**Parameters:**

- `rootDir` (string): Root directory to search
- `hashAlgorithm` (string): Hash algorithm to use (default: 'md5')
- `excludedDirs` (string[]): Directories to exclude (default: common build/cache dirs)

**Returns:** `Promise<Array>` - Array of duplicate objects

### `processFile(data, outputDir, nameOfFile, outputToTerminal)`

Processes and writes data to a file with optional terminal output.

**Parameters:**

- `data` (any): Data to write (will be JSON stringified)
- `outputDir` (string): Output directory path
- `nameOfFile` (string): Output filename (without extension)
- `outputToTerminal` (boolean|string): Whether to output to terminal

**Returns:** `Promise<void>`

### `getDuplicateStats(duplicates)`

Generates comprehensive statistics about found duplicates.

**Parameters:**

- `duplicates` (Array): Array of duplicate objects

**Returns:** `Object` - Statistics object with counts and groups

### `validateDirectory(dirPath)`

Validates that a directory exists and is accessible.

**Parameters:**

- `dirPath` (string): Directory path to validate

**Returns:** `Promise<boolean>` - True if directory is valid

## 🐛 Troubleshooting

### Common Issues

**Permission Denied Errors**

- Ensure you have read access to the directories you're scanning
- On Unix systems, check file permissions with `ls -la`

**Memory Issues with Large Directories**

- The tool processes files one at a time to minimize memory usage
- Consider excluding large directories like `node_modules` or `vendor`

**Slow Performance**

- MD5 is the fastest algorithm for most use cases
- Consider excluding large directories from scanning
- Use SSD storage for better I/O performance

### Getting Help

If you encounter issues:

1. Check that all required parameters are provided
2. Verify directory paths are correct and accessible
3. Ensure you have sufficient disk space for output files
4. Check the console for detailed error messages

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd cloneSpotter

# Make your changes
# Test thoroughly

# Submit a pull request
```

## 📄 License

This project is licensed under the BSD-2-Clause License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Node.js and modern JavaScript
- Uses crypto module for secure file hashing
- Implements best practices for file system operations

---

**Made with ❤️ by James Carvallyo II**
