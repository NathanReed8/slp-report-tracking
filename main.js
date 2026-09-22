const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs/promises');
const path = require('node:path');
const { migrateUserData } = require('./data-migration');

const APP_DATA_DIRECTORY_NAME = 'SLP Report Tracking';
const LEGACY_APP_DATA_DIRECTORY_NAMES = [
  'client-progress-report-tracker',
  'Client Progress Report Tracker',
  'token-expiration-tracker',
  'Token Expiration Tracker'
];

// Keep user data in a stable folder even if Electron's display-name behavior
// differs between development and packaged builds.
app.setPath('userData', path.join(app.getPath('appData'), APP_DATA_DIRECTORY_NAME));

function dataPath() {
  return path.join(app.getPath('userData'), 'tokens.json');
}

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

async function readTokens() {
  try {
    const contents = await fs.readFile(dataPath(), 'utf8');
    const tokens = JSON.parse(contents);
    return Array.isArray(tokens) ? tokens : [];
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Could not read token data:', error);
    return [];
  }
}

async function writeTokens(tokens) {
  const file = dataPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(tokens, null, 2)}\n`, 'utf8');
}

async function readSettings() {
  try {
    return JSON.parse(await fs.readFile(settingsPath(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('Could not read settings:', error);
    return null;
  }
}

async function writeSettings(settings) {
  const file = settingsPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

function createWindow() {
  const window = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 650,
    minHeight: 480,
    backgroundColor: '#f7f8fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile('calendar.html');
}

function initializeAutoUpdates() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = app.getVersion().includes('-');

  autoUpdater.on('error', (error) => {
    console.warn('Update check or download failed:', error);
  });

  autoUpdater.on('update-available', async (update) => {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update available',
      message: `SLP Report Tracking ${update.version} is available.`,
      detail: 'Would you like to download it now? You can keep using the app while it downloads.',
      buttons: ['Download update', 'Not now'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) {
      try {
        await autoUpdater.downloadUpdate();
      } catch (error) {
        console.warn('Could not download update:', error);
      }
    }
  });

  autoUpdater.on('update-downloaded', async () => {
    const response = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: 'The update has finished downloading.',
      detail: 'Restart SLP Report Tracking now to install it?',
      buttons: ['Restart and install', 'Later'],
      defaultId: 0,
      cancelId: 1
    });

    if (response.response === 0) autoUpdater.quitAndInstall();
  });

  const updateTimer = setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn('Could not check for updates:', error);
    });
  }, 5000);
  updateTimer.unref();
}

ipcMain.handle('tokens:load', readTokens);
ipcMain.handle('tokens:save', async (_event, tokens) => {
  if (!Array.isArray(tokens)) throw new TypeError('Tokens must be an array');
  await writeTokens(tokens);
  return true;
});
ipcMain.handle('settings:load', readSettings);
ipcMain.handle('settings:save', async (_event, settings) => {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new TypeError('Settings must be an object');
  await writeSettings(settings);
  return true;
});

ipcMain.handle('window:focus', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) {
    window.show();
    window.focus();
  }
  return true;
});

app.whenReady().then(async () => {
  try {
    const migratedFiles = await migrateUserData({
      appDataPath: app.getPath('appData'),
      userDataPath: app.getPath('userData'),
      legacyDirectoryNames: LEGACY_APP_DATA_DIRECTORY_NAMES
    });
    if (migratedFiles.length > 0) console.info(`Migrated local data: ${migratedFiles.join(', ')}`);
  } catch (error) {
    console.warn('Could not migrate local app data:', error);
  }

  createWindow();
  initializeAutoUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
