const { contextBridge, ipcRenderer } = require('electron');
const on = (channel, callback) => ipcRenderer.on(channel, (_, data) => callback(data));

contextBridge.exposeInMainWorld('browserAPI', {
  navigate: url => ipcRenderer.send('navigate', url),
  back: () => ipcRenderer.send('back'),
  forward: () => ipcRenderer.send('forward'),
  reload: () => ipcRenderer.send('reload'),
  stop: () => ipcRenderer.send('stop'),

  newTab: () => ipcRenderer.send('new-tab'),
  newPrivateTab: () => ipcRenderer.send('new-private-tab'),
  closeTab: index => ipcRenderer.send('close-tab', index),
  switchTab: index => ipcRenderer.send('switch-tab', index),
  focusAddressBar: () => ipcRenderer.send('focus-address-bar'),

  toggleBookmark: () => ipcRenderer.invoke('bookmark:toggle'),
  getBookmarks: () => ipcRenderer.invoke('bookmark:list'),
  removeBookmark: url => ipcRenderer.invoke('bookmark:remove', url),
  getHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistory: url => ipcRenderer.invoke('history:remove', url),

  getDownloadsPath: () => ipcRenderer.invoke('downloads:path'),
  getDownloads: () => ipcRenderer.invoke('downloads:list'),
  clearDownloads: () => ipcRenderer.invoke('downloads:clear'),
  openDownload: savePath => ipcRenderer.invoke('downloads:open', savePath),
  showDownloadInFolder: savePath => ipcRenderer.invoke('downloads:show-in-folder', savePath),
  aaryaStatus: () => ipcRenderer.invoke('aarya:status'),
  getBrowserState: () => ipcRenderer.invoke('browser:get-state'),
  clearBrowserData: () => ipcRenderer.invoke('browser:clear-data'),

  openNewTab: url => ipcRenderer.send('open-new-tab', url),
  openPrivateTab: url => ipcRenderer.send('open-private-tab', url),

  searchWeb: options => ipcRenderer.invoke('yadav:search', options),
  searchStatus: () => ipcRenderer.invoke('yadav:search-status'),

  aaryaAsk: message => ipcRenderer.invoke('aarya:ask', { message }),

  zoomIn: () => ipcRenderer.send('zoom-in'),
  zoomOut: () => ipcRenderer.send('zoom-out'),
  zoomReset: () => ipcRenderer.send('zoom-reset'),
  find: text => ipcRenderer.send('find', text),
  findNext: () => ipcRenderer.send('find-next'),
  findPrevious: () => ipcRenderer.send('find-previous'),
  print: () => ipcRenderer.send('print'),
  fullscreen: () => ipcRenderer.send('fullscreen'),
  devtools: () => ipcRenderer.send('devtools'),

  onTabUpdate: cb => on('tab-update', cb),
  onAddressUpdate: cb => on('address-update', cb),
  onFocusAddressBar: cb => on('focus-address-bar', cb),
  onBookmarkState: cb => on('bookmark-state', cb),
  onBookmarksUpdate: cb => on('bookmarks-update', cb),
  onHistoryUpdate: cb => on('history-update', cb),
  onDownloadUpdate: cb => on('download-update', cb),
  onDownloadsUpdate: cb => on('downloads-update', cb),
  onLoadingState: cb => on('loading-state', cb),
  onZoomUpdate: cb => on('zoom-update', cb),
  onShowHistory: cb => on('show-history', cb),
  onShowBookmarks: cb => on('show-bookmarks', cb),
  onShowDownloads: cb => on('show-downloads', cb),
  onAbout: cb => on('about', cb),
  onOpenFind: cb => on('open-find', cb),
  onAaryaResponse: cb => on('aarya:response', cb)
});
