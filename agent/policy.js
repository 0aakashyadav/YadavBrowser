const fs = require('node:fs');
const path = require('node:path');

const POLICY = Object.freeze({
  mission: 'Continuously improve YadavBrowser and Yadav Search for usefulness, speed, reliability, privacy and maintainability.',
  autonomy: {
    maxIterations: Number(process.env.YB_AUTONOMY_MAX_ITERATIONS || 12),
    maxEditsPerIteration: Number(process.env.YB_AUTONOMY_MAX_EDITS || 8),
    maxRuntimeMs: Number(process.env.YB_AUTONOMY_MAX_RUNTIME_MS || 20 * 60 * 1000)
  },
  priorities: ['security','correctness','search-quality','performance','maintainability','capabilities'],
  protectedPaths: ['.git','.github/workflows','node_modules','.env','.env.local','credentials','secrets','certs','keys'],
  allowedExecutables: ['node','npm','npx','git','where','type','dir'],
  deployment: { requireCleanValidation: true, neverDirectMain: true },
  recovery: { keepJournal: true, requireRollbackPoint: true }
});

function writePolicySnapshot(root) {
  const file = path.join(root, 'agent', '.policy-runtime.json');
  fs.writeFileSync(file, JSON.stringify({
    generatedAt: new Date().toISOString(),
    mission: POLICY.mission,
    priorities: POLICY.priorities,
    autonomy: POLICY.autonomy
  }, null, 2));
  return file;
}

function getPolicy() { return POLICY; }

module.exports = { POLICY, getPolicy, writePolicySnapshot };
