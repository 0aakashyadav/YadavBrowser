# Yadav Search Web Deployment

Architecture:
search.yadavaakash.in -> Vercel -> /api/search -> your SearXNG instance -> search engines.

GitHub Pages is intentionally not used for the API because GitHub Pages serves static files and does not execute server-side code.

Set the Vercel environment variable:
SEARXNG_URL=https://YOUR-SEARXNG-HOST

The SearXNG instance must expose JSON search results.

Attach search.yadavaakash.in to the Vercel project.
Keep browser.yadavaakash.in on GitHub Pages.

Never put API keys or private credentials in this repository.
