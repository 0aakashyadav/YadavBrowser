const { GoogleGenAI } = require("@google/genai");

const DEFAULT_MODEL = "gemini-3.6-flash";

async function ask({ messages, system } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("AARYA: GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({
    apiKey
  });

  const contents = messages.map((message) => ({
    role:
      message.role === "assistant" || message.role === "model"
        ? "model"
        : "user",
    parts: [
      {
        text: message.content
      }
    ]
  }));

  const config = {};

  if (system) {
    config.systemInstruction = system;
  }

  const response = await ai.models.generateContent({
    model: process.env.AARYA_GEMINI_MODEL || DEFAULT_MODEL,
    contents,
    config
  });

  const text = response.text;

  if (!text) {
    throw new Error("AARYA Gemini returned no text output.");
  }

  return {
    provider: "gemini",
    model: process.env.AARYA_GEMINI_MODEL || DEFAULT_MODEL,
    text
  };
}

module.exports = {
  ask
};