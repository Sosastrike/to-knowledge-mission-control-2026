# Day 39 - Memory / Governance Guardrails

Date: 2026-05-09
Status: DEVELOPER-SIDE PASS
Blocker class: NONE
Source commit: `3703c60`
Push result: pushed to `origin/to-knowledge-mc`

## Lane

Day 39 closes the memory/governance guardrail lane for accidental protected-file changes. It does not modify active agent routing, voice routing, Tony behavior, owner memory, runtime data, `.env`, or governance documents.

## Inventory

- Existing protected-file invariant script: `scripts/check-protected-file-invariants.mjs`.
- Existing coverage before Day 39: `.env` files, database files, `.data/`, private keys, backup archives.
- Gap found: no explicit protection for active memory files/stores or governance stores before staging/commit.
- Active memory route inspected: `src/app/api/memory/route.ts`.
- Per-agent working-memory route inspected: `src/app/api/agents/[id]/memory/route.ts`.
- Shared memory path safety inspected: `src/lib/memory-path.ts`.
- Existing runtime memory paths are path-contained and auth-guarded; no runtime route changes were required for this day.

## Implemented

Updated `scripts/check-protected-file-invariants.mjs` to fail if git status includes protected changes to:

- `active_memory_file`: `WORKING.md` or `MEMORY.md`.
- `active_memory_store`: active memory store directories such as `agent-memory`, `memory-store`, `memory-data`, `openclaw-memory`, `hermes-memory`, `mempalace`, `obsidian-vault`, or root `memory/` and `memories/`.
- `governance_file`: root governance directory or governance metadata files.
- `legacy_tony_identity_store`: legacy Tony identity store directories such as `tony-memory`, `tony-voice`, `tony-routing`, or `tony-governance`.

The script still inspects git status paths only. It does not read or print protected file contents.

## Guardrail Test

Added `scripts/check-protected-file-invariants-self-test.mjs`.

The self-test verifies:

- Runtime reports are allowed.
- Memory source code changes are allowed.
- Active agent `WORKING.md` is blocked.
- Root `MEMORY.md` is blocked.
- Runtime memory store paths are blocked.
- Governance directory changes are blocked.
- Legacy Tony identity stores are blocked.

Red/green note:

- The self-test failed before the invariant update because `agents/agent-zero/WORKING.md` was not blocked.
- The self-test passed after the invariant update.

## UI Behavior

No owner-facing UI was changed on Day 39. This day adds a commit-time protection layer only.

## Service / Runtime Behavior

No service runtime behavior was changed. No restart is required for this script-only guardrail lane.

## Proof Artifact

`runtime/day-39-memory-governance-guardrails-proof.json`

Current proof:

- self-test: PASS, 7 fixtures checked.
- workspace invariant scan: PASS, 0 protected changes.
- `.env` changed: no.
- secrets printed: no.
- auth weakened: no.
- active memory deleted: no.
- governance modified: no.
- Tony routing/voice/memory/governance modified: no.

## Validation

Completed validation:

- `git diff --check` - PASS
- `pnpm run typecheck` - PASS
- `pnpm run build` - PASS
- `pnpm test` - PASS, 159 files / 1331 tests
- `node scripts/check-protected-file-invariants-self-test.mjs` - PASS, 7 fixtures checked
- `node scripts/check-protected-file-invariants.mjs` - PASS, 0 protected changes
- staged secret scan - PASS
- `.env` diff check - clean

Runtime smoke:

- `/login` - 200
- unauthenticated `/api/memory/health` - 401
- unauthenticated `/api/memory?action=tree` - 401
- unauthenticated `/api/agents/agent-zero/memory` - 401

No production restart was performed because Day 39 changed scripts/reports only and did not alter runtime application source.

## Rollback

`git revert 3703c60`

## Next Day

After validation, commit, and push, automatically start Day 40: Knowledge Report 100% Closure.
