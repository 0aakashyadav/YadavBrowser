const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain
} = require("electron");

const path = require("path");
const fs = require("fs");

let win = null;
let tabs = [];
let activeTab = 0;

const TOOLBAR_HEIGHT = 108;
const HOME_URL = `file://${path.join(__dirname, "yadav-search.html")}`;

/* =========================================================
   DATA STORAGE
========================================================= */

const DATA_DIR = path.join(
  app.getPath("userData"),
  "yadavbrowser-data"
);

const HISTORY_FILE = path.join(
  DATA_DIR,
  "history.json"
);

const BOOKMARKS_FILE = path.join(
  DATA_DIR,
  "bookmarks.json"
);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

function readJson(file, fallback) {
  try {
    ensureDataDir();

    if (!fs.existsSync(file)) {
      return fallback;
    }

    const value = JSON.parse(
      fs.readFileSync(file, "utf8")
    );

    return value;
  } catch (error) {
    console.error(
      `Failed reading ${file}:`,
      error
    );

    return fallback;
  }
}

function writeJson(file, value) {
  try {
    ensureDataDir();

    fs.writeFileSync(
      file,
      JSON.stringify(value, null, 2),
      "utf8"
    );

    return true;
  } catch (error) {
    console.error(
      `Failed writing ${file}:`,
      error
    );

    return false;
  }
}

/* =========================================================
   HISTORY
========================================================= */

let historyItems =
  readJson(
    HISTORY_FILE,
    []
  );

if (!Array.isArray(historyItems)) {
  historyItems = [];
}

function addHistory(
  url,
  title = "Untitled"
) {
  if (!url) {
    return;
  }

  if (
    url.startsWith("file://") ||
    url.startsWith("devtools://") ||
    url.startsWith("about:")
  ) {
    return;
  }

  historyItems.unshift({
    title:
      title || "Untitled",

    url,

    visitedAt:
      new Date().toISOString()
  });

  /*
    Keep the newest 2000 visits.
  */
  historyItems =
    historyItems.slice(
      0,
      2000
    );

  writeJson(
    HISTORY_FILE,
    historyItems
  );
}

/* =========================================================
   BOOKMARKS
========================================================= */

let bookmarks =
  readJson(
    BOOKMARKS_FILE,
    []
  );

if (!Array.isArray(bookmarks)) {
  bookmarks = [];
}

function isBookmarked(url) {
  return bookmarks.some(
    bookmark =>
      bookmark.url === url
  );
}

