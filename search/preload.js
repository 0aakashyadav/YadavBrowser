const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: url => ipcRenderer.send('navigate', url),
  openNewTab: url => ipcRenderer.send('open-new-tab', url),
  openPrivateTab: url => ipcRenderer.send('open-private-tab', url),
  searchWeb: options => ipcRenderer.invoke('yadav:search', options),
  searchStatus: () => ipcRenderer.invoke('yadav:search-status')
});
