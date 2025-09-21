const fs = require("fs");
const fsp = require("fs").promises;
const crypto = require("crypto");
const path = require("path");
const { PassThrough } = require("stream");

const { massagePath } = require("./utils");

// Configuration constants
const DEFAULT_HASH_ALGORITHM = "md5";
const DEFAULT_EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  ".DS_Store",
  "dist",
  "build",
];
const SUPPORTED_HASH_ALGORITHMS = ["md5", "sha1", "sha256", "sha512"];
const VALID_OUTPUT_FLAGS = ["true", "false", "yes", "no", "y", "n"];

/**
 * Generates a hash for a file using the specified algorithm
 * @param {string} filePath - Path to the file to hash
 * @param {string} algorithm - Hash algorithm to use (default: 'md5')
 * @returns {Promise<string>} Promise that resolves to the hexadecimal hash
 * @throws {Error} If file cannot be read or algorithm is unsupported
 */
function getFileHash(filePath, algorithm = DEFAULT_HASH_ALGORITHM) {
  // Input validation
  if (!filePath || typeof filePath !== "string") {
    return Promise.reject(new Error("filePath must be a non-empty string"));
  }

  if (!SUPPORTED_HASH_ALGORITHMS.includes(algorithm)) {
    return Promise.reject(
      new Error(
        `Unsupported hash algorithm: ${algorithm}. Supported: ${SUPPORTED_HASH_ALGORITHMS.join(
          ", "
        )}`
      )
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => {
        const hex = hash.digest("hex");
        resolve(hex);
      });
      stream.on("error", (error) => {
        reject(new Error(`Failed to read file ${filePath}: ${error.message}`));
      });
    } catch (error) {
      reject(
        new Error(`Failed to create hash for ${filePath}: ${error.message}`)
      );
    }
  });
}

/**
 * Recursively searches for duplicate files in a directory tree
 * @param {string} rootDir - Root directory to search for duplicates
 * @param {string} hashAlgorithm - Hash algorithm to use for file comparison
 * @param {string[]} excludedDirs - Array of directory names to exclude from search
 * @returns {Promise<Array>} Promise that resolves to array of duplicate file objects
 * @throws {Error} If rootDir doesn't exist or is not accessible
 */
async function searchDuplicates(
  rootDir,
  hashAlgorithm = DEFAULT_HASH_ALGORITHM,
  excludedDirs = DEFAULT_EXCLUDED_DIRS
) {
  // Input validation
  if (!rootDir || typeof rootDir !== "string") {
    throw new Error("rootDir must be a non-empty string");
  }

  if (!SUPPORTED_HASH_ALGORITHMS.includes(hashAlgorithm)) {
    throw new Error(
      `Unsupported hash algorithm: ${hashAlgorithm}. Supported: ${SUPPORTED_HASH_ALGORITHMS.join(
        ", "
      )}`
    );
  }

  try {
    // Verify root directory exists
    const stats = await fsp.stat(rootDir);
    if (!stats.isDirectory()) {
      throw new Error(`${rootDir} is not a directory`);
    }
  } catch (error) {
    throw new Error(
      `Cannot access root directory ${rootDir}: ${error.message}`
    );
  }

  const fileHashes = new Map();
  const duplicates = [];

  async function processDirectory(directoryPath) {
    try {
      const entries = await fsp.readdir(directoryPath, {
        withFileTypes: true,
      });

      // Create regex from excluded directories
      const excludedPattern =
        excludedDirs.length > 0
          ? new RegExp(excludedDirs.join("|"), "g")
          : null;

      for (const entry of entries) {
        const entryPath = path.join(directoryPath, entry.name);
        const matches = excludedPattern
          ? entryPath.match(excludedPattern)
          : null;

        if (entry.isFile()) {
          try {
            const hash = await getFileHash(entryPath, hashAlgorithm);

            if (fileHashes.has(hash)) {
              duplicates.push({
                original: fileHashes.get(hash),
                duplicate: entryPath,
              });
            } else {
              fileHashes.set(hash, entryPath);
            }
          } catch (error) {
            console.warn(
              `Warning: Could not process file ${entryPath}: ${error.message}`
            );
            continue; // Skip files that can't be processed
          }
        } else if (entry.isDirectory() && !matches) {
          await processDirectory(entryPath);
        }
      }
    } catch (error) {
      console.warn(
        `Warning: Could not read directory ${directoryPath}: ${error.message}`
      );
    }
  }

  await processDirectory(rootDir);
  return duplicates;
}

