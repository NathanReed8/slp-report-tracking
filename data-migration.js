const fs = require('node:fs/promises');
const path = require('node:path');

const TRACKED_DATA_FILES = ['tokens.json', 'settings.json'];

async function pathExists(filePath, fileSystem = fs) {
  try {
    await fileSystem.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Copies data from prior application-data folders only when the new folder
 * does not already contain that file. Source files are intentionally retained.
 */
async function migrateUserData({
  appDataPath,
  userDataPath,
  legacyDirectoryNames,
  fileNames = TRACKED_DATA_FILES,
  fileSystem = fs
}) {
  await fileSystem.mkdir(userDataPath, { recursive: true });
  const migratedFiles = [];

  for (const fileName of fileNames) {
    const destination = path.join(userDataPath, fileName);
    if (await pathExists(destination, fileSystem)) continue;

    for (const legacyDirectoryName of legacyDirectoryNames) {
      const sourceDirectory = path.join(appDataPath, legacyDirectoryName);
      if (path.resolve(sourceDirectory) === path.resolve(userDataPath)) continue;

      const source = path.join(sourceDirectory, fileName);
      if (!await pathExists(source, fileSystem)) continue;

      await fileSystem.copyFile(source, destination);
      migratedFiles.push(fileName);
      break;
    }
  }

  return migratedFiles;
}

module.exports = { TRACKED_DATA_FILES, migrateUserData };
