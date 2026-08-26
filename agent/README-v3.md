# YB Autonomous Engine v3

YB Autonomous Engine v3 is the continuous engineering loop for YadavBrowser.

## Mission

Continuously improve YadavBrowser and Yadav Search for usefulness, speed, reliability, privacy and maintainability.

## Loop

Observe -> diagnose -> research/plan -> implement -> verify -> benchmark -> keep or rollback -> repeat.

## Commands

- `npm run agent:autonomy -- "task"` — run the bounded autonomous loop.
- `npm run agent:audit` — inspect the latest autonomous audit trail.
- Existing scan/verify/plan/auto commands remain available.

## Power

The agent may inspect and change project source, create/delete project files through the guarded filesystem layer, run allowlisted development commands, use Git on isolated branches, and retry verified work.

## Permanent boundaries

The agent cannot modify secrets/credential stores or protected workflow infrastructure, cannot run directly on main, and cannot remove its recovery/audit path.

These boundaries are part of the operating contract and are not editable by autonomous tasks.
