const { app, session } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

require("./bridge").installAaryaIPC();
require("../search/bridge").installSearchIPC();

const preloadPath = path.join(__dirname, "preload.js");
const uiPath = path.join(__dirname, "ui.js");

app.whenReady().then(async () => {
  try {
    await session.defaultSession.registerPreloadScript({
      type: "frame",
      filePath: preloadPath
    });
  } catch (error) {
    console.error("AARYA preload registration failed:", error);
  }

  app.on("web-contents-created", (_event, contents) => {
    if (contents.getType() !== "browserView") return;

    contents.on("did-finish-load", async () => {
      const url = contents.getURL();
      if (!url.startsWith("file://")) return;

      try {
        const script = fs.readFileSync(uiPath, "utf8");
        await contents.executeJavaScript(script, true);
      } catch (error) {
        console.error("AARYA UI injection failed:", error);
      }
    });
  });

  require("../main");
});
