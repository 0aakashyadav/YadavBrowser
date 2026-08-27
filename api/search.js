const { URL, URLSearchParams } = require('node:url');

const ALLOWED_ORIGINS = new Set([
  'https://search.yadavaakash.in',
  'https://yadav-browser.vercel.app',
  'https://yadav-browser-aakash-ccb7.vercel.app'
]);

module.exports = async function handler(req, res) {
  const origin = String(req.headers?.origin || '');
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = String(req.query?.q || '').trim().slice(0, 300);
  if (!q) return res.status(400).json({ error: 'Missing query' });

  const page = Math.max(1, Math.min(20, Number.parseInt(req.query?.page || '1', 10) || 1));
  const mode = ['web', 'news', 'images', 'videos', 'maps', 'shopping'].includes(String(req.query?.mode))
    ? String(req.query.mode) : 'web';
  const timeRange = ['', 'day', 'week', 'month', 'year'].includes(String(req.query?.timeRange))
    ? String(req.query?.timeRange) : '';
  const safeSearch = Math.max(0, Math.min(2, Number.parseInt(req.query?.safeSearch || '1', 10) || 0));

  try {
    // A SearXNG endpoint is optional. Never depend on a public instance by default:
    // public instances frequently rate-limit Vercel serverless traffic.
    const configured = String(process.env.SEARXNG_URL || '').trim().replace(/\/$/, '');
    if (configured) {
      try {
        return res.status(200).json(await fetchSearx(configured, q, mode, page, timeRange, safeSearch));
      } catch (error) {
        console.warn('Configured SearXNG failed:', error?.message || error);
      }
    }

    // News has its own RSS source. Other modes use Bing RSS first.
    if (mode === 'news') {
      try {
        return res.status(200).json(await fetchGoogleNewsRss(q, page));
      } catch (error) {
        console.warn('Google News RSS failed:', error?.message || error);
      }
    }

    try {
      return res.status(200).json(await fetchBingRss(q, page, mode, timeRange));
    } catch (error) {
      console.warn('Bing RSS failed:', error?.message || error);
    }

    try {
      return res.status(200).json(await fetchYahooRss(q, page));
    } catch (error) {
      console.warn('Yahoo RSS failed:', error?.message || error);
    }

    return res.status(200).json({
      provider: 'yadav-fallback',
      query: q,
      results: [],
      suggestions: [],
      numberOfResults: 0,
      warning: 'Search providers temporarily unavailable.'
    });
  } catch (error) {
    console.error('Yadav Search error:', error);
    return res.status(502).json({
      error: 'Search provider unavailable',
      code: error?.name === 'AbortError' ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE'
    });
  }
};

async function fetchText(url, headers = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        accept: 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
        'user-agent': 'YadavSearch/1.1 (+https://search.yadavaakash.in)',
        ...headers
      },
      signal: controller.signal
    });
    const body = await response.text();
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBingRss(q, page, mode, timeRange) {
  const params = new URLSearchParams({
    q,
    format: 'rss',
    first: String((page - 1) * 10 + 1),
    setmkt: 'en-IN'
  });
  if (timeRange) {
    const freshness = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }[timeRange];
    if (freshness) params.set('filters', 'ex1:"ez5_' + freshness + '"');
  }
  const xml = await fetchText('https://www.bing.com/search?' + params);
  const results = parseRss(xml, 'Bing', mode);
  if (!results.length) throw new Error('Bing returned no results');
  return makeResponse('bing-rss', q, results);
}

async function fetchYahooRss(q, page) {
  const url = 'https://search.yahoo.com/rss?' + new URLSearchParams({
    p: q,
    n: '20',
    b: String((page - 1) * 20 + 1)
  });
  const xml = await fetchText(url);
  const results = parseRss(xml, 'Yahoo', 'web');
  if (!results.length) throw new Error('Yahoo returned no results');
  return makeResponse('yahoo-rss', q, results);
}

async function fetchGoogleNewsRss(q, page) {
  const url = 'https://news.google.com/rss/search?' + new URLSearchParams({
    q,
    hl: 'en-IN',
    gl: 'IN',
    ceid: 'IN:en'
  });
  const xml = await fetchText(url);
  const results = parseRss(xml, 'Google News', 'news').slice((page - 1) * 10, page * 10);
  if (!results.length) throw new Error('Google News returned no results');
  return makeResponse('google-news-rss', q, results);
}

function makeResponse(provider, query, results) {
  return {
    provider,
    query,
    results,
    suggestions: [],
    numberOfResults: results.length
  };
}

function parseRss(xml, engine, category) {
  const results = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml))) {
    const item = match[1];
    const title = cleanXml(readTag(item, 'title'));
    const rawUrl = cleanXml(readTag(item, 'link') || readTag(item, 'guid'));
    const url = safeUrl(rawUrl);
    const description = stripTags(cleanXml(readTag(item, 'description') || ''));
    const pubDate = cleanXml(readTag(item, 'pubDate') || readTag(item, 'published') || '');
    if (!title || !url) continue;
    results.push({
      title: title.slice(0, 300),
      url,
      content: description.slice(0, 1000),
      engine,
      category,
      publishedDate: pubDate || null
    });
    if (results.length >= 30) break;
  }
  return results;
}

function readTag(value, tag) {
  const match = String(value).match(new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  return match ? match[1] : '';
}

function cleanXml(value) {
  return decodeHtml(String(value || ''))
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .trim();
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
    const u = new URL(String(value || '').trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}

async function fetchSearx(root, q, mode, page, timeRange, safeSearch) {
  const url = new URL(root + '/search');
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'json');
  url.searchParams.set('categories', mode === 'web' ? 'general' : mode);
  url.searchParams.set('pageno', String(page));
  url.searchParams.set('safesearch', String(safeSearch));
  if (timeRange) url.searchParams.set('time_range', timeRange);

  const body = await fetchText(url.toString(), { accept: 'application/json' });
  const data = JSON.parse(body);
  const results = Array.isArray(data.results) ? data.results.map(item => ({
    title: String(item.title || '').slice(0, 300),
    url: safeUrl(item.url),
    content: String(item.content || '').slice(0, 1000),
    engine: String(item.engine || 'SearXNG'),
    category: String(item.category || mode),
    publishedDate: item.publishedDate || item.published_date || null
  })).filter(x => x.title && x.url).slice(0, 30) : [];

  return {
    provider: 'searxng',
    query: q,
    results,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 8).map(String) : [],
    numberOfResults: Number(data.number_of_results || results.length)
  };
}
