const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DEFAULT_MAX_FILE_BYTES = 512 * 1024;
const DEFAULT_MAX_COMMAND_MS = 30_000;
const DEFAULT_MAX_STEPS = Number(process.env.YB_AGENT_MAX_STEPS || 8);

const PROTECTED_PARTS = new Set([
  '.git', '.github/workflows', 'node_modules', '.env', '.env.local',
  'credentials', 'secrets', 'certs', 'keys'
]);

const SAFE_COMMANDS = new Set([
  'node', 'npm', 'npx', 'git', 'where', 'type', 'dir'
]);

function repoRoot(root = process.env.YB_AGENT_ROOT || process.cwd()) {
  return path.resolve(root);
}

function safePath(root, target) {
  const base = repoRoot(root);
  const resolved = path.resolve(base, target);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error('YB safety: path escapes repository root');
  }
  const relative = path.relative(base, resolved).replaceAll('\\', '/');
  for (const protectedPart of PROTECTED_PARTS) {
    if (relative === protectedPart || relative.startsWith(protectedPart + '/')) {
      throw new Error(`YB safety: protected path ${relative}`);
    }
  }
  return resolved;
}

function assertText(content) {
  if (typeof content !== 'string') throw new Error('Expected text content');
  if (Buffer.byteLength(content, 'utf8') > DEFAULT_MAX_FILE_BYTES) {
    throw new Error('YB safety: file exceeds 512 KiB limit');
  }
  const secretPatterns = [
    /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
    /AIza[0-9A-Za-z_-]{20,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/
  ];
  if (secretPatterns.some((pattern) => pattern.test(content))) {
    throw new Error('YB safety: possible secret detected in proposed content');
  }
}

function assertCommand(command, timeoutMs = DEFAULT_MAX_COMMAND_MS) {
  if (!Array.isArray(command) || command.length === 0) throw new Error('Invalid command');
  const executable = String(command[0]).toLowerCase().replace(/\.exe$/, '');
  if (!SAFE_COMMANDS.has(executable)) {
    throw new Error(`YB safety: command not allowlisted: ${executable}`);
  }
  if (timeoutMs > DEFAULT_MAX_COMMAND_MS) throw new Error('YB safety: command timeout too large');
}

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function ensureStepBudget(step) {
  if (!Number.isInteger(step) || step < 1 || step > DEFAULT_MAX_STEPS) {
    throw new Error(`YB safety: step budget exceeded (max ${DEFAULT_MAX_STEPS})`);
  }
}

function ensureFileExists(root, target) {
  const file = safePath(root, target);
  if (!fs.existsSync(file)) throw new Error(`File does not exist: ${target}`);
  return file;
}

module.exports = {
  repoRoot,
  safePath,
  assertText,
  assertCommand,
  hashContent,
  ensureStepBudget,
  ensureFileExists,
  DEFAULT_MAX_COMMAND_MS,
  DEFAULT_MAX_STEPS
};
