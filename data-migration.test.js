const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { migrateUserData } = require('./data-migration');

test('migrates missing local data without overwriting data already in the new folder', async (t) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'slp-report-tracker-'));
  t.after(() => fs.rm(temporaryDirectory, { recursive: true, force: true }));

  const oldDataDirectory = path.join(temporaryDirectory, 'client-progress-report-tracker');
  const newDataDirectory = path.join(temporaryDirectory, 'SLP Report Tracking');
  await fs.mkdir(oldDataDirectory);
  await fs.writeFile(path.join(oldDataDirectory, 'tokens.json'), '[{"name":"Migrated client"}]\n');
  await fs.writeFile(path.join(oldDataDirectory, 'settings.json'), '{"theme":"dark"}\n');
  await fs.mkdir(newDataDirectory);
  await fs.writeFile(path.join(newDataDirectory, 'settings.json'), '{"theme":"light"}\n');

  const migratedFiles = await migrateUserData({
    appDataPath: temporaryDirectory,
    userDataPath: newDataDirectory,
    legacyDirectoryNames: ['client-progress-report-tracker']
  });

  assert.deepEqual(migratedFiles, ['tokens.json']);
  assert.equal(await fs.readFile(path.join(newDataDirectory, 'tokens.json'), 'utf8'), '[{"name":"Migrated client"}]\n');
  assert.equal(await fs.readFile(path.join(newDataDirectory, 'settings.json'), 'utf8'), '{"theme":"light"}\n');
  assert.equal(await fs.readFile(path.join(oldDataDirectory, 'tokens.json'), 'utf8'), '[{"name":"Migrated client"}]\n');
});
