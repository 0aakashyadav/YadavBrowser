async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 }
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

async function plan(task, context) {
  const prompt = `You are YB Engineer, a cautious software-engineering planner for YadavBrowser.\nMission: improve YadavBrowser while preserving security and reliability.\nNever request secrets. Never modify protected credentials. Prefer small reversible changes.\nReturn JSON only with: summary, risks[], steps[]. Each step must have type (inspect|edit|test|git), target, rationale.\nTask: ${task}\nContext:\n${JSON.stringify(context).slice(0, 30000)}`;
  const raw = await askGemini(prompt);
  try { return JSON.parse(raw.replace(/^\`\`\`json\\s*|\\s*\`\`\`$/g, '')); }
  catch { return { summary: raw.slice(0, 6000), risks: ['Model returned non-JSON plan'], steps: [] }; }
}

module.exports = { askGemini, plan };
