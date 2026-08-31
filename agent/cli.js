#!/usr/bin/env node
const { inspect, verify, run } = require('./core');
const { repoRoot } = require('./safety');
const git = require('./git');

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = repoRoot();

  if (command === 'scan') {
    console.log(JSON.stringify(inspect(root), null, 2));
    return;
  }

  if (command === 'verify') {
    const result = verify(root);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (command === 'plan') {
    const task = args.join(' ').trim() || 'Inspect YadavBrowser and identify the highest-value safe improvement.';
    const result = await run(task, { mode: 'plan', root });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === 'auto') {
    const task = args.join(' ').trim() || 'Find and implement one small safe improvement, then verify it.';
    if (git.branch(root) === 'main') {
      throw new Error('Autonomous mode requires an isolated yb-agent/* branch. Run: git switch -c yb-agent/local');
    }
    const result = await run(task, { mode: 'auto', root });
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.status === 'verified' ? 0 : 1;
    return;
  }

  console.log(`YB Agent Core v2\n\nCommands:\n  node agent/cli.js scan\n  node agent/cli.js verify\n  node agent/cli.js plan "task"\n  node agent/cli.js auto "task"`);
}

main().catch((error) => {
  console.error(`YB Agent error: ${error.message}`);
  process.exitCode = 1;
});
