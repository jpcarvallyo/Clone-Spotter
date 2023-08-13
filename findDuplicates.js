const fs = require("fs");
const fsp = require("fs").promises;
const crypto = require("crypto");
const path = require("path");

function getFileHash(filePath, algorithm = "md5") {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => {
      const hex = hash.digest("hex");
      resolve(hex);
    });
    stream.on("error", reject);
  });
}

async function searchDuplicates(rootDir, hashAlgorithm = "md5") {
  const fileHashes = new Map();
  const duplicates = [];

  async function processDirectory(directoryPath) {
    const entries = await fs.promises.readdir(directoryPath, {
      withFileTypes: true,
    });

    const regex = new RegExp("node_modules|.git", "g");

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      const matches = entryPath.match(regex);

      if (entry.isFile()) {
        const hash = await getFileHash(entryPath, hashAlgorithm);

        if (fileHashes.has(hash)) {
          duplicates.push({
            original: fileHashes.get(hash),
            duplicate: entryPath,
          });
        } else {
          fileHashes.set(hash, entryPath);
        }
      } else if (entry.isDirectory() && !matches) {
        await processDirectory(entryPath);
      }
    }
  }

  await processDirectory(rootDir);

  return duplicates;
}

async function processFile(data, outputDir) {
  try {
    const outputPath = outputDir + "/duplicates.json";

    // Check if the file exists
    if (!fs.existsSync(outputPath)) {
      fs.writeFile(outputPath, "", (err) => {
        if (err) {
          console.error("Error creating file:", err);
        } else {
          console.log("File created successfully.");
        }
      });
    }
    const stats = await fsp.stat(outputPath);
    if (stats.size) {
      fs.truncate(outputPath, 0, (err) => {
        if (err) {
          console.error("Error:", err);
        } else {
          console.log("File content removed successfully.");
        }
      });
    }
    const dataJson = JSON.stringify(data);

    const writeStream = fs.createWriteStream(outputPath, { flags: "a" });
    writeStream.write(dataJson, "utf-8");

    writeStream.end();

    writeStream.on("finish", () => {
      console.log(`Processed stats and saved output to ${outputPath}`);
    });

    writeStream.on("error", (err) => {
      console.error("Error writing to output:", err);
    });
  } catch (error) {
    console.log(error);
  }
}

function gatherDuplicates(duplicates) {
  const map = new Map();
  duplicates.forEach((item) => {
    const { original, duplicate } = item;
    if (!map.has(original)) {
      map.set(original, [duplicate]);
    } else {
      const dupArr = map.get(original);
      dupArr.push(duplicate);
    }
  });
  return Object.fromEntries(map);
}

module.exports = {
  gatherDuplicates,
  processFile,
  searchDuplicates,
};
