const { app, BrowserWindow, BrowserView, ipcMain, session, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tabs = [];
let activeTab = 0;
let findRequestId = 0;
let downloads = [];
const downloadSessions = new WeakSet();

const TOOLBAR_HEIGHT = 108;
const HOME_URL = `file://${path.join(__dirname, 'yadav-search.html')}`;
const DATA_DIR = () => path.join(app.getPath('userData'), 'yadavbrowser-data');
const HISTORY_FILE = () => path.join(DATA_DIR(), 'history.json');
const BOOKMARKS_FILE = () => path.join(DATA_DIR(), 'bookmarks.json');

function ensureDataDir() { fs.mkdirSync(DATA_DIR(), { recursive: true }); }
function readJson(file, fallback) {
  try { ensureDataDir(); return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch (e) { console.error(e); return fallback; }
}
function writeJson(file, value) {
  try { ensureDataDir(); fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8'); return true; }
  catch (e) { console.error(e); return false; }
}

let historyItems = readJson(HISTORY_FILE(), []);
let bookmarks = readJson(BOOKMARKS_FILE(), []);
if (!Array.isArray(historyItems)) historyItems = [];
if (!Array.isArray(bookmarks)) bookmarks = [];

function addHistory(url, title) {
  if (!url || url.startsWith('file://') || url.startsWith('devtools://') || url.startsWith('about:')) return;
  const item = { title: title || 'Untitled', url, visitedAt: new Date().toISOString() };
  historyItems = historyItems.filter(x => x.url !== url);
  historyItems.unshift(item);
  historyItems = historyItems.slice(0, 2000);
  writeJson(HISTORY_FILE(), historyItems);
}
function isBookmarked(url) { return bookmarks.some(x => x.url === url); }
function send(channel, data) { if (win && !win.isDestroyed()) win.webContents.send(channel, data); }
function sendAddressUpdate(url) { send('address-update', url || ''); }
function sendBookmarkState() {
  const tab = tabs[activeTab];
  send('bookmark-state', { bookmarked: !!tab && !tab.private && isBookmarked(tab.url), private: !!tab?.private });
}
function sendTabUpdate() {
  send('tab-update', {
    activeIndex: activeTab,
    tabs: tabs.map(t => ({ title: t.title || (t.private ? 'Private Tab' : 'New Tab'), url: t.url || '', private: !!t.private }))
  });
}
function sendLoading(tab, loading) { if (tabs[activeTab] === tab) send('loading-state', loading); }
function updateViewBounds() {
  if (!win || win.isDestroyed() || !tabs[activeTab]) return;
  const [width, height] = win.getContentSize();
  tabs[activeTab].view.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
}
function updateActiveView() {
  if (!win || win.isDestroyed() || !tabs[activeTab]) return;
  win.setBrowserView(tabs[activeTab].view);
  updateViewBounds();
  sendAddressUpdate(tabs[activeTab].url);
  sendBookmarkState();
}
function normalizeUrl(input) {
  let url = String(input || '').trim();
  if (!url) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) return url;
  if (url.includes('.') && !url.includes(' ')) return `https://${url}`;
  return `https://www.google.com/search?q=${encodeURIComponent(url)}`;
}

function createTab(url = HOME_URL, options = {}) {
  const isPrivate = !!options.private;
  const partition = isPrivate ? `yadav-private-${Date.now()}-${Math.random().toString(36).slice(2)}` : undefined;
  const view = new BrowserView({ webPreferences: { contextIsolation: true, nodeIntegration: false, partition } });
  const tab = { view, title: isPrivate ? 'Private Tab' : 'New Tab', url, private: isPrivate, partition };
  tabs.push(tab);

  view.webContents.loadURL(url);
  view.webContents.setWindowOpenHandler(({ url: target }) => { createNewTab(target, { private: tab.private }); return { action: 'deny' }; });

  view.webContents.on('page-title-updated', (event, title) => {
    event.preventDefault(); tab.title = title || (tab.private ? 'Private Tab' : 'New Tab'); sendTabUpdate();
  });
  view.webContents.on('did-start-loading', () => sendLoading(tab, true));
  view.webContents.on('did-stop-loading', () => sendLoading(tab, false));
  view.webContents.on('did-navigate', (_, newURL) => {
    tab.url = newURL;
    if (!tab.private) addHistory(newURL, tab.title);
    if (tabs[activeTab] === tab) { sendAddressUpdate(newURL); sendTabUpdate(); sendBookmarkState(); }
  });
  view.webContents.on('did-navigate-in-page', (_, newURL) => {
    tab.url = newURL;
    if (tabs[activeTab] === tab) { sendAddressUpdate(newURL); sendBookmarkState(); }
  });
  view.webContents.on('render-process-gone', (_, details) => console.error('Renderer gone:', details.reason));

  view.webContents.on('before-input-event', (event, input) => handleShortcut(event, input));
  installDownloadHandling(tab);
  return tab;
}

function installDownloadHandling(tab) {
  const downloadSession = tab.view.webContents.session;
  if (downloadSessions.has(downloadSession)) return;
  downloadSessions.add(downloadSession);

  downloadSession.on('will-download', (_, item) => {
    const filename = item.getFilename() || 'download';
    const downloadsDir = app.getPath('downloads');
    let savePath = path.join(downloadsDir, filename);
    let counter = 1;
    const ext = path.extname(filename);
    const stem = ext ? filename.slice(0, -ext.length) : filename;
    while (fs.existsSync(savePath)) savePath = path.join(downloadsDir, `${stem} (${counter++})${ext}`);

    item.setSavePath(savePath);
    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      filename: path.basename(savePath),
      savePath,
      state: 'starting',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startedAt: new Date().toISOString(),
      private: !!tab.private
    };
    downloads.unshift(record);
    downloads = downloads.slice(0, 100);
    send('download-update', record);
    send('downloads-update', downloads);

    item.on('updated', (_, state) => {
      Object.assign(record, { state, receivedBytes: item.getReceivedBytes(), totalBytes: item.getTotalBytes() });
      send('download-update', record);
      send('downloads-update', downloads);
    });
    item.once('done', (_, state) => {
      Object.assign(record, { state, receivedBytes: item.getReceivedBytes(), totalBytes: item.getTotalBytes(), finishedAt: new Date().toISOString() });
      send('download-update', record);
      send('downloads-update', downloads);
    });
  });
}

function createNewTab(url = HOME_URL, options = {}) {
  const tab = createTab(url, options);
  activeTab = tabs.length - 1;
  updateActiveView(); sendTabUpdate(); sendAddressUpdate(tab.url); sendBookmarkState();
}
function createPrivateTab() { createNewTab(HOME_URL, { private: true }); }
function closeActiveTab() {
  if (tabs.length <= 1) return;
  const tab = tabs[activeTab];
  try { if (tab && !tab.view.webContents.isDestroyed()) tab.view.webContents.destroy(); } catch (e) { console.error(e); }
  tabs.splice(activeTab, 1);
  if (activeTab >= tabs.length) activeTab = tabs.length - 1;
  updateActiveView(); sendTabUpdate(); sendAddressUpdate(tabs[activeTab]?.url || HOME_URL); sendBookmarkState();
}
function switchToTab(index) {
  if (!Number.isInteger(index) || index < 0 || index >= tabs.length) return;
  activeTab = index; updateActiveView(); sendTabUpdate(); sendAddressUpdate(tabs[activeTab].url); sendBookmarkState();
}
function nextTab() { if (tabs.length > 1) switchToTab((activeTab + 1) % tabs.length); }
function previousTab() { if (tabs.length > 1) switchToTab((activeTab - 1 + tabs.length) % tabs.length); }

function bookmarkActivePage() {
  const tab = tabs[activeTab];
  if (!tab || tab.private || !tab.url || tab.url.startsWith('file://')) return { success: false, reason: tab?.private ? 'private-tab' : 'invalid-url' };
  if (isBookmarked(tab.url)) {
    bookmarks = bookmarks.filter(x => x.url !== tab.url);
    writeJson(BOOKMARKS_FILE(), bookmarks); sendBookmarkState(); send('bookmarks-update', bookmarks); return { success: true, bookmarked: false };
  }
  const bookmark = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, title: tab.title || 'Untitled', url: tab.url, createdAt: new Date().toISOString() };
  bookmarks.unshift(bookmark); writeJson(BOOKMARKS_FILE(), bookmarks); sendBookmarkState(); send('bookmarks-update', bookmarks); return { success: true, bookmarked: true, bookmark };
}

