const { ipcMain } = require('electron');

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_REGION = 'in-en';

function baseUrl() {
  return String(process.env.YADAV_SEARCH_URL || '').trim().replace(/\/$/, '');
}

function enabled() {
  return true;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function parseDdgUrl(value) {
  const raw = decodeHtml(value);
  try {
    const u = new URL(raw, 'https://duckduckgo.com');
    const target = u.searchParams.get('uddg');
    return safeUrl(target || raw);
  } catch {
    return safeUrl(raw);
  }
}

async function fetchText(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'YadavBrowser/1.0 (Yadav Search)',
        'Accept-Language': 'en-IN,en;q=0.9',
        ...headers
      },
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function parseDdgResults(html, query, mode) {
  const results = [];
  const seen = new Set();
  const blockRegex = /<div[^>]+class=["'][^"']*result[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;
  const blocks = html.match(blockRegex) || [];

  for (const block of blocks) {
    const link = block.match(/<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!link) continue;
    const url = parseDdgUrl(link[1]);
    const title = stripTags(link[2]);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);

    const snippetMatch = block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
      || block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    const urlTextMatch = block.match(/class=["'][^"']*result__url[^"']*["'][^>]*>([\s\S]*?)<\//i);
    results.push({
      title,
      url,
      content: snippetMatch ? stripTags(snippetMatch[1]) : stripTags(urlTextMatch ? urlTextMatch[1] : ''),
      engine: 'Yadav Search',
      category: mode,
      score: Math.max(0, 1 - results.length * 0.03),
      publishedDate: null,
      thumbnail: null
    });
    if (results.length >= 30) break;
  }

  // The HTML layout can change. This secondary parser is intentionally simpler.
  if (!results.length) {
    const linkRegex = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html))) {
      const url = parseDdgUrl(match[1]);
      const title = stripTags(match[2]);
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      results.push({ title, url, content: `Search result for ${query}`, engine: 'Yadav Search', category: mode, score: 1 - results.length * 0.03, publishedDate: null, thumbnail: null });
      if (results.length >= 30) break;
    }
  }
  return results;
}

async function ddgSearch({ q, mode = 'web', page = 1, timeRange = '', safeSearch = 1 }) {
  const query = String(q || '').trim();
  const params = new URLSearchParams();
  params.set('q', query);
  params.set('kl', DEFAULT_REGION);
  params.set('kp', safeSearch === 2 ? '1' : safeSearch === 0 ? '-2' : '-1');
  params.set('s', String(Math.max(0, (Number(page) - 1) * 30)));
  if (timeRange === 'day') params.set('df', 'd');
  if (timeRange === 'week') params.set('df', 'w');
  if (timeRange === 'month') params.set('df', 'm');
  if (timeRange === 'year') params.set('df', 'y');

  // Keep the first implementation provider-independent. DDG's HTML endpoint
  // gives Yadav Search real results immediately; a SearXNG endpoint can still
  // be configured later through YADAV_SEARCH_URL for richer aggregation.
  const html = await fetchText(`https://html.duckduckgo.com/html/?${params.toString()}`);
  const results = parseDdgResults(html, query, mode);
  return {
    enabled: true,
    provider: 'duckduckgo-html',
    query,
    numberOfResults: results.length,
    results,
    suggestions: [],
    answers: [],
    corrections: [],
    infoboxes: [],
    unresponsiveEngines: []
  };
}

async function requestSearx({ q, mode = 'web', page = 1, language = 'en', timeRange = '', safeSearch = 1 }) {
  const root = baseUrl();
  const categories = mode === 'news' ? 'news' : mode === 'images' ? 'images' : mode === 'videos' ? 'videos' : 'general';
  const url = new URL(`${root}/search`);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', categories);
  url.searchParams.set('pageno', String(Math.max(1, Number(page) || 1)));
  url.searchParams.set('language', language || 'en');
  url.searchParams.set('safesearch', String(Math.min(2, Math.max(0, Number(safeSearch) || 1))));
  if (timeRange) url.searchParams.set('time_range', timeRange);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'YadavBrowser/1.0' }, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(`Search provider returned HTTP ${response.status}.`);
    return {
      enabled: true,
      provider: 'searxng',
      query: data.query || q,
      numberOfResults: Number(data.number_of_results || 0),
      results: Array.isArray(data.results) ? data.results.map(normalizeResult).filter(x => x.url && x.title) : [],
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8) : [],
      answers: Array.isArray(data.answers) ? data.answers.slice(0, 4) : [],
      corrections: Array.isArray(data.corrections) ? data.corrections.slice(0, 4) : [],
      infoboxes: Array.isArray(data.infoboxes) ? data.infoboxes.slice(0, 3) : [],
      unresponsiveEngines: Array.isArray(data.unresponsive_engines) ? data.unresponsive_engines : []
    };
  } finally {
    clearTimeout(timer);
  }
}

async function requestSearch(payload = {}) {
  const q = String(payload.q || '').trim();
  if (!q || q.length > 500) throw new Error('Invalid search query.');

  // Prefer a configured SearXNG deployment. Otherwise Yadav Search works
  // immediately with its built-in privacy-preserving HTML provider.
  if (baseUrl()) {
    try { return await requestSearx({ ...payload, q }); }
    catch (error) { console.warn('Yadav Search SearXNG failed, using fallback:', error.message); }
  }

  return ddgSearch(payload);
}

function normalizeResult(item) {
  return {
    title: stripTags(item.title || ''),
    url: safeUrl(item.url || ''),
    content: stripTags(item.content || ''),
    engine: String(item.engine || 'web'),
    category: String(item.category || ''),
    score: Number(item.score || 0),
    publishedDate: item.publishedDate || item.published_date || null,
    thumbnail: item.thumbnail || null
  };
}

function installSearchIPC() {
  if (ipcMain.listenerCount('yadav:search') === 0) {
    ipcMain.handle('yadav:search', async (_event, payload = {}) => requestSearch(payload));
  }
  if (ipcMain.listenerCount('yadav:search-status') === 0) {
    ipcMain.handle('yadav:search-status', async () => ({
      enabled: true,
      endpoint: baseUrl() || 'built-in DuckDuckGo HTML provider'
    }));
  }
}

module.exports = { installSearchIPC, requestSearch };
