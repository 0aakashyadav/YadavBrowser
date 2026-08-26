const { execFileSync } = require('node:child_process');
const { repoRoot, assertCommand } = require('./safety');
const { POLICY } = require('./policy');
const { record } = require('./audit');
const { snapshot, restore } = require('./recovery');
const { inspect, verify, run } = require('./core');

function cmd(root, args) {
  assertCommand(args);
  return execFileSync(args[0], args.slice(1), { cwd: repoRoot(root), encoding: 'utf8', timeout: 30000, maxBuffer: 2 * 1024 * 1024, stdio: ['ignore','pipe','pipe'] }).trim();
}

function isRateLimited(error) {
  return error?.code === 'RATE_LIMIT' || /quota|rate.?limit|too many requests|high demand/i.test(error?.message || '');
}

async function cycle(task, options = {}) {
  const root = repoRoot(options.root);
  const started = Date.now();
  const state = { iteration: 0, completed: false, reason: null, snapshot: null };

  if (cmd(root, ['git','branch','--show-current']) === 'main') throw new Error('YB autonomy requires an isolated branch');

  state.snapshot = snapshot(root);
  record(root, 'autonomy.start', { task, branch: state.snapshot.branch });

  try {
    for (let i = 1; i <= POLICY.autonomy.maxIterations; i++) {
      state.iteration = i;
      if (Date.now() - started > POLICY.autonomy.maxRuntimeMs) throw new Error('Autonomy runtime budget exceeded');

      const context = inspect(root);
      record(root, 'autonomy.observe', { iteration: i, fileCount: context.files.length, status: context.git.status });

      let result;
      try {
        result = await run(task, { mode: 'auto', root });
      } catch (error) {
        if (isRateLimited(error)) {
          record(root, 'autonomy.paused', { iteration: i, reason: 'provider-rate-limit' });
          state.reason = 'provider-rate-limit';
          return state;
        }
        throw error;
      }

      record(root, 'autonomy.result', { iteration: i, status: result.status });

      if (result.status === 'verified') {
        const finalVerify = verify(root);
        if (!finalVerify.ok) throw new Error('Final verification failed');
        state.completed = true;
        state.reason = 'verified';
        record(root, 'autonomy.complete', { iteration: i });
        return state;
      }

      if (result.status === 'no-safe-change-found') {
        state.reason = 'no-safe-change-found';
        record(root, 'autonomy.stop', { iteration: i, reason: state.reason });
        return state;
      }

      if (result.status === 'failed-verification') {
        throw new Error('Implementation failed verification');
      }

      record(root, 'autonomy.retry', { iteration: i });
    }
  } catch (error) {
    record(root, 'autonomy.failure', { iteration: state.iteration, error: error.message });
    if (POLICY.recovery.requireRollbackPoint) {
      restore(root, state.snapshot);
      record(root, 'autonomy.rollback', { sha: state.snapshot.sha });
    }
    state.reason = error.message;
    return state;
  }

  state.reason = 'iteration budget exhausted';
  record(root, 'autonomy.stop', { reason: state.reason });
  return state;
}

module.exports = { cycle };