function handleShortcut(event, input) {
  if (input.type !== 'keyDown') return;
  const key = String(input.key || '').toLowerCase();
  if (input.control && !input.alt && !input.shift && key === 't') { event.preventDefault(); createNewTab(); }
  else if (input.control && !input.alt && !input.shift && key === 'w') { event.preventDefault(); closeActiveTab(); }
  else if (input.control && !input.alt && key === 'tab') { event.preventDefault(); input.shift ? previousTab() : nextTab(); }
  else if (input.control && !input.alt && /^[1-9]$/.test(input.key)) { event.preventDefault(); switchToTab(Number(input.key) - 1); }
  else if (input.control && !input.alt && !input.shift && key === 'l') { event.preventDefault(); send('focus-address-bar'); }
  else if (input.control && !input.alt && !input.shift && key === 'r') { event.preventDefault(); tabs[activeTab]?.view.webContents.reload(); }
  else if (input.control && !input.alt && !input.shift && key === 'd') { event.preventDefault(); bookmarkActivePage(); }
  else if (input.control && !input.alt && !input.shift && key === 'h') { event.preventDefault(); send('show-history', historyItems); }
  else if (input.control && !input.alt && input.shift && key === 'j') { event.preventDefault(); send('show-downloads', downloads); }
  else if (input.control && input.shift && key === 'b') { event.preventDefault(); send('show-bookmarks', bookmarks); }
  else if (input.control && input.shift && key === 'i') { event.preventDefault(); tabs[activeTab]?.view.webContents.openDevTools({ mode: 'detach' }); }
  else if (input.control && (key === '+' || key === '=')) { event.preventDefault(); zoom(0.1); }
  else if (input.control && key === '-') { event.preventDefault(); zoom(-0.1); }
  else if (input.control && key === '0') { event.preventDefault(); zoom(0); }
  else if (input.control && !input.alt && !input.shift && key === 'f') { event.preventDefault(); send('open-find'); }
  else if (key === 'f11') { event.preventDefault(); toggleFullscreen(); }
}
function zoom(delta) {
  const wc = tabs[activeTab]?.view.webContents; if (!wc) return;
  const next = delta === 0 ? 1 : Math.min(3, Math.max(0.25, wc.getZoomFactor() + delta));
  wc.setZoomFactor(next); send('zoom-update', next);
}
function toggleFullscreen() { if (win && !win.isDestroyed()) win.setFullScreen(!win.isFullScreen()); }

