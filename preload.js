const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("browserAPI", {
  navigate: (url) => ipcRenderer.send("navigate", url),
  back: () => ipcRenderer.send("back"),
  forward: () => ipcRenderer.send("forward"),
  reload: () => ipcRenderer.send("reload")
});