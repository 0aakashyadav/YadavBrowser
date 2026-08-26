# YB Agent Core v2

YB Agent Core is the controlled autonomous layer for YadavBrowser. It is inspired by the modular architecture of openbrowser, but is implemented independently for Electron.

## Layers

- `core.js` — observe/plan/act/verify loop
- `session.js` — persistent task/session state
- `safety.js` — path, command, secret and budget guardrails
- `browser.js` — browser observation and interaction tools
- `filesystem.js` — safe repository inspection and edits
- `git.js` — isolated branch/commit helpers
- `model.js` — provider-neutral model interface with Gemini adapter
- `cli.js` — local inspection and agent entry point

## Safety model

The agent works in a dedicated branch, refuses protected paths, blocks secret material, limits command execution, and records every action. It should not be allowed to push directly to `main` or alter credentials.

## Environment

Optional:

- `GEMINI_API_KEY` — enables model planning
- `GEMINI_MODEL` — model name, defaults to `gemini-2.5-flash`
- `YB_AGENT_ROOT` — repository root override
- `YB_AGENT_MAX_STEPS` — maximum loop iterations, default 8

## Commands

```text
npm run agent:scan
npm run agent:plan -- "inspect Yadav Search and propose improvements"
npm run agent:verify
```

The v2 core deliberately starts in **proposal/verification mode**. Autonomous changes are staged behind explicit tool permissions so the system can become more autonomous without making `main` disposable.
