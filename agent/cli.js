#!/usr/bin/env node
const { inspect, verify, run } = require('./core');
const { cycle } = require('./autonomy');
const { readRecent } = require('./audit');
const { repoRoot } = require('./safety');
const git = require('./git');

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = repoRoot();
  if (command === 'scan') return console.log(JSON.stringify(inspect(root), null, 2));
  if (command === 'verify') { const result = verify(root); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1; return; }
  if (command === 'plan') { const task = args.join(' ').trim() || 'Inspect YadavBrowser and identify the highest-value safe improvement.'; console.log(JSON.stringify(await run(task, { mode: 'plan', root }), null, 2)); return; }
  if (command === 'auto') { const task = args.join(' ').trim() || 'Find and implement one small safe improvement, then verify it.'; if (git.branch(root) === 'main') throw new Error('Autonomous mode requires an isolated branch'); const result = await run(task, { mode: 'auto', root }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.status === 'verified' ? 0 : 1; return; }
  if (command === 'autonomy') { const task = args.join(' ').trim() || 'Inspect YadavBrowser and make the highest-value small safe improvement.'; const result = await cycle(task, { root }); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.completed ? 0 : 1; return; }
  if (command === 'audit') return console.log(JSON.stringify(readRecent(root), null, 2));
  console.log('YB Autonomous Engine v3\n\nCommands:\n  npm run agent:scan\n  npm run agent:verify\n  npm run agent:plan -- "task"\n  npm run agent:auto -- "task"\n  npm run agent:autonomy -- "task"\n  npm run agent:audit');
}
main().catch(error => { console.error('YB Agent error: ' + error.message); process.exitCode = 1; });