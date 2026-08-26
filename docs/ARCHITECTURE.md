# YadavBrowser Architecture

## Layers

### Main process
`main.js` owns the Electron window, BrowserViews, tabs, navigation and IPC handlers.

### Renderer UI
`index.html` owns the browser chrome: tabs, toolbar, address bar, history and bookmarks.

### Preload bridge
`preload.js` exposes the small `window.browserAPI` surface. Renderer code must not receive Node.js or Electron primitives directly.

### AARYA
The `aarya/` layer contains the AI integration. Keep API credentials in environment variables and never expose them to renderer code.

## Important rule
Before changing tab behavior, inspect both `main.js` and `preload.js`. A UI-only change cannot reliably fix BrowserView lifecycle problems.

## Target architecture
The long-term design is a browser shell similar in behavior to Chrome/Edge while retaining YadavBrowser branding and AARYA. Features should be added behind explicit IPC methods and tested independently.
