const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONSTITUTION = JSON.parse(fs.readFileSync(path.join(__dirname, 'constitution.json'), 'utf8'));
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const MAX_BYTES = 70000;

function run(command, args = []) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  return { code: result.status ?? 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}
function git(args) { return run('git', args); }

function isProtected(file) {
  const normalized = file.replace(/\\/g, '/');
  return CONSTITUTION.protected_paths.some(rule => {
    const r = rule.replace(/\\/g, '/');
    return normalized === r || normalized.startsWith(r);
  });
}

function listFiles(dir = ROOT, prefix = '') {
  const ignored = new Set(['.git', 'node_modules', 'dist', 'out']);
  const result = [];
  for (const name of fs.readdirSync(dir)) {
    if (ignored.has(name) || name.startsWith('.env')) continue;
    const full = path.join(dir, name);
    const rel = path.join(prefix, name).replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) result.push(...listFiles(full, rel));
    else if (stat.size <= MAX_BYTES) result.push(rel);
  }
  return result;
}

function readSnapshot() {
  return listFiles().map(file => {
    try { return `\n--- ${file} ---\n${fs.readFileSync(path.join(ROOT, file), 'utf8')}`; }
    catch { return ''; }
  }).join('');
}

function scan() {
  const checks = [];
  const syntaxFiles = listFiles().filter(f => f.endsWith('.js'));
  for (const file of syntaxFiles) {
    const r = run(process.execPath, ['--check', file]);
    checks.push({ type: 'syntax', file, ok: r.code === 0, output: (r.stderr || r.stdout).trim() });
  }
  const pkg = path.join(ROOT, 'package.json');
  if (fs.existsSync(pkg)) {
    try { JSON.parse(fs.readFileSync(pkg, 'utf8')); checks.push({ type: 'package-json', ok: true }); }
    catch (e) { checks.push({ type: 'package-json', ok: false, output: e.message }); }
  }
  checks.push({ type: 'git', ok: true, output: git(['status', '--short']).stdout.trim() });
  return checks;
}

async function askModel(goal, snapshot, checks) {
  if (!API_KEY) throw new Error('GEMINI_API_KEY is not configured.');
  const prompt = `You are YB Autonomous Engineer for YadavBrowser.\nMISSION:\n${CONSTITUTION.mission}\n\nCONSTITUTION:\n${JSON.stringify(CONSTITUTION, null, 2)}\n\nCURRENT GOAL:\n${goal}\n\nCHECKS:\n${JSON.stringify(checks, null, 2)}\n\nREPOSITORY:\n${snapshot}\n\nReturn ONLY JSON:\n{\"summary\":\"...\",\"changes\":[{\"action\":\"create|update|delete\",\"path\":\"relative/path\",\"content\":\"complete file content for create/update\",\"reason\":\"...\"}],\"tests\":[\"commands\"]}\n\nConstraints: protected paths are immutable; never emit secrets; no paths containing '..'; keep changes small; do not rewrite unrelated files; do not delete functionality merely to hide an error; package-lock changes are allowed only when required by package.json changes.`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } })
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim());
}

function applyPlan(plan) {
  if (!plan || !Array.isArray(plan.changes)) throw new Error('Invalid agent plan.');
  if (plan.changes.length > CONSTITUTION.autonomy.max_files_per_iteration) throw new Error('Plan exceeds file-change limit.');
  const originals = new Map();
  let diffBudget = 0;
  try {
    for (const change of plan.changes) {
      const file = String(change.path || '').replace(/\\/g, '/');
      if (!['create', 'update', 'delete'].includes(change.action)) throw new Error(`Invalid action for ${file}`);
      if (!file || file.startsWith('/') || file.includes('..') || isProtected(file)) throw new Error(`Protected or invalid path: ${file}`);
      const target = path.join(ROOT, file);
      originals.set(file, fs.existsSync(target) ? fs.readFileSync(target) : null);
      if ((change.action === 'create' || change.action === 'update') && typeof change.content !== 'string') throw new Error(`Missing content for ${file}`);
      if (change.content && /(?:GEMINI_API_KEY|OPENAI_API_KEY|ghp_[A-Za-z0-9_]+)/.test(change.content)) throw new Error(`Possible secret in ${file}`);
      if (change.action === 'delete') { if (fs.existsSync(target)) fs.unlinkSync(target); continue; }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, change.content, 'utf8');
      diffBudget += change.content.split(/\r?\n/).length;
    }
    if (diffBudget > CONSTITUTION.autonomy.max_diff_lines_per_iteration) throw new Error('Plan exceeds diff budget.');
  } catch (error) {
    rollback(originals);
    throw error;
  }
  return originals;
}

function rollback(originals) {
  for (const [file, original] of originals) {
    const target = path.join(ROOT, file);
    if (original === null) { if (fs.existsSync(target)) fs.unlinkSync(target); }
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, original); }
  }
}

function validate() {
  const scanResult = scan();
  const syntaxOk = scanResult.filter(x => x.type === 'syntax' || x.type === 'package-json').every(x => x.ok);
  const tests = run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--if-present']);
  return { scan: scanResult, tests: { ok: tests.code === 0, output: (tests.stdout + '\n' + tests.stderr).trim() }, ok: syntaxOk && tests.code === 0 };
}

async function main() {
  const mode = process.argv.includes('--scan') ? 'scan' : process.argv.includes('--auto') ? 'auto' : 'plan';
  if (mode === 'scan') { console.log(JSON.stringify(scan(), null, 2)); return; }
  const status = git(['status', '--porcelain']);
  if (CONSTITUTION.autonomy.require_clean_worktree && status.stdout.trim()) throw new Error('Working tree is not clean. Commit or stash local changes first.');
  const goal = process.env.YB_AGENT_GOAL || 'Inspect YadavBrowser and identify the highest-value safe improvement for reliability, search quality, performance or maintainability.';
  const plan = await askModel(goal, readSnapshot(), scan());
  console.log(`PLAN: ${plan.summary || 'No summary'}`);
  if (mode === 'plan') { console.log(JSON.stringify(plan, null, 2)); return; }
  const originals = applyPlan(plan);
  const verification = validate();
  console.log(JSON.stringify(verification, null, 2));
  if (!verification.ok) {
    rollback(originals);
    throw new Error('Verification failed. Changes were rolled back.');
  }
  console.log('Autonomous iteration completed and verified.');
}

main().catch(err => { console.error(`YB AGENT ERROR: ${err.message}`); process.exit(1); });