function createMenu() {
  const template = [
    { label: 'File', submenu: [
      { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => createNewTab() },
      { label: 'New Private Tab', accelerator: 'CmdOrCtrl+Shift+N', click: () => createPrivateTab() },
      { type: 'separator' }, { label: 'Print', accelerator: 'CmdOrCtrl+P', click: () => printActive() },
      { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => closeActiveTab() }
    ]},
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
    ]},
    { label: 'View', submenu: [
      { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => tabs[activeTab]?.view.webContents.reload() },
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => zoom(0.1) },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.1) },
      { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => zoom(0) },
      { label: 'Developer Tools', accelerator: 'CmdOrCtrl+Shift+I', click: () => tabs[activeTab]?.view.webContents.openDevTools({ mode: 'detach' }) },
      { label: 'Fullscreen', accelerator: 'F11', click: toggleFullscreen }
    ]},
    { label: 'History', submenu: [{ label: 'Show History', accelerator: 'CmdOrCtrl+H', click: () => send('show-history', historyItems) }, { label: 'Clear History', click: () => { historyItems = []; writeJson(HISTORY_FILE(), historyItems); send('history-update', historyItems); } }] },
    { label: 'Downloads', submenu: [{ label: 'Show Downloads', accelerator: 'CmdOrCtrl+Shift+J', click: () => send('show-downloads', downloads) }, { label: 'Clear Download List', click: () => { downloads = []; send('downloads-update', downloads); } }] },
    { label: 'Bookmarks', submenu: [{ label: 'Show Bookmarks', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('show-bookmarks', bookmarks) }, { label: 'Bookmark This Page', accelerator: 'CmdOrCtrl+D', click: bookmarkActivePage }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    { label: 'Help', submenu: [{ label: 'About YadavBrowser', click: () => send('about') }] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function printActive() { const wc = tabs[activeTab]?.view.webContents; if (wc) wc.print({ printBackground: true }); }

function createWindow() {
  win = new BrowserWindow({ width: 1280, height: 800, minWidth: 800, minHeight: 500, title: 'YadavBrowser', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  createMenu();
  createTab(); activeTab = 0;
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('did-finish-load', () => { updateActiveView(); sendTabUpdate(); sendAddressUpdate(tabs[activeTab]?.url); sendBookmarkState(); });
  win.on('resize', updateViewBounds);
  win.on('closed', () => { win = null; });
  win.webContents.on('before-input-event', (event, input) => handleShortcut(event, input));
}

ipcMain.on('navigate', (_, url) => { const tab = tabs[activeTab]; const target = normalizeUrl(url); if (!tab || !target) return; tab.url = target; tab.view.webContents.loadURL(target); sendAddressUpdate(target); });
ipcMain.on('back', () => tabs[activeTab]?.view.webContents.canGoBack() && tabs[activeTab].view.webContents.goBack());
ipcMain.on('forward', () => tabs[activeTab]?.view.webContents.canGoForward() && tabs[activeTab].view.webContents.goForward());
ipcMain.on('reload', () => tabs[activeTab]?.view.webContents.reload());
ipcMain.on('stop', () => tabs[activeTab]?.view.webContents.stop());
ipcMain.on('new-tab', () => createNewTab());
ipcMain.on('new-private-tab', () => createPrivateTab());
ipcMain.on('close-tab', closeActiveTab);
ipcMain.on('switch-tab', (_, index) => switchToTab(index));
ipcMain.on('focus-address-bar', () => send('focus-address-bar'));
ipcMain.on('open-new-tab', (_, url) => createNewTab(normalizeUrl(url)));
ipcMain.on('open-private-tab', (_, url) => createNewTab(normalizeUrl(url), { private: true }));
ipcMain.on('zoom-in', () => zoom(0.1));
ipcMain.on('zoom-out', () => zoom(-0.1));
ipcMain.on('zoom-reset', () => zoom(0));
ipcMain.on('fullscreen', toggleFullscreen);
ipcMain.on('devtools', () => tabs[activeTab]?.view.webContents.openDevTools({ mode: 'detach' }));
ipcMain.on('print', printActive);
ipcMain.on('find', (_, text) => { const wc = tabs[activeTab]?.view.webContents; if (wc && text) { findRequestId = wc.findInPage(String(text), { findNext: true }); } });
ipcMain.on('find-next', () => { const wc = tabs[activeTab]?.view.webContents; if (wc) wc.findInPage('', { findNext: true }); });
ipcMain.on('find-previous', () => { const wc = tabs[activeTab]?.view.webContents; if (wc) wc.findInPage('', { forward: false, findNext: true }); });

ipcMain.handle('bookmark:toggle', () => bookmarkActivePage());
ipcMain.handle('bookmark:list', () => bookmarks);
ipcMain.handle('bookmark:remove', (_, url) => { const before = bookmarks.length; bookmarks = bookmarks.filter(x => x.url !== url); writeJson(BOOKMARKS_FILE(), bookmarks); send('bookmarks-update', bookmarks); sendBookmarkState(); return { success: before !== bookmarks.length }; });
ipcMain.handle('history:list', () => historyItems);
ipcMain.handle('history:clear', () => { historyItems = []; writeJson(HISTORY_FILE(), historyItems); send('history-update', historyItems); return true; });
ipcMain.handle('history:remove', (_, url) => { const before = historyItems.length; historyItems = historyItems.filter(x => x.url !== url); writeJson(HISTORY_FILE(), historyItems); send('history-update', historyItems); return { success: before !== historyItems.length }; });
ipcMain.handle('downloads:path', () => app.getPath('downloads'));
ipcMain.handle('downloads:list', () => downloads);
ipcMain.handle('downloads:clear', () => { downloads = []; send('downloads-update', downloads); return true; });
ipcMain.handle('downloads:open', async (_, savePath) => {
  if (!savePath || !path.isAbsolute(savePath)) return { success: false, error: 'Invalid download path.' };
  if (!fs.existsSync(savePath)) return { success: false, error: 'Downloaded file no longer exists.' };
  const error = await shell.openPath(savePath);
  return error ? { success: false, error } : { success: true };
});
ipcMain.handle('downloads:show-in-folder', (_, savePath) => {
  if (!savePath || !path.isAbsolute(savePath) || !fs.existsSync(savePath)) return false;
  shell.showItemInFolder(savePath);
  return true;
});
ipcMain.handle('aarya:status', () => ({ configured: !!process.env.GEMINI_API_KEY, provider: process.env.AARYA_PROVIDER || 'gemini', model: process.env.AARYA_GEMINI_MODEL || 'gemini-3.7-flash' }));
ipcMain.handle('browser:get-state', () => ({ tabs: tabs.length, activeTab, historyCount: historyItems.length, bookmarkCount: bookmarks.length, private: !!tabs[activeTab]?.private }));
ipcMain.handle('browser:clear-data', async () => { historyItems = []; bookmarks = []; writeJson(HISTORY_FILE(), historyItems); writeJson(BOOKMARKS_FILE(), bookmarks); await session.defaultSession.clearStorageData(); send('history-update', historyItems); send('bookmarks-update', bookmarks); sendBookmarkState(); return true; });

try { require('./aarya/bridge').installAaryaIPC(); } catch (e) { console.warn('AARYA bridge unavailable:', e.message); }

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
