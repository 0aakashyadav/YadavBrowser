const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aaryaAPI", {
  ask: (message) => ipcRenderer.invoke("aarya:ask", { message })
});

contextBridge.exposeInMainWorld("ybAgentAPI", {
  inspect: () => ipcRenderer.invoke("yb-agent:inspect"),
  verify: () => ipcRenderer.invoke("yb-agent:verify"),
  plan: (task) => ipcRenderer.invoke("yb-agent:plan", { task })
});
