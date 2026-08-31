const PROVIDERS = [
  { name: 'gemini', key: 'GEMINI_API_KEY', model: 'GEMINI_MODEL', defaultModel: 'gemini-3.6-flash' },
  { name: 'openrouter', key: 'OPENROUTER_API_KEY', model: 'OPENROUTER_MODEL', defaultModel: 'google/gemini-2.5-flash' }
];

function providerError(message, code, provider) {
  const e = new Error(message);
  e.code = code;
  e.provider = provider;
  return e;
}

async function callProvider(provider, prompt) {
  const apiKey = process.env[provider.key];
  if (!apiKey) throw providerError(`${provider.name} API key is not configured`, 'CONFIG_MISSING', provider.name);

  if (provider.name === 'gemini') {
    const model = process.env[provider.model] || provider.defaultModel;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || `Gemini HTTP ${response.status}`;
      const code = response.status === 429 || /quota|rate.?limit|too many requests|high demand/i.test(message) ? 'RATE_LIMIT' :
        response.status === 401 || response.status === 403 ? 'AUTH_OR_ACCESS' : 'PROVIDER_ERROR';
      throw providerError(message, code, provider.name);
    }
    return data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  }

  const model = process.env[provider.model] || provider.defaultModel;
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2 })
  });
  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || `OpenRouter HTTP ${response.status}`;
    const code = response.status === 429 || /quota|rate.?limit|too many requests/i.test(message) ? 'RATE_LIMIT' :
      response.status === 401 || response.status === 403 ? 'AUTH_OR_ACCESS' : 'PROVIDER_ERROR';
    throw providerError(message, code, provider.name);
  }
  return data?.choices?.[0]?.message?.content || '';
}

async function ask(prompt) {
  const failures = [];
  for (const provider of PROVIDERS) {
    try {
      return await callProvider(provider, prompt);
    } catch (error) {
      failures.push({ provider: provider.name, code: error.code, message: error.message });
      if (!['RATE_LIMIT', 'CONFIG_MISSING', 'AUTH_OR_ACCESS'].includes(error.code)) throw error;
    }
  }
  const error = new Error('All configured AI providers are unavailable: ' + failures.map(x => `${x.provider}=${x.code}`).join(', '));
  error.code = failures.some(x => x.code === 'RATE_LIMIT') ? 'ALL_PROVIDERS_RATE_LIMITED' : 'NO_PROVIDER_AVAILABLE';
  error.failures = failures;
  throw error;
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
  const raw = await ask(prompt);
  try { return JSON.parse(raw.replace(/^\`\`\`json\s*|\s*\`\`\`$/g, '')); }
  catch { return { summary: raw.slice(0, 6000), risks: ['Model returned non-JSON plan'], steps: [], edits: [] }; }
}

module.exports = { ask, askGemini: ask, plan };