function addBookmark(
  url,
  title = "Untitled"
) {
  if (
    !url ||
    url.startsWith("file://")
  ) {
    return {
      success: false,
      reason: "invalid-url"
    };
  }

  if (isBookmarked(url)) {
    return {
      success: false,
      reason: "already-bookmarked"
    };
  }

  const bookmark = {
    id:
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`,

    title:
      title || "Untitled",

    url,

    createdAt:
      new Date().toISOString()
  };

  bookmarks.unshift(
    bookmark
  );

  writeJson(
    BOOKMARKS_FILE,
    bookmarks
  );

  return {
    success: true,
    bookmark
  };
}

function removeBookmark(url) {
  const before =
    bookmarks.length;

  bookmarks =
    bookmarks.filter(
      bookmark =>
        bookmark.url !== url
    );

  writeJson(
    BOOKMARKS_FILE,
    bookmarks
  );

  return {
    success:
      bookmarks.length !== before
  };
}

/* =========================================================
   CREATE TAB
========================================================= */

function createTab(
  url = HOME_URL,
  options = {}
) {
  const isPrivate =
    Boolean(options.private);

  /*
    Private tabs use a temporary
    Electron session.
  */
  const partition =
    isPrivate
        ? `yadav-private-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`
        : undefined;

  const webPreferences = {
    contextIsolation: true,
    nodeIntegration: false
  };

  if (partition) {
    webPreferences.partition =
      partition;
  }

  const view =
    new BrowserView({
      webPreferences
    });

  const tab = {
    view,

    title:
      isPrivate
        ? "Private Tab"
        : "New Tab",

    url,

    private:
      isPrivate,

    partition
  };

  tabs.push(tab);

  view.webContents.loadURL(
    url
  );
/* =======================================================
   BROWSER VIEW KEYBOARD SHORTCUTS
======================================================= */

view.webContents.on(
  "before-input-event",
  (event, input) => {

    if (input.type !== "keyDown") {
      return;
    }

    const key =
      String(input.key || "").toLowerCase();

    /* CTRL + T — New Tab */

    if (
      input.control &&
      !input.alt &&
      !input.shift &&
      key === "t"
    ) {
      event.preventDefault();

      createNewTab();

      return;
    }

    /* CTRL + W — Close Tab */

    if (
      input.control &&
      !input.alt &&
      !input.shift &&
      key === "w"
    ) {
      event.preventDefault();

      closeActiveTab();

      return;
    }

    /* CTRL + TAB — Next Tab */

    if (
      input.control &&
      !input.shift &&
      !input.alt &&
      key === "tab"
    ) {
      event.preventDefault();

      switchToNextTab();

      return;
    }

    /* CTRL + SHIFT + TAB — Previous Tab */

    if (
      input.control &&
      input.shift &&
      !input.alt &&
      key === "tab"
    ) {
      event.preventDefault();

      switchToPreviousTab();

      return;
    }

    /* CTRL + 1–9 — Select Tab */

    if (
      input.control &&
      !input.alt &&
      /^[1-9]$/.test(input.key)
    ) {
      event.preventDefault();

      switchToTab(
        Number(input.key) - 1
      );

      return;
    }

    /* CTRL + D — Bookmark */

    if (
      input.control &&
      !input.alt &&
      !input.shift &&
      key === "d"
    ) {
      event.preventDefault();

      bookmarkActivePage();

      return;
    }

    /* CTRL + H — History */

    if (
      input.control &&
      !input.alt &&
      !input.shift &&
      key === "h"
    ) {
      event.preventDefault();

      showHistory();

      return;
    }

    /* CTRL + SHIFT + B — Bookmarks */

    if (
      input.control &&
      input.shift &&
      !input.alt &&
      key === "b"
    ) {
      event.preventDefault();

      showBookmarks();

      return;
    }

    /* CTRL + L — Address Bar */

    if (
      input.control &&
      !input.alt &&
      !input.shift &&
      key === "l"
    ) {
      event.preventDefault();

      focusAddressBar();

      return;
    }

    /* CTRL + R — Reload */

    if (
      input.control &&
      !input.alt &&
      !input.shift &&
      key === "r"
    ) {
      event.preventDefault();

      reloadActiveTab();

      return;
    }
  }
);
  /* =======================================================
     PAGE TITLE
  ======================================================= */

  view.webContents.on(
    "page-title-updated",
    (event, title) => {
      event.preventDefault();

      tab.title =
        title ||
        (
          tab.private
            ? "Private Tab"
            : "New Tab"
        );

      sendTabUpdate();
    }
  );

  /* =======================================================
     NORMAL NAVIGATION
  ======================================================= */

  view.webContents.on(
    "did-navigate",
    (_, newURL) => {
      tab.url =
        newURL;

      if (!tab.private) {
        addHistory(
          newURL,
          tab.title
        );
      }

      if (
        tabs[activeTab] === tab
      ) {
        sendAddressUpdate(
          newURL
        );

        sendTabUpdate();

        sendBookmarkState();
      }
    }
  );

  /* =======================================================
     IN-PAGE NAVIGATION
  ======================================================= */

  view.webContents.on(
    "did-navigate-in-page",
    (_, newURL) => {
      tab.url =
        newURL;

      if (
        tabs[activeTab] === tab
      ) {
        sendAddressUpdate(
          newURL
        );

        sendTabUpdate();

        sendBookmarkState();
      }
    }
  );

  /* =======================================================
     DOWNLOADS
  ======================================================= */

  view.webContents.session.on(
    "will-download",
    (_, item) => {
      const downloadsPath =
        app.getPath(
          "downloads"
        );

      const filename =
        item.getFilename();

      const savePath =
        path.join(
          downloadsPath,
          filename
        );

      item.setSavePath(
        savePath
      );

      item.on(
        "updated",
        (_, state) => {
          sendDownloadUpdate({
            filename,
            savePath,
            state,
            receivedBytes:
              item.getReceivedBytes(),
            totalBytes:
              item.getTotalBytes()
          });
        }
      );

      item.once(
        "done",
        (_, state) => {
          sendDownloadUpdate({
            filename,
            savePath,
            state,
            receivedBytes:
              item.getReceivedBytes(),
            totalBytes:
              item.getTotalBytes()
          });
        }
      );
    }
  );

  return tab;
}

/* =========================================================
   NEW TAB
========================================================= */

function createNewTab(
  url = HOME_URL,
  options = {}
) {
  const tab =
    createTab(
      url,
      options
    );

  activeTab =
    tabs.length - 1;

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(
    tab.url
  );

  sendBookmarkState();
}

/* =========================================================
   PRIVATE TAB
========================================================= */

function createPrivateTab() {
    console.log("PRIVATE TAB: creating");

    const tab = createTab(HOME_URL, {
        private: true
    });

    activeTab = tabs.length - 1;

    console.log(
        "PRIVATE TAB: active index =",
        activeTab,
        "total tabs =",
        tabs.length
    );

    updateActiveView();
    sendTabUpdate();
    sendAddressUpdate(tab.url);
    sendBookmarkState();
}
/* =========================================================
   CLOSE ACTIVE TAB
========================================================= */

function closeActiveTab() {
  /*
    IMPORTANT:
    Never close the entire YadavBrowser window
    when there is only one tab.
  */
  if (tabs.length <= 1) {
    return;
  }

  const tab =
    tabs[activeTab];

  if (!tab) {
    return;
  }

  try {
    if (
      !tab.view.webContents.isDestroyed()
    ) {
      tab.view.webContents.destroy();
    }
  } catch (error) {
    console.error(
      "Error destroying tab:",
      error
    );
  }

  tabs.splice(
    activeTab,
    1
  );

  if (
    activeTab >= tabs.length
  ) {
    activeTab =
      tabs.length - 1;
  }

  updateActiveView();

  sendTabUpdate();

  if (tabs[activeTab]) {
    sendAddressUpdate(
      tabs[activeTab].url
    );

    sendBookmarkState();
  }
}

/* =========================================================
   NEXT TAB
========================================================= */

function switchToNextTab() {
  if (tabs.length <= 1) {
    return;
  }

  activeTab =
    (activeTab + 1) %
    tabs.length;

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(
    tabs[activeTab].url
  );

  sendBookmarkState();
}

/* =========================================================
   PREVIOUS TAB
========================================================= */

function switchToPreviousTab() {
  if (tabs.length <= 1) {
    return;
  }

  activeTab =
    (activeTab - 1 + tabs.length) %
    tabs.length;

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(
    tabs[activeTab].url
  );

  sendBookmarkState();
}

/* =========================================================
   SWITCH DIRECTLY TO TAB
========================================================= */

function switchToTab(index) {
  if (
    typeof index !== "number" ||
    index < 0 ||
    index >= tabs.length
  ) {
    return;
  }

  activeTab =
    index;

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(
    tabs[activeTab].url
  );

  sendBookmarkState();
}

/* =========================================================
   ACTIVE TAB
========================================================= */

function getActiveTab() {
  return tabs[activeTab] || null;
}

function getActiveUrl() {
  const tab =
    getActiveTab();

  return tab
    ? tab.url
    : "";
}

function getActiveTitle() {
  const tab =
    getActiveTab();

  return tab
    ? tab.title || "Untitled"
    : "Untitled";
}

/* =========================================================
   BOOKMARK ACTIVE PAGE
========================================================= */

function bookmarkActivePage() {
  const tab =
    getActiveTab();

  if (!tab) {
    return {
      success: false,
      reason: "no-active-tab"
    };
  }

  if (tab.private) {
    return {
      success: false,
      reason: "private-tab"
    };
  }

  let result;

  if (
    isBookmarked(
      tab.url
    )
  ) {
    result =
      removeBookmark(
        tab.url
      );
  } else {
    result =
      addBookmark(
        tab.url,
        tab.title
      );
  }

  sendBookmarkState();

  sendBookmarksUpdate();

  return result;
}

/* =========================================================
   FOCUS ADDRESS BAR
========================================================= */

function focusAddressBar() {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "focus-address-bar"
  );
}

/* =========================================================
   RELOAD ACTIVE TAB
========================================================= */

function reloadActiveTab() {
  const tab =
    getActiveTab();

  if (!tab) {
    return;
  }

  tab.view.webContents.reload();
}

/* =========================================================
   SHOW HISTORY
========================================================= */

function showHistory() {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "show-history",
    historyItems
  );
}

/* =========================================================
   SHOW BOOKMARKS
========================================================= */

function showBookmarks() {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "show-bookmarks",
    bookmarks
  );
}

/* =========================================================
   SEND BOOKMARK STATE
========================================================= */

function sendBookmarkState() {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  const tab =
    getActiveTab();

  win.webContents.send(
    "bookmark-state",
    {
      url:
        tab
          ? tab.url
          : "",

      bookmarked:
        tab &&
        !tab.private
          ? isBookmarked(
              tab.url
            )
          : false,

      private:
        tab
          ? tab.private
          : false
    }
  );
}

/* =========================================================
   SEND BOOKMARKS UPDATE
========================================================= */

function sendBookmarksUpdate() {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "bookmarks-update",
    bookmarks
  );
}

/* =========================================================
   SEND DOWNLOAD UPDATE
========================================================= */

function sendDownloadUpdate(
  data
) {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "download-update",
    data
  );
}

/* =========================================================
   CREATE WINDOW
========================================================= */

function createWindow() {
  win =
    new BrowserWindow({
      width: 1280,
      height: 800,

      minWidth: 800,
      minHeight: 500,

      title:
        "YadavBrowser",

      webPreferences: {
        preload:
          path.join(
            __dirname,
            "preload.js"
          ),

        contextIsolation:
          true,

        nodeIntegration:
          false
      }
    });

  /* -------------------------
     FIRST TAB
  ------------------------- */

  createTab();

  activeTab = 0;

  /* -------------------------
     LOAD BROWSER UI
  ------------------------- */

  win.loadFile(
    path.join(
      __dirname,
      "index.html"
    )
  );

  /* -------------------------
     UI LOADED
  ------------------------- */

  win.webContents.on(
    "did-finish-load",
    () => {
      updateActiveView();

      sendTabUpdate();

      if (
        tabs[activeTab]
      ) {
        sendAddressUpdate(
          tabs[activeTab].url
        );
      }

      sendBookmarkState();

      sendBookmarksUpdate();
    }
  );

  /* -------------------------
     RESIZE
  ------------------------- */

  win.on(
    "resize",
    () => {
      updateViewBounds();
    }
  );

  /* =======================================================
     WINDOW-LEVEL SHORTCUTS

     These protect shortcuts when
     the BrowserView isn't focused.
  ======================================================= */

  win.webContents.on(
    "before-input-event",
    (event, input) => {

      if (
        input.type !==
        "keyDown"
      ) {
        return;
      }

      const key =
        String(
          input.key || ""
        ).toLowerCase();

      /* -------------------------
         CTRL + T
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        !input.shift &&
        key === "t"
      ) {
        event.preventDefault();

        createNewTab();

        return;
      }

      /* -------------------------
         CTRL + W

         NEVER closes the window.
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        !input.shift &&
        key === "w"
      ) {
        event.preventDefault();

        closeActiveTab();

        return;
      }

      /* -------------------------
         CTRL + SHIFT + TAB
      ------------------------- */

      if (
        input.control &&
        input.shift &&
        !input.alt &&
        key === "tab"
      ) {
        event.preventDefault();

        switchToPreviousTab();

        return;
      }

      /* -------------------------
         CTRL + TAB
      ------------------------- */

      if (
        input.control &&
        !input.shift &&
        !input.alt &&
        key === "tab"
      ) {
        event.preventDefault();

        switchToNextTab();

        return;
      }

      /* -------------------------
         CTRL + 1–9
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        /^[1-9]$/.test(
          input.key
        )
      ) {
        event.preventDefault();

        switchToTab(
          Number(
            input.key
          ) - 1
        );

        return;
      }

      /* -------------------------
         CTRL + D

         Bookmark
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        !input.shift &&
        key === "d"
      ) {
        event.preventDefault();

        bookmarkActivePage();

        return;
      }

      /* -------------------------
         CTRL + H

         History
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        !input.shift &&
        key === "h"
      ) {
        event.preventDefault();

        showHistory();

        return;
      }

      /* -------------------------
         CTRL + SHIFT + B

         Bookmarks
      ------------------------- */

      if (
        input.control &&
        input.shift &&
        !input.alt &&
        key === "b"
      ) {
        event.preventDefault();

        showBookmarks();

        return;
      }

      /* -------------------------
         CTRL + L

         Address bar
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        !input.shift &&
        key === "l"
      ) {
        event.preventDefault();

        focusAddressBar();

        return;
      }

      /* -------------------------
         CTRL + R

         Reload
      ------------------------- */

      if (
        input.control &&
        !input.alt &&
        !input.shift &&
        key === "r"
      ) {
        event.preventDefault();

        reloadActiveTab();

        return;
      }
    }
  );

  /* -------------------------
     WINDOW CLOSED
  ------------------------- */

  win.on(
    "closed",
    () => {
      win = null;
    }
  );
}

/* =========================================================
   UPDATE BROWSER VIEW SIZE
========================================================= */

function updateViewBounds() {
  if (
    !win ||
    win.isDestroyed() ||
    !tabs[activeTab]
  ) {
    return;
  }

  const [
    width,
    height
  ] =
    win.getContentSize();

  tabs[
    activeTab
  ].view.setBounds({
    x: 0,

    y:
      TOOLBAR_HEIGHT,

    width,

    height:
      Math.max(
        0,
        height -
          TOOLBAR_HEIGHT
      )
  });
}

/* =========================================================
   UPDATE ACTIVE VIEW
========================================================= */

function updateActiveView() {
  if (
    !win ||
    win.isDestroyed() ||
    !tabs[activeTab]
  ) {
    return;
  }

  win.setBrowserView(
    tabs[activeTab].view
  );

  updateViewBounds();

  sendAddressUpdate(
    tabs[activeTab].url
  );
}

/* =========================================================
   TAB UPDATE
========================================================= */

function sendTabUpdate() {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "tab-update",
    {
      activeIndex:
        activeTab,

      tabs:
        tabs.map(
          tab => ({
            title:
              tab.title ||
              (
                tab.private
                  ? "Private Tab"
                  : "New Tab"
              ),

            url:
              tab.url || "",

            private:
              Boolean(
                tab.private
              )
          })
        )
    }
  );
}

/* =========================================================
   ADDRESS UPDATE
========================================================= */

function sendAddressUpdate(
  url
) {
  if (
    !win ||
    win.isDestroyed()
  ) {
    return;
  }

  win.webContents.send(
    "address-update",
    url || ""
  );
}
/* =========================================================
   NAVIGATION
========================================================= */

ipcMain.on(
  "navigate",
  (_, url) => {
    const tab =
      tabs[activeTab];

    if (!tab) {
      return;
    }

    url =
      String(url || "")
        .trim();

    if (!url) {
      return;
    }

    /*
      If the input is not a URL,
      search Google.
    */
    if (
      !url.startsWith(
        "http://"
      ) &&
      !url.startsWith(
        "https://"
      )
    ) {
      if (
        url.includes(".") &&
        !url.includes(" ")
      ) {
        url =
          "https://" + url;
      } else {
        url =
          "https://www.google.com/search?q=" +
          encodeURIComponent(
            url
          );
      }
    }

    tab.url = url;

    tab.view.webContents.loadURL(
      url
    );

    sendAddressUpdate(
      url
    );
  }
);

/* =========================================================
   FOCUS ADDRESS BAR
========================================================= */

ipcMain.on(
  "focus-address-bar",
  () => {
    focusAddressBar();
  }
);

/* =========================================================
   BACK
========================================================= */

ipcMain.on(
  "back",
  () => {
    const tab =
      tabs[activeTab];

    if (!tab) {
      return;
    }

    if (
      tab.view.webContents.canGoBack()
    ) {
      tab.view.webContents.goBack();
    }
  }
);

/* =========================================================
   FORWARD
========================================================= */

ipcMain.on(
  "forward",
  () => {
    const tab =
      tabs[activeTab];

    if (!tab) {
      return;
    }

    if (
      tab.view.webContents.canGoForward()
    ) {
      tab.view.webContents.goForward();
    }
  }
);

/* =========================================================
   RELOAD
========================================================= */

ipcMain.on(
  "reload",
  () => {
    reloadActiveTab();
  }
);

/* =========================================================
   NEW TAB FROM UI
========================================================= */

ipcMain.on(
  "new-tab",
  () => {
    createNewTab();
  }
);

/* =========================================================
   NEW PRIVATE TAB FROM UI
========================================================= */

let privateTabLock = false;

ipcMain.on("new-private-tab", () => {
    // Prevent accidental double-trigger
    if (privateTabLock) {
        return;
    }

    privateTabLock = true;

    createPrivateTab();

    setTimeout(() => {
        privateTabLock = false;
    }, 500);
});

/* =========================================================
   CLOSE TAB FROM UI
========================================================= */

ipcMain.on(
  "close-tab",
  () => {
    closeActiveTab();
  }
);

/* =========================================================
   SWITCH TAB FROM UI
========================================================= */

ipcMain.on(
  "switch-tab",
  (_, index) => {

    if (
      tabs.length === 0
    ) {
      return;
    }

    if (
      index === "next"
    ) {
      switchToNextTab();

      return;
    }

    if (
      index === "previous"
    ) {
      switchToPreviousTab();

      return;
    }

    if (
      typeof index ===
      "number"
    ) {
      switchToTab(index);
    }
  }
);

/* =========================================================
   BOOKMARK IPC
========================================================= */

ipcMain.handle(
  "bookmark:toggle",
  () => {
    return bookmarkActivePage();
  }
);

ipcMain.handle(
  "bookmark:list",
  () => {
    return bookmarks;
  }
);

ipcMain.handle(
  "bookmark:remove",
  (_, url) => {

    const result =
      removeBookmark(url);

    sendBookmarkState();

    sendBookmarksUpdate();

    return result;
  }
);

/* =========================================================
   HISTORY IPC
========================================================= */

ipcMain.handle(
  "history:list",
  () => {
    return historyItems;
  }
);

ipcMain.handle(
  "history:clear",
  () => {

    historyItems = [];

    const success =
      writeJson(
        HISTORY_FILE,
        historyItems
      );

    if (
      win &&
      !win.isDestroyed()
    ) {
      win.webContents.send(
        "history-update",
        historyItems
      );
    }

    return {
      success
    };
  }
);

/* =========================================================
   DOWNLOAD IPC
========================================================= */

ipcMain.handle(
  "downloads:path",
  () => {
    return app.getPath(
      "downloads"
    );
  }
);

/* =========================================================
   BROWSER INFORMATION
========================================================= */

ipcMain.handle(
  "browser:get-state",
  () => {

    return {
      tabs:
        tabs.map(
          tab => ({
            title:
              tab.title ||
              "New Tab",

            url:
              tab.url || "",

            private:
              Boolean(
                tab.private
              )
          })
        ),

      activeIndex:
        activeTab,

      bookmarks:

        bookmarks.length,

      history:

        historyItems.length
    };
  }
);

/* =========================================================
   OPEN URL IN NEW TAB
========================================================= */

ipcMain.on(
  "open-new-tab",
  (_, url) => {

    url =
      String(url || "")
        .trim();

    if (!url) {
      return;
    }

    createNewTab(url);
  }
);

/* =========================================================
   OPEN URL IN PRIVATE TAB
========================================================= */

ipcMain.on(
  "open-private-tab",
  (_, url) => {

    url =
      String(url || "")
        .trim();

    if (!url) {
      url = HOME_URL;
    }

    createNewTab(
      url,
      {
        private: true
      }
    );
  }
);

/* =========================================================
   DELETE HISTORY ITEM
========================================================= */

ipcMain.handle(
  "history:remove",
  (_, url) => {

    const before =
      historyItems.length;

    historyItems =
      historyItems.filter(
        item =>
          item.url !== url
      );

    const success =
      writeJson(
        HISTORY_FILE,
        historyItems
      );

    if (
      win &&
      !win.isDestroyed()
    ) {
      win.webContents.send(
        "history-update",
        historyItems
      );
    }

    return {
      success:
        success &&
        historyItems.length !==
          before
    };
  }
);

/* =========================================================
   CLEAR ALL BROWSER DATA
========================================================= */

ipcMain.handle(
  "browser:clear-data",
  () => {

    historyItems = [];

    bookmarks = [];

    const historySuccess =
      writeJson(
        HISTORY_FILE,
        historyItems
      );

    const bookmarkSuccess =
      writeJson(
        BOOKMARKS_FILE,
        bookmarks
      );

    sendBookmarkState();

    sendBookmarksUpdate();

    if (
      win &&
      !win.isDestroyed()
    ) {
      win.webContents.send(
        "history-update",
        historyItems
      );
    }

    return {
      success:
        historySuccess &&
        bookmarkSuccess
    };
  }
);
/* =========================================================
   APP READY
========================================================= */

app.whenReady().then(() => {

  ensureDataDir();

  createWindow();

  /*
    Re-create the window on macOS
    when the application is activated.
  */
  app.on(
    "activate",
    () => {

      if (
        BrowserWindow.getAllWindows()
          .length === 0
      ) {
        createWindow();
      }

    }
  );

});

/* =========================================================
   ALL WINDOWS CLOSED
========================================================= */

app.on(
  "window-all-closed",
  () => {

    /*
      Windows/Linux:
      quit the application.

      macOS:
      keep the application alive
      until the user explicitly quits.
    */

    if (
      process.platform !==
      "darwin"
    ) {
      app.quit();
    }

  }
);

/* =========================================================
   BEFORE QUIT
========================================================= */

app.on(
  "before-quit",
  () => {

    /*
      Clean up BrowserViews.
    */

    for (
      const tab of tabs
    ) {

      try {

        if (
          tab &&
          tab.view &&
          !tab.view.webContents
            .isDestroyed()
        ) {

          tab.view.webContents
            .destroy();

        }

      } catch (error) {

        console.error(
          "Error cleaning tab:",
          error
        );

      }

    }

    tabs = [];

    activeTab = 0;

  }
);