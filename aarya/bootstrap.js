const { app } = require("electron");

require("./bridge").installAaryaIPC();
require("../search/bridge").installSearchIPC();
require("../agent/ipc").installAgentIPC();

app.whenReady().then(() => {
  require("../main");
});
