const { ipcMain } = require("electron");
const aarya = require("./core");

function installAaryaIPC() {
  if (ipcMain.listenerCount("aarya:ask") > 0) return;

  ipcMain.handle("aarya:ask", async (event, payload = {}) => {
    if (!event.senderFrame || !event.senderFrame.url.startsWith("file://")) {
      throw new Error("AARYA request rejected: untrusted renderer.");
    }

    const message = typeof payload.message === "string" ? payload.message.trim() : "";
    if (!message || message.length > 12000) {
      throw new Error("AARYA message is empty or too long.");
    }

    return aarya.ask({
      messages: [{ role: "user", content: message }],
      system: "You are AARYA, the AI assistant built for YadavBrowser. Be accurate, concise, and clearly state uncertainty when information may be incomplete."
    });
  });
}

module.exports = { installAaryaIPC };
