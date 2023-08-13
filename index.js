const fs = require("fs");
const { PassThrough } = require("stream");

const {
  searchDuplicates,
  processFile,
  gatherDuplicates,
} = require("./findDuplicates");

async function main(folderpath) {
  console.log(`folderpath: ${folderpath}`);
  const duplicates = await searchDuplicates(folderpath);
  const dupMap = await gatherDuplicates(duplicates);
  await processFile(dupMap, __dirname);
  const passThroughStream = new PassThrough();
  const readStream = fs.createReadStream(__dirname + "/duplicates.json");
  readStream.pipe(passThroughStream);

  passThroughStream.pipe(process.stdout);
}

main("/Users/jamescarvallyo/Documents");
