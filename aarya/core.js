/**
 * AARYA Core
 * Provider-agnostic AI router for YadavBrowser.
 *
 * API keys are intentionally NOT stored here.
 */

const PROVIDERS = Object.freeze({
  GEMINI: "gemini",
  OPENAI: "openai",
  CUSTOM: "custom"
});

function normalizeMessage(message) {
  if (typeof message === "string") return { role: "user", content: message };
  if (!message || typeof message.content !== "string") {
    throw new TypeError("AARYA message must contain string content.");
  }
  return { role: message.role || "user", content: message.content };
}

function chooseProvider({ provider } = {}) {
  if (provider && Object.values(PROVIDERS).includes(provider)) return provider;
  return process.env.AARYA_PROVIDER || PROVIDERS.GEMINI;
}

async function ask({ messages, provider, system } = {}) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError("AARYA requires at least one message.");
  }

  const normalized = messages.map(normalizeMessage);
  const selectedProvider = chooseProvider({ provider });

  switch (selectedProvider) {
    case PROVIDERS.GEMINI:
      return require("./providers/gemini").ask({ messages: normalized, system });
    case PROVIDERS.OPENAI:
      return require("./providers/openai").ask({ messages: normalized, system });
    case PROVIDERS.CUSTOM:
      return require("./providers/custom").ask({ messages: normalized, system });
    default:
      throw new Error(`Unsupported AARYA provider: ${selectedProvider}`);
  }
}

module.exports = { PROVIDERS, ask, normalizeMessage, chooseProvider };
