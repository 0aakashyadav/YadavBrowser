const { execFileSync } = require('node:child_process');
const { assertCommand, repoRoot } = require('./safety');

function run(args, root = repoRoot()) {
  assertCommand(['git', ...args]);
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function status(root) { return run(['status', '--short', '--branch'], root); }
function diffStat(root) { return run(['diff', '--stat'], root); }
function branch(root) { return run(['branch', '--show-current'], root); }
function log(root, count = 8) { return run(['log', `-${Math.max(1, Math.min(20, count))}`, '--oneline'], root); }

function ensureAgentBranch(root, name = `yb-agent/${Date.now()}`) {
  const current = branch(root);
  if (current !== 'main' && current.startsWith('yb-agent/')) return current;
  run(['switch', '-c', name], root);
  return name;
}

module.exports = { run, status, diffStat, branch, log, ensureAgentBranch };
