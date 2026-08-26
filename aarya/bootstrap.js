const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");

require("./bridge").installAaryaIPC();

const uiFiles = [
  path.join(__dirname, "ui.js"),
  path.join(__dirname, "ui-bootstrap.js")
];

app.on("browser-window-created", (_event, window) => {
  window.webContents.on("did-finish-load", () => {
    if (!window.webContents.getURL().startsWith("file://")) return;

    try {
      const scripts = uiFiles.map((file) => fs.readFileSync(file, "utf8"));
      const combined = scripts.join("\n");
      window.webContents.executeJavaScript(combined, false).catch((error) => {
        console.error("AARYA UI injection failed:", error);
      });
    } catch (error) {
      console.error("AARYA UI load failed:", error);
    }
  });
});

require("../main");
