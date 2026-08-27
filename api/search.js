export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://search.yadavaakash.in');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = String(req.query?.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const upstream = String(process.env.SEARXNG_URL || '').trim().replace(/\/$/, '');
  if (!upstream) return res.status(503).json({ error: 'Search backend is not configured', code: 'SEARXNG_URL_MISSING' });

  const page = Math.max(1, Math.min(20, Number.parseInt(req.query?.page || '1', 10) || 1));
  const modes = ['web', 'news', 'images', 'videos', 'maps', 'shopping'];
  const mode = modes.includes(String(req.query?.mode)) ? String(req.query.mode) : 'web';
  const timeRange = ['', 'day', 'week', 'month', 'year'].includes(String(req.query?.timeRange)) ? String(req.query.timeRange) : '';
  const safeSearch = Math.max(0, Math.min(2, Number.parseInt(req.query?.safeSearch || '1', 10) || 0));

  const categories = mode === 'web' ? 'general' : mode;
  const url = new URL(upstream + '/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', categories);
  url.searchParams.set('pageno', String(page));
  url.searchParams.set('safesearch', String(safeSearch));
  if (timeRange) url.searchParams.set('time_range', timeRange);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'YadavSearch/1.0 (+https://search.yadavaakash.in)' },
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) return res.status(502).json({ error: 'Search provider returned an error', code: 'UPSTREAM_ERROR', status: response.status });

    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ error: 'Search provider returned invalid JSON', code: 'UPSTREAM_FORMAT' }); }

    const results = Array.isArray(data.results)
      ? data.results.slice(0, 30).map(item => ({
          title: String(item.title || '').slice(0, 300),
          url: String(item.url || ''),
          content: String(item.content || '').slice(0, 1000),
          engine: String(item.engine || 'SearXNG')
        })).filter(item => /^https?:\/\//i.test(item.url))
      : [];

    return res.status(200).json({
      provider: 'searxng',
      query: q,
      results,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8).map(String) : [],
      numberOfResults: Number(data.number_of_results || results.length)
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Search provider unavailable',
      code: error?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE'
    });
  } finally {
    clearTimeout(timeout);
  }
}
