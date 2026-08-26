const { execFileSync } = require('node:child_process');
const { assertCommand, repoRoot } = require('./safety');

function command(root, args) {
  assertCommand(args);
  return execFileSync(args[0], args.slice(1), { cwd: repoRoot(root), encoding: 'utf8', timeout: 30000, stdio: ['ignore','pipe','pipe'] }).trim();
}

function snapshot(root) {
  const branch = command(root, ['git','branch','--show-current']);
  const sha = command(root, ['git','rev-parse','HEAD']);
  return { branch, sha };
}

function restore(root, snapshotInfo) {
  if (!snapshotInfo?.sha) throw new Error('Missing recovery snapshot');
  command(root, ['git','reset','--hard',snapshotInfo.sha]);
  return command(root, ['git','status','--short']);
}

module.exports = { snapshot, restore };
