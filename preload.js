const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("browserAPI", {
  navigate: (url) => ipcRenderer.send("navigate", url),
  back: () => ipcRenderer.send("back"),
  forward: () => ipcRenderer.send("forward"),
  reload: () => ipcRenderer.send("reload"),
  newTab: () => ipcRenderer.send("new-tab"),
  closeTab: () => ipcRenderer.send("close-tab"),
  switchTab: (direction) => ipcRenderer.send("switch-tab", direction),
  focusAddressBar: () => ipcRenderer.send("focus-address-bar"),
  aaryaAsk: (message) => ipcRenderer.invoke("aarya:ask", { message }),

  onTabUpdate: (callback) => {
    ipcRenderer.on("tab-update", (_, data) => callback(data));
  },

  onAddressUpdate: (callback) => {
    ipcRenderer.on("address-update", (_, url) => callback(url));
  },

  onFocusAddressBar: (callback) => {
    ipcRenderer.on("focus-address-bar", () => callback());
  }
});
