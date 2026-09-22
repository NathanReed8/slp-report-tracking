const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tokenStore', {
  load: () => ipcRenderer.invoke('tokens:load'),
  save: (tokens) => ipcRenderer.invoke('tokens:save', tokens),
  focusWindow: () => ipcRenderer.invoke('window:focus')
});
