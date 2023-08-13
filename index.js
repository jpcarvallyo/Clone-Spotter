const fs = require("fs");
const { PassThrough } = require("stream");
const readline = require("readline");

const {
  searchDuplicates,
  processFile,
  gatherDuplicates,
} = require("./findDuplicates");
const { cleanDirPath } = require("./utils");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  await rl.question("Enter the root directory: ", async (rootDirectory) => {
    const duplicates = await searchDuplicates(cleanDirPath(rootDirectory));
    const dupMap = gatherDuplicates(duplicates);

    await rl.question("Enter the output file path: ", async (outputPath) => {
      await rl.question("Enter name of file: ", async (fileName) => {
        await processFile(dupMap, cleanDirPath(outputPath), fileName);
        rl.close();
      });
    });
  });

  //   const passThroughStream = new PassThrough();
  //   const readStream = fs.createReadStream(__dirname + "/duplicates.json");
  //   readStream.pipe(passThroughStream);

  //   passThroughStream.pipe(process.stdout);
}

main();
