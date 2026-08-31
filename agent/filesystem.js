const fs = require('node:fs');
const path = require('node:path');
const { safePath, assertText, repoRoot, hashContent } = require('./safety');

function list(root = repoRoot(), relative = '.') {
  const dir = safePath(root, relative);
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.git'))
    .map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
}

function read(root, target, maxBytes = 256 * 1024) {
  const file = safePath(root, target);
  const stat = fs.statSync(file);
  if (!stat.isFile()) throw new Error(`Not a file: ${target}`);
  if (stat.size > maxBytes) throw new Error(`File too large to inspect: ${target}`);
  return fs.readFileSync(file, 'utf8');
}

function write(root, target, content) {
  assertText(content);
  const file = safePath(root, target);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return { path: target, sha256: hashContent(content), bytes: Buffer.byteLength(content) };
}

function remove(root, target) {
  const file = safePath(root, target);
  if (!fs.existsSync(file)) return { removed: false };
  if (fs.statSync(file).isDirectory()) throw new Error('Directory deletion is disabled by default');
  fs.unlinkSync(file);
  return { removed: true, path: target };
}

function snapshot(root = repoRoot()) {
  const result = [];
  function walk(current, relative) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, rel);
      else {
        const stat = fs.statSync(full);
        result.push({ path: rel.replaceAll('\\', '/'), bytes: stat.size });
      }
    }
  }
  walk(root, '');
  return result.sort((a, b) => a.path.localeCompare(b.path));
}

module.exports = { list, read, write, remove, snapshot };