/**
 * Processes and writes data to a file with optional terminal output
 * @param {any} data - Data to write (will be JSON stringified)
 * @param {string} outputDir - Directory where the output file should be written
 * @param {string} nameOfFile - Name of the output file (without extension)
 * @param {string|boolean} outputToTerminal - Whether to also output to terminal
 * @returns {Promise<void>} Promise that resolves when writing is complete
 * @throws {Error} If parameters are invalid or file operations fail
 */
async function processFile(
  data,
  outputDir,
  nameOfFile,
  outputToTerminal = false
) {
  // Input validation
  if (!outputDir || typeof outputDir !== "string") {
    throw new Error("outputDir must be a non-empty string");
  }

  if (!nameOfFile || typeof nameOfFile !== "string") {
    throw new Error("nameOfFile must be a non-empty string");
  }

  // Normalize outputToTerminal to boolean
  const shouldOutputToTerminal =
    typeof outputToTerminal === "string"
      ? VALID_OUTPUT_FLAGS.includes(outputToTerminal.toLowerCase()) &&
        ["true", "yes", "y"].includes(outputToTerminal.toLowerCase())
      : Boolean(outputToTerminal);

  try {
    const outputPath = massagePath(outputDir, nameOfFile);

    // Ensure output directory exists
    await fsp.mkdir(path.dirname(outputPath), { recursive: true });

    // Convert data to JSON
    const jsonData = JSON.stringify(data, null, 2);

    // Write to file
    await fsp.writeFile(outputPath, jsonData, "utf8");

    // Output to terminal if requested
    if (shouldOutputToTerminal) {
      console.log("\n=== Output Data ===");
      console.log(jsonData);
      console.log("==================\n");
    }

    console.log(`✅ Processed data and saved output to ${outputPath}`);
  } catch (error) {
    throw new Error(`Failed to process file: ${error.message}`);
  }
}

/**
 * Groups duplicate files by their original file path
 * @param {Array} duplicates - Array of duplicate objects with 'original' and 'duplicate' properties
 * @returns {Object} Object where keys are original file paths and values are arrays of duplicate paths
 * @throws {Error} If duplicates parameter is not a valid array
 */
function gatherDuplicates(duplicates) {
  // Input validation
  if (!Array.isArray(duplicates)) {
    throw new Error("duplicates must be an array");
  }

  const duplicateMap = new Map();

  duplicates.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(
        `Invalid duplicate item at index ${index}: must be an object`
      );
    }

    const { original, duplicate } = item;

    if (
      !original ||
      !duplicate ||
      typeof original !== "string" ||
      typeof duplicate !== "string"
    ) {
      throw new Error(
        `Invalid duplicate item at index ${index}: original and duplicate must be non-empty strings`
      );
    }

    if (!duplicateMap.has(original)) {
      duplicateMap.set(original, [duplicate]);
    } else {
      const duplicateArray = duplicateMap.get(original);
      duplicateArray.push(duplicate);
    }
  });

  return Object.fromEntries(duplicateMap);
}

/**
 * Gets statistics about duplicates found
 * @param {Array} duplicates - Array of duplicate objects
 * @returns {Object} Statistics object with counts and totals
 */
function getDuplicateStats(duplicates) {
  if (!Array.isArray(duplicates)) {
    throw new Error("duplicates must be an array");
  }

  const stats = {
    totalDuplicates: duplicates.length,
    uniqueOriginals: new Set(duplicates.map((d) => d.original)).size,
    totalDuplicateFiles:
      duplicates.length + new Set(duplicates.map((d) => d.original)).size,
    duplicateGroups: gatherDuplicates(duplicates),
  };

  return stats;
}

/**
 * Validates that a directory path exists and is accessible
 * @param {string} dirPath - Directory path to validate
 * @returns {Promise<boolean>} Promise that resolves to true if directory is valid
 */
async function validateDirectory(dirPath) {
  try {
    if (!dirPath || typeof dirPath !== "string") {
      return false;
    }

    const stats = await fsp.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

module.exports = {
  gatherDuplicates,
  getDuplicateStats,
  getFileHash,
  processFile,
  searchDuplicates,
  validateDirectory,
  // Export constants for external use
  DEFAULT_HASH_ALGORITHM,
  DEFAULT_EXCLUDED_DIRS,
  SUPPORTED_HASH_ALGORITHMS,
};
