const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

function dataPath() {
  return path.join(app.getPath('userData'), 'tokens.json');
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

  window.loadFile('index.html');
}

ipcMain.handle('tokens:load', readTokens);
ipcMain.handle('tokens:save', async (_event, tokens) => {
  if (!Array.isArray(tokens)) throw new TypeError('Tokens must be an array');
  await writeTokens(tokens);
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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
