const { app, BrowserWindow, BrowserView, ipcMain } = require("electron");
const path = require("path");

let win;
let view;

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

  view = new BrowserView({
    webPreferences: {
      contextIsolation: true
    }
  });

  win.setBrowserView(view);

  const resizeView = () => {
    const [width, height] = win.getContentSize();

    view.setBounds({
      x: 0,
      y: 70,
      width: width,
      height: height - 70
    });
  };

  resizeView();

  win.on("resize", resizeView);

  view.webContents.loadURL("https://www.google.com");

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

ipcMain.on("navigate", (_, url) => {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://www.google.com/search?q=" + encodeURIComponent(url);
  }

  view.webContents.loadURL(url);
});

ipcMain.on("back", () => {
  if (view.webContents.canGoBack()) {
    view.webContents.goBack();
  }
});

ipcMain.on("forward", () => {
  if (view.webContents.canGoForward()) {
    view.webContents.goForward();
  }
});

ipcMain.on("reload", () => {
  view.webContents.reload();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});