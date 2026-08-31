const { ipcMain } = require('electron');
const path = require('node:path');
const { inspect, verify, run } = require('./core');
const { repoRoot } = require('./safety');

let installed = false;

function installAgentIPC() {
  if (installed) return;
  installed = true;

  ipcMain.handle('yb-agent:inspect', () => inspect(repoRoot()));
  ipcMain.handle('yb-agent:verify', () => verify(repoRoot()));
  ipcMain.handle('yb-agent:plan', async (_event, payload = {}) => {
    const task = String(payload.task || 'Inspect YadavBrowser and identify the highest-value safe improvement.').slice(0, 2000);
    return run(task, { mode: 'plan', root: repoRoot() });
  });

  return { installed: true };
}

module.exports = { installAgentIPC };
