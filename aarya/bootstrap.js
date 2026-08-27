const { app } = require("electron");

require("./bridge").installAaryaIPC();
require("../search/bridge").installSearchIPC();

app.whenReady().then(() => {
  require("../main");
});
