# YB Autonomous Engineer

YB Autonomous Engineer is the maintenance layer for YadavBrowser and Yadav Search.

## Mission

Continuously improve reliability, search quality, performance and maintainability while preserving security and reversibility.

## Modes

- `npm run agent:scan` — inspect syntax, package metadata and Git state without changing files.
- `npm run agent:plan` — ask the configured Gemini model for a JSON improvement plan without applying it.
- `npm run agent:auto` — apply a bounded plan, validate it, and roll it back if validation fails.

Set `GEMINI_API_KEY` before plan/auto mode. Optional `GEMINI_MODEL` selects the Gemini model. `YB_AGENT_GOAL` supplies a one-run objective.

## Safety model

The agent uses `autonomous/constitution.json` as its operating contract. It refuses protected paths, secrets, path traversal, oversized change sets and dirty working trees. Autonomous GitHub Actions run on isolated branches and create pull requests; `main` is not automatically changed by this first version.

## Roadmap

1. Repository inspection and safe code changes.
2. Automated regression and browser tests.
3. Search-quality benchmarks and performance budgets.
4. Autonomous issue discovery and prioritization.
5. Staged deployment and rollback.
6. Optional auto-merge only after strong branch protection and test coverage are in place.
