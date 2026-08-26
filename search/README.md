# Yadav Search

Yadav Search is the search layer for YadavBrowser. It is intentionally separated from the browser UI so the search provider can be changed without rewriting the frontend.

## Architecture

```text
Yadav Search UI
      |
      | Electron IPC
      v
search/bridge.js
      |
      | HTTP JSON API
      v
SearXNG / compatible metasearch endpoint
      |
      +--> web engines
      +--> news engines
      +--> image engines
      +--> video engines
```

The design follows the useful architectural ideas of privacy-oriented metasearch projects such as SearXNG and fast search systems such as Meilisearch/Typesense: provider separation, normalized results, categories, pagination, suggestions, typo-tolerant/provider-side search, and a frontend that does not need to know the upstream engine implementation.

## Local configuration

Set `YADAV_SEARCH_URL` to a SearXNG instance that exposes the JSON format. Example for a local instance:

```powershell
$env:YADAV_SEARCH_URL="http://127.0.0.1:8080"
npm start
```

The endpoint should support:

```text
GET /search?q=<query>&format=json
```

For a production deployment, put Yadav Search behind your own HTTPS domain and configure the same environment variable there.

## Supported search controls

- Web
- News
- Images
- Videos
- Pagination
- Safe search levels
- Time ranges
- Search suggestions
- Related searches
- Quick answers when supplied by the provider
- Direct URL navigation
- Open result / open in new tab
- Recent searches stored locally in the browser

## Important limitation

Yadav Search is currently a metasearch layer, not a crawler and independent global web index. Building a Google-scale crawler/index requires substantial infrastructure. The provider boundary lets us add our own crawler, index, ranking and caching later without changing the search UI contract.
