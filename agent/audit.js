const fs = require('node:fs');
const path = require('node:path');

function auditFile(root) {
  return path.join(root, 'agent', 'runtime-audit.jsonl');
}

function record(root, event, data = {}) {
  const entry = { time: new Date().toISOString(), event, ...data };
  fs.appendFileSync(auditFile(root), JSON.stringify(entry) + '\n');
  return entry;
}

function readRecent(root, limit = 100) {
  const file = auditFile(root);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).slice(-limit).map(JSON.parse);
}

module.exports = { record, readRecent };
