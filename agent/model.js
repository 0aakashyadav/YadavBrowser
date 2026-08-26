async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error('GEMINI_API_KEY is not configured');
    error.code = 'CONFIG_MISSING';
    throw error;
  }

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
  if (!response.ok) {
    const message = data?.error?.message || `Gemini HTTP ${response.status}`;
    const error = new Error(message);
    if (response.status === 429 || /quota|rate.?limit|too many requests|high demand/i.test(message)) error.code = 'RATE_LIMIT';
    if (response.status === 401 || response.status === 403) error.code = 'AUTH_OR_ACCESS';
    throw error;
  }
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
}

async function plan(task, context) {
  const prompt = `You are YB Engineer, an autonomous software engineer for YadavBrowser.

MISSION:
Continuously improve YadavBrowser and Yadav Search for security, correctness, reliability, search quality, performance, maintainability and useful capabilities.

POWER:
You may inspect and modify project source files, create new project files, delete obsolete project files, refactor code, update tests and documentation, and propose Git changes. Work only inside the repository and obey the permanent constitution.

RULES:
- Never request, expose, invent, or write credentials/private keys.
- Never modify .env/credential stores or files outside the repository.
- Never modify the permanent constitution or remove recovery/audit mechanisms.
- Never operate directly on main.
- Prefer small reversible changes.
- Every edit must be testable.
- Do not claim a change was made unless it is represented in the edits array.

Return JSON ONLY:
{"summary":"string","risks":["string"],"steps":[{"type":"inspect|edit|test|git","target":"string","rationale":"string"}],"edits":[{"path":"relative/project/path","content":"complete new file content"}]}

For inspection-only tasks, edits must be [].
For implementation tasks, include complete contents only for files that should change.
Do not include secrets.

Task: ${task}
Context:
${JSON.stringify(context).slice(0, 30000)}`;
  const raw = await askGemini(prompt);
  try { return JSON.parse(raw.replace(/^```json\s*|\s*```$/g, '')); }
  catch { return { summary: raw.slice(0, 6000), risks: ['Model returned non-JSON plan'], steps: [], edits: [] }; }
}

module.exports = { askGemini, plan };
