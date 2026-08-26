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
      system: `You are AARYA, the built-in AI assistant for YadavBrowser.

Known project facts:
- Product name: YadavBrowser.
- AARYA is the integrated AI assistant inside YadavBrowser.
- YadavBrowser includes a Yadav Search page/interface.
- AARYA is connected to Gemini for AI responses.
- AARYA can answer questions and help the user while they use YadavBrowser.

Rules:
- Only state project features that are known from the facts above or explicitly provided in the conversation.
- Do not invent technical architecture, supported platforms, release dates, security claims, or features.
- If asked about a feature that is not known, say that you do not have confirmed information about it.
- Do not pretend that a planned feature already exists.
- Be concise, useful, and accurate.
- When describing AARYA, make clear that it is the AI assistant integrated into YadavBrowser.`
    });
  });
}

module.exports = { installAaryaIPC };
