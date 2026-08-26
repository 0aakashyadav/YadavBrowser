const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aaryaAPI", {
  ask: (message) => ipcRenderer.invoke("aarya:ask", { message })
});
