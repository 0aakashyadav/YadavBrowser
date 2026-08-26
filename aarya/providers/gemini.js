/**
 * AARYA — Gemini provider
 *
 * Uses Google's current Interactions API. The API key must come from
 * GEMINI_API_KEY in the process environment; never commit it to GitHub.
 */

const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const DEFAULT_MODEL = "gemini-3.7-flash";

async function ask({ messages, system, previousInteractionId } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("AARYA: GEMINI_API_KEY is not configured.");
  }

  const input = messages.map((message) => ({
    type: message.role === "assistant" || message.role === "model" ? "model_output" : "user_input",
    content: [{ type: "text", text: message.content }]
  }));

  const body = {
    model: process.env.AARYA_GEMINI_MODEL || DEFAULT_MODEL,
    input: input.length === 1 ? input[0].content[0].text : input,
  };

  if (system) body.system_instruction = system;
  if (previousInteractionId) body.previous_interaction_id = previousInteractionId;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    const detail = data?.error?.message || `HTTP ${response.status}`;
    throw new Error(`AARYA Gemini error: ${detail}`);
  }

  const text = data?.output_text || extractText(data);
  if (!text) throw new Error("AARYA Gemini returned no text output.");

  return {
    provider: "gemini",
    model: body.model,
    text,
    interactionId: data.id || null,
    raw: data,
  };
}

function extractText(data) {
  for (const step of data?.steps || []) {
    if (step.type !== "model_output") continue;
    for (const block of step.content || []) {
      if (block.type === "text" && block.text) return block.text;
    }
  }
  return null;
}

module.exports = { ask };
