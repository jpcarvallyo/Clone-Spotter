const fs = require("fs");
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
  await rl.question(
    "Enter the directory to start search at: ",
    async (rootDirectory) => {
      const duplicates = await searchDuplicates(cleanDirPath(rootDirectory));
      const dupMap = gatherDuplicates(duplicates);

      await rl.question("Enter the output file path: ", async (outputPath) => {
        await rl.question("Enter name of file: ", async (fileName) => {
          await rl.question(
            "Output to terminal as well?",
            async (outputToTerminal) => {
              await processFile(
                dupMap,
                cleanDirPath(outputPath),
                fileName,
                outputToTerminal
              );
              rl.close();
            }
          );
        });
      });
    }
  );
}

main();
