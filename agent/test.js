const assert = require('node:assert/strict');
const path = require('node:path');
const { safePath, assertText, assertCommand } = require('./safety');
const { inspect, verify } = require('./core');

const root = path.resolve(__dirname, '..');

assert.equal(safePath(root, 'agent/core.js').endsWith(path.join('agent', 'core.js')), true);
assert.throws(() => safePath(root, '../outside.txt'), /escapes repository/);
assert.throws(() => safePath(root, '.env'), /protected path/);
assert.throws(() => assertText('-----BEGIN PRIVATE KEY-----'), /secret detected/);
assert.doesNotThrow(() => assertCommand(['node', '--check', 'agent/core.js']));
assert.throws(() => assertCommand(['powershell', '-Command', 'whoami']), /not allowlisted/);

const report = inspect(root);
assert.equal(report.package.name, 'yadavbrowser');
const verification = verify(root);
assert.equal(typeof verification.ok, 'boolean');
console.log('YB Agent tests passed');
