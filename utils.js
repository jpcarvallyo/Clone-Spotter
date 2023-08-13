function cleanDirPath(path) {
  let fullPath = null;
  if (path.includes("~")) {
    const dir = __dirname;
    const parts = dir.split("/");

    // The first two parts are empty due to the leading slash
    let userNamePath = "/" + parts[1] + "/" + parts[2];
    userNamePath = userNamePath.endsWith("/")
      ? userNamePath
      : userNamePath + "/";
    fullPath = path.replace("~/", userNamePath);
    console.log(fullPath);
  }

  return fullPath || path;
}

function massagePath(outputDir, nameOfFile) {
  const outputDirGroomed = outputDir.endsWith("/")
    ? outputDir.substring(0, outputDir.length - 1)
    : outputDir;
  const nameOfFileGroomed = nameOfFile.endsWith(".json")
    ? nameOfFile
    : nameOfFile + ".json";
  const outputPath = outputDirGroomed + "/" + nameOfFileGroomed;
  return outputPath;
}

module.exports = {
  cleanDirPath,
  massagePath,
};
