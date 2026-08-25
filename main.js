const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("path");

let win;
let tabs = [];
let activeTab = 0;

function createTab(url = "https://www.google.com") {
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true
    }
  });

  const tab = {
    view,
    title: "New Tab",
    url
  };

  tabs.push(tab);

  view.webContents.loadURL(url);

  view.webContents.on("page-title-updated", (event, title) => {
    event.preventDefault();
    tab.title = title || "New Tab";
    sendTabUpdate();
  });

  view.webContents.on("did-navigate", (_, newURL) => {
    tab.url = newURL;

    if (tabs[activeTab] === tab) {
      sendAddressUpdate(newURL);
    }
  });

    view.webContents.on("did-navigate-in-page", (_, newURL) => {
    tab.url = newURL;

    if (tabs[activeTab] === tab) {
      sendAddressUpdate(newURL);
    }
  });

  // Keyboard shortcuts inside the BrowserView
  view.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      input.control &&
      input.key.toLowerCase() === "t"
    ) {
      event.preventDefault();

      const newTab = createTab();

      activeTab = tabs.length - 1;

      updateActiveView();
      sendTabUpdate();
      sendAddressUpdate(newTab.url);
    }
  });

  return tab;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "YadavBrowser",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  createTab();

  activeTab = 0;

  win.loadFile("index.html");

  win.webContents.on("did-finish-load", () => {
    updateActiveView();
    sendTabUpdate();

    if (tabs[activeTab]) {
      sendAddressUpdate(tabs[activeTab].url);
    }
  });

  win.on("resize", updateViewBounds);
}

function updateViewBounds() {
  if (!win || !tabs[activeTab]) return;

  const [width, height] = win.getContentSize();

  tabs[activeTab].view.setBounds({
    x: 0,
    y: 108,
    width,
    height: Math.max(0, height - 108)
  });
}

function updateActiveView() {
  if (!win || !tabs[activeTab]) return;

  win.setBrowserView(tabs[activeTab].view);

  updateViewBounds();

  sendAddressUpdate(tabs[activeTab].url);
}

function sendTabUpdate() {
  if (!win || win.isDestroyed()) return;

  win.webContents.send("tab-update", {
    activeIndex: activeTab,

    tabs: tabs.map((tab) => ({
      title: tab.title,
      url: tab.url
    }))
  });
}

function sendAddressUpdate(url) {
  if (!win || win.isDestroyed()) return;

  win.webContents.send("address-update", url);
}


/* =========================
   NAVIGATION
========================= */

ipcMain.on("navigate", (_, url) => {
  const tab = tabs[activeTab];

  if (!tab) return;

  if (
    !url.startsWith("http://") &&
    !url.startsWith("https://")
  ) {
    url =
      "https://www.google.com/search?q=" +
      encodeURIComponent(url);
  }

  tab.url = url;

  tab.view.webContents.loadURL(url);

  sendAddressUpdate(url);
});

ipcMain.on("back", () => {
  const tab = tabs[activeTab];

  if (!tab) return;

  if (tab.view.webContents.canGoBack()) {
    tab.view.webContents.goBack();
  }
});

ipcMain.on("forward", () => {
  const tab = tabs[activeTab];

  if (!tab) return;

  if (tab.view.webContents.canGoForward()) {
    tab.view.webContents.goForward();
  }
});

ipcMain.on("reload", () => {
  const tab = tabs[activeTab];

  if (!tab) return;

  tab.view.webContents.reload();
});


/* =========================
   NEW TAB
========================= */

ipcMain.on("new-tab", () => {
  const tab = createTab();

  activeTab = tabs.length - 1;

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(tab.url);
});


/* =========================
   CLOSE TAB
========================= */

ipcMain.on("close-tab", () => {
  if (tabs.length === 1) {
    return;
  }

  const tab = tabs[activeTab];

  if (tab) {
    tab.view.webContents.destroy();
  }

  tabs.splice(activeTab, 1);

  if (activeTab >= tabs.length) {
    activeTab = tabs.length - 1;
  }

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(tabs[activeTab].url);
});


/* =========================
   SWITCH TAB
========================= */

ipcMain.on("switch-tab", (_, index) => {
  if (tabs.length === 0) return;

  if (index === "next") {
    activeTab = (activeTab + 1) % tabs.length;
  }

  else if (index === "previous") {
    activeTab =
      (activeTab - 1 + tabs.length) % tabs.length;
  }

  else if (
    typeof index === "number" &&
    index >= 0 &&
    index < tabs.length
  ) {
    activeTab = index;
  }

  else {
    return;
  }

  updateActiveView();

  sendTabUpdate();

  sendAddressUpdate(tabs[activeTab].url);
});


/* =========================
   APP START
========================= */

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
