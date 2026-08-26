const fs = require("node:fs");
const path = require("node:path");
const electron = require("electron");
const { app } = electron;

require("./bridge").installAaryaIPC();

/*
 * Browser tabs are BrowserViews created by main.js.
 * Give those views the same preload bridge as the main window
 * so AARYA can communicate with the main process.
 */
const OriginalBrowserView = electron.BrowserView;
const preloadPath = path.join(__dirname, "..", "preload.js");

electron.BrowserView = function AaryaBrowserView(options = {}) {
  const webPreferences = {
    ...(options.webPreferences || {}),
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false
  };

  return new OriginalBrowserView({
    ...options,
    webPreferences
  });
};

/*
 * Install AARYA UI into local file:// pages, including BrowserViews.
 * Electron's web-contents-created event covers BrowserViews as well
 * as BrowserWindows.
 */
const uiFiles = [
  path.join(__dirname, "ui.js"),
  path.join(__dirname, "ui-bootstrap.js")
];

function injectAaryaUI(webContents) {
  webContents.on("did-finish-load", () => {
    const url = webContents.getURL();
    if (!url.startsWith("file://")) return;

    try {
      const scripts = uiFiles.map((file) => fs.readFileSync(file, "utf8"));
      webContents.executeJavaScript(scripts.join("\n"), false).catch((error) => {
        console.error("AARYA UI injection failed:", error);
      });
    } catch (error) {
      console.error("AARYA UI load failed:", error);
    }
  });
}

app.on("web-contents-created", (_event, webContents) => {
  injectAaryaUI(webContents);
});

require("../main");
