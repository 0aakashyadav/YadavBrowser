const { contextBridge, ipcRenderer } = require('electron');

<<<<<<< HEAD
contextBridge.exposeInMainWorld("browserAPI", {

    /* =====================================================
       NAVIGATION
    ===================================================== */

    navigate: (url) => {
        ipcRenderer.send("navigate", url);
    },

    back: () => {
        ipcRenderer.send("back");
    },

    forward: () => {
        ipcRenderer.send("forward");
    },

    reload: () => {
        ipcRenderer.send("reload");
    },


    /* =====================================================
       TABS
    ===================================================== */

    newTab: () => {
        ipcRenderer.send("new-tab");
    },

    newPrivateTab: () => {
        ipcRenderer.send("new-private-tab");
    },

    closeTab: () => {
        ipcRenderer.send("close-tab");
    },

    switchTab: (direction) => {
        ipcRenderer.send("switch-tab", direction);
    },


    /* =====================================================
       ADDRESS BAR
    ===================================================== */

    focusAddressBar: () => {
        ipcRenderer.send("focus-address-bar");
    },


    /* =====================================================
       BOOKMARKS
    ===================================================== */

    toggleBookmark: () => {
        return ipcRenderer.invoke("bookmark:toggle");
    },

    getBookmarks: () => {
        return ipcRenderer.invoke("bookmark:list");
    },

    removeBookmark: (url) => {
        return ipcRenderer.invoke(
            "bookmark:remove",
            url
        );
    },


    /* =====================================================
       HISTORY
    ===================================================== */

    getHistory: () => {
        return ipcRenderer.invoke("history:list");
    },

    clearHistory: () => {
        return ipcRenderer.invoke("history:clear");
    },

    removeHistory: (url) => {
        return ipcRenderer.invoke(
            "history:remove",
            url
        );
    },


    /* =====================================================
       DOWNLOADS
    ===================================================== */

    getDownloadsPath: () => {
        return ipcRenderer.invoke(
            "downloads:path"
        );
    },


    /* =====================================================
       BROWSER STATE
    ===================================================== */

    getBrowserState: () => {
        return ipcRenderer.invoke(
            "browser:get-state"
        );
    },

    clearBrowserData: () => {
        return ipcRenderer.invoke(
            "browser:clear-data"
        );
    },


    /* =====================================================
       OPEN URL
    ===================================================== */

    openNewTab: (url) => {
        ipcRenderer.send(
            "open-new-tab",
            url
        );
    },

    openPrivateTab: (url) => {
        ipcRenderer.send(
            "open-private-tab",
            url
        );
    },


    /* =====================================================
       AARYA
    ===================================================== */

    aaryaAsk: (message) => {
        return ipcRenderer.invoke(
            "aarya:ask",
            {
                message
            }
        );
    },


    /* =====================================================
       TAB EVENTS
    ===================================================== */

    onTabUpdate: (callback) => {

        ipcRenderer.on(
            "tab-update",
            (_, data) => {
                callback(data);
            }
        );

    },


    /* =====================================================
       ADDRESS EVENTS
    ===================================================== */

    onAddressUpdate: (callback) => {

        ipcRenderer.on(
            "address-update",
            (_, url) => {
                callback(url);
            }
        );

    },


    /* =====================================================
       ADDRESS BAR FOCUS
    ===================================================== */

    onFocusAddressBar: (callback) => {

        ipcRenderer.on(
            "focus-address-bar",
            () => {
                callback();
            }
        );

    },


    /* =====================================================
       BOOKMARK STATE
    ===================================================== */

    onBookmarkState: (callback) => {

        ipcRenderer.on(
            "bookmark-state",
            (_, data) => {
                callback(data);
            }
        );

    },


    /* =====================================================
       BOOKMARKS UPDATE
    ===================================================== */

    onBookmarksUpdate: (callback) => {

        ipcRenderer.on(
            "bookmarks-update",
            (_, data) => {
                callback(data);
            }
        );

    },


    /* =====================================================
       HISTORY UPDATE
    ===================================================== */

    onHistoryUpdate: (callback) => {

        ipcRenderer.on(
            "history-update",
            (_, data) => {
                callback(data);
            }
        );

    },


    /* =====================================================
       DOWNLOAD UPDATE
    ===================================================== */

    onDownloadUpdate: (callback) => {

        ipcRenderer.on(
            "download-update",
            (_, data) => {
                callback(data);
            }
        );

    },


    /* =====================================================
       AARYA EVENTS
    ===================================================== */

    onAaryaResponse: (callback) => {

        ipcRenderer.on(
            "aarya:response",
            (_, data) => {
                callback(data);
            }
        );

    }

});
=======
contextBridge.exposeInMainWorld('browserAPI', {
  navigate: url => ipcRenderer.send('navigate', url),
  back: () => ipcRenderer.send('back'),
  forward: () => ipcRenderer.send('forward'),
  reload: () => ipcRenderer.send('reload'),
  newTab: () => ipcRenderer.send('new-tab'),
  newPrivateTab: () => ipcRenderer.send('new-private-tab'),
  closeTab: () => ipcRenderer.send('close-tab'),
  switchTab: index => ipcRenderer.send('switch-tab', index),
  focusAddressBar: () => ipcRenderer.send('focus-address-bar'),

  toggleBookmark: () => ipcRenderer.invoke('bookmark:toggle'),
  getBookmarks: () => ipcRenderer.invoke('bookmark:list'),
  removeBookmark: url => ipcRenderer.invoke('bookmark:remove', url),
  getHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  removeHistory: url => ipcRenderer.invoke('history:remove', url),
  getBrowserState: () => ipcRenderer.invoke('browser:get-state'),
  clearBrowserData: () => ipcRenderer.invoke('browser:clear-data'),
  getDownloadsPath: () => ipcRenderer.invoke('downloads:path'),
  openNewTab: url => ipcRenderer.send('open-new-tab', url),
  openPrivateTab: url => ipcRenderer.send('open-private-tab', url),

  aaryaAsk: message => ipcRenderer.invoke('aarya:ask', { message }),

  onTabUpdate: callback => ipcRenderer.on('tab-update', (_, data) => callback(data)),
  onAddressUpdate: callback => ipcRenderer.on('address-update', (_, url) => callback(url)),
  onFocusAddressBar: callback => ipcRenderer.on('focus-address-bar', () => callback()),
  onBookmarkState: callback => ipcRenderer.on('bookmark-state', (_, data) => callback(data)),
  onBookmarksUpdate: callback => ipcRenderer.on('bookmarks-update', (_, data) => callback(data)),
  onHistoryUpdate: callback => ipcRenderer.on('history-update', (_, data) => callback(data)),
  onDownloadUpdate: callback => ipcRenderer.on('download-update', (_, data) => callback(data)),
  onLoadingState: callback => ipcRenderer.on('loading-state', (_, loading) => callback(loading)),
  onShowHistory: callback => ipcRenderer.on('show-history', (_, data) => callback(data)),

  onAaryaResponse: callback => ipcRenderer.on('aarya:response', (_, data) => callback(data))
});
>>>>>>> 32ec01fbe7349363bf5823060a80820d9c64806b
