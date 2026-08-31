const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { repoRoot, assertCommand, ensureStepBudget } = require('./safety');
const files = require('./filesystem');
const git = require('./git');
const { AgentSession } = require('./session');
const { plan } = require('./model');

function runCommand(args, root) {
  assertCommand(args);
  return execFileSync(args[0], args.slice(1), {
    cwd: root,
    encoding: 'utf8',
    timeout: 30000,
    maxBuffer: 1024 * 1024 * 4,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function inspect(root) {
  const packagePath = path.join(root, 'package.json');
  let pkg = null;
  try { pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')); } catch {}
  return {
    root,
    package: pkg ? { name: pkg.name, version: pkg.version, scripts: pkg.scripts || {} } : null,
    git: { branch: git.branch(root), status: git.status(root), diffStat: git.diffStat(root), log: git.log(root) },
    files: files.snapshot(root).slice(0, 500),
    node: process.version
  };
}

function verify(root) {
  const results = [];
  const candidates = files.snapshot(root)
    .map(x => x.path)
    .filter(p => p.endsWith('.js'))
    .slice(0, 150);
  for (const target of candidates) {
    try {
      runCommand(['node', '--check', target], root);
      results.push({ target, ok: true });
    } catch (error) {
      results.push({ target, ok: false, error: error.message });
    }
  }
  return {
    ok: results.every(r => r.ok),
    checked: results.length,
    failures: results.filter(r => !r.ok)
  };
}

function applyEdit(root, edit) {
  if (!edit || typeof edit.path !== 'string' || typeof edit.content !== 'string') {
    throw new Error('Invalid edit action');
  }
  return files.write(root, edit.path, edit.content);
}

async function run(task, options = {}) {
  const root = repoRoot(options.root);
  const session = new AgentSession(root);
  session.start(task);

  const context = inspect(root);
  session.observe({ type: 'repository', context });

  const proposal = await plan(task, context);
  session.action('plan', { summary: proposal.summary, risks: proposal.risks, steps: proposal.steps });

  if (options.mode === 'plan') return session.finish('planned');

  if (options.mode === 'auto') {
    if (git.branch(root) === 'main') {
      throw new Error('YB safety: autonomous mode cannot run directly on main');
    }
    const edits = Array.isArray(proposal.edits) ? proposal.edits.slice(0, 3) : [];
    for (const edit of edits) {
      ensureStepBudget(session.step());
      const result = applyEdit(root, edit);
      session.action('edit', result);
    }
  }

  ensureStepBudget(session.step());
  const verification = verify(root);
  session.verify(verification);
  if (!verification.ok) return session.finish('failed-verification');
  return session.finish(options.mode === 'auto' ? 'verified' : 'verified-plan');
}

module.exports = { inspect, verify, run };
