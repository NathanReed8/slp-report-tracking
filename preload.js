const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenStore', {
  load: () => ipcRenderer.invoke('tokens:load'),
  save: (tokens) => ipcRenderer.invoke('tokens:save', tokens),
  loadSettings: () => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  focusWindow: () => ipcRenderer.invoke('window:focus')
});
