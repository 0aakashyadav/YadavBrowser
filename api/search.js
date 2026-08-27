export default async function handler(req, res) {
  const origin = String(req.headers?.origin || '');
  const allowedOrigins = new Set([
    'https://search.yadavaakash.in',
    'https://yadav-browser.vercel.app',
    'https://yadav-browser-aakash-ccb7.vercel.app'
  ]);
  if (allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = String(req.query?.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const page = Math.max(1, Math.min(20, Number.parseInt(req.query?.page || '1', 10) || 1));
  const modes = ['web', 'news', 'images', 'videos', 'maps', 'shopping'];
  const mode = modes.includes(String(req.query?.mode)) ? String(req.query.mode) : 'web';
  const timeRange = ['', 'day', 'week', 'month', 'year'].includes(String(req.query?.timeRange))
    ? String(req.query?.timeRange) : '';
  const safeSearch = Math.max(0, Math.min(2, Number.parseInt(req.query?.safeSearch || '1', 10) || 0));

  try {
    const searxng = String(process.env.SEARXNG_URL || '').trim().replace(/\/$/, '');
    if (searxng) {
      try {
        return res.status(200).json(await fetchSearx(searxng, q, mode, page, timeRange, safeSearch));
      } catch (error) {
        console.warn('SearXNG failed; using built-in provider:', error?.message || error);
      }
    }
    return res.status(200).json(await fetchDuckDuckGo(q, page, timeRange, safeSearch));
  } catch (error) {
    console.error('Yadav Search error:', error);
    return res.status(502).json({
      error: 'Search provider unavailable',
      code: error?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE'
    });
  }
}

async function fetchDuckDuckGo(q, page, timeRange, safeSearch) {
  const params = new URLSearchParams({
    q,
    kl: 'in-en',
    kp: safeSearch === 2 ? '1' : safeSearch === 0 ? '-2' : '-1',
    s: String((page - 1) * 30)
  });
  const df = ({ day: 'd', week: 'w', month: 'm', year: 'y' })[timeRange];
  if (df) params.set('df', df);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch('https://html.duckduckgo.com/html/?' + params.toString(), {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'YadavSearch/1.0 (+https://search.yadavaakash.in)'
      },
      signal: controller.signal
    });
    const html = await response.text();
    if (!response.ok) throw new Error('DuckDuckGo HTTP ' + response.status);
    const results = parseDuckDuckGo(html).slice(0, 30);
    return { provider: 'yadav-built-in', query: q, results, suggestions: [], numberOfResults: results.length };
  } finally {
    clearTimeout(timer);
  }
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
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

function parseDuckDuckGoUrl(value) {
  const raw = decodeHtml(value);
  try {
    const u = new URL(raw, 'https://duckduckgo.com');
    return safeUrl(u.searchParams.get('uddg') || raw);
  } catch {
    return safeUrl(raw);
  }
}

function parseDuckDuckGo(html) {
  const results = [];
  const seen = new Set();
  const linkRe = /<a[^>]+class=["'][^"']*result__a[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkRe.exec(html))) {
    const url = parseDuckDuckGoUrl(match[1]);
    const title = stripTags(match[2]);
    if (!url || !title || seen.has(url)) continue;

    const start = Math.max(0, match.index - 1200);
    const block = html.slice(start, Math.min(html.length, match.index + 5000));
    const snippet =
      block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
      block.match(/class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] ||
      '';

    seen.add(url);
    results.push({
      title: title.slice(0, 300),
      url,
      content: stripTags(snippet).slice(0, 1000),
      engine: 'Yadav Search'
    });
    if (results.length >= 30) break;
  }
  return results;
}

async function fetchSearx(searxng, q, mode, page, timeRange, safeSearch) {
  const categories = mode === 'web' ? 'general' : mode;
  const url = new URL(searxng + '/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', categories);
  url.searchParams.set('pageno', String(page));
  url.searchParams.set('safesearch', String(safeSearch));
  if (timeRange) url.searchParams.set('time_range', timeRange);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': 'YadavSearch/1.0 (+https://search.yadavaakash.in)' },
      signal: controller.signal
    });
    const body = await response.text();
    if (!response.ok) throw new Error('SearXNG HTTP ' + response.status);

    const data = JSON.parse(body);
    const results = Array.isArray(data.results)
      ? data.results.slice(0, 30).map(item => ({
          title: String(item.title || '').slice(0, 300),
          url: String(item.url || ''),
          content: String(item.content || '').slice(0, 1000),
          engine: String(item.engine || 'SearXNG')
        })).filter(item => /^https?:\/\//i.test(item.url))
      : [];

    return {
      provider: 'searxng',
      query: q,
      results,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8).map(String) : [],
      numberOfResults: Number(data.number_of_results || results.length)
    };
  } finally {
    clearTimeout(timer);
  }
}
