const { ipcMain } = require('electron');

const DEFAULT_TIMEOUT_MS = 8000;

function baseUrl() {
  return String(process.env.YADAV_SEARCH_URL || '').trim().replace(/\/$/, '');
}

function enabled() {
  return Boolean(baseUrl());
}

async function requestSearch({ q, mode = 'web', page = 1, language = 'en', timeRange = '', safeSearch = 1 } = {}) {
  const query = String(q || '').trim();
  if (!query || query.length > 500) throw new Error('Invalid search query.');

  const root = baseUrl();
  if (!root) {
    return { enabled: false, query, results: [], suggestions: [], message: 'YADAV_SEARCH_URL is not configured.' };
  }

  const categories = mode === 'news' ? 'news' : mode === 'images' ? 'images' : mode === 'videos' ? 'videos' : 'general';
  const url = new URL(`${root}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', categories);
  url.searchParams.set('pageno', String(Math.max(1, Number(page) || 1)));
  url.searchParams.set('language', language || 'en');
  url.searchParams.set('safesearch', String(Math.min(2, Math.max(0, Number(safeSearch) || 1))));
  if (timeRange) url.searchParams.set('time_range', timeRange);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || `Search provider returned HTTP ${response.status}.`);

    return {
      enabled: true,
      query: data.query || query,
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

function normalizeResult(item) {
  return {
    title: String(item.title || '').replace(/<[^>]*>/g, ''),
    url: String(item.url || ''),
    content: String(item.content || '').replace(/<[^>]*>/g, ''),
    engine: String(item.engine || ''),
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
    ipcMain.handle('yadav:search-status', async () => ({ enabled: enabled(), endpoint: enabled() ? baseUrl() : null }));
  }
}

module.exports = { installSearchIPC, requestSearch };
