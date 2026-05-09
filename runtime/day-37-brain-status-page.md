# Day 37 — Brain Status Page

Date: 2026-05-09
Lane: Brain / Build-Wiki / Farmer
Status: CLOSED AS CREDENTIAL_GATED
Blocker class: CREDENTIAL_GATED

## Phase 0–10 Safety

- Branch: `to-knowledge-mc`
- Repo: Mission Control workspace
- No `.env` edits planned or required.
- No secret values are printed or written.
- No auth weakening.
- No Brain writes enabled.
- No Build-Wiki execution added.
- No SMB/Fork 2/external farmer/second vault path added.

## Phase 10–20 Inventory

### Existing Routes

- `GET /api/bridge/brain-sync/status`
- `POST /api/bridge/brain-sync/rebuild`
- `GET /api/bridge/agent-zero/obsidian`
- `GET /api/bridge/agent-zero/mempalace`
- `GET /api/bridge/brain-sync/build-wiki/status`
- `GET /api/bridge/brain-sync/build-wiki/files`
- `GET /api/bridge/brain-sync/build-wiki/logs`

### Existing Local Adapters

- Obsidian read-only adapter:
  - `src/lib/agent-zero-obsidian-adapter.ts`
  - Status, search, read, summarize.
  - Writes exist as Bridge-gated adapter methods only and are not enabled by Day 37.
- MemPalace read-only adapter:
  - `src/lib/agent-zero-mempalace-adapter.ts`
  - Status and safe summaries.
  - Raw private dumps disabled.
- Build-Wiki / Farmer status:
  - `src/app/api/bridge/brain-sync/build-wiki/status/route.ts`
  - Run Now approvals and audit history already exposed read-only.

### Defect Found

`GET /api/bridge/brain-sync/status` returned 503 when the ClaudeClaw dashboard connection was absent, even though Mission Control had enough local read-only adapters to report truthful Brain status.

### Required Fix

Keep the upstream ClaudeClaw connection as enrichment, but do not let its absence hide local read-only Brain status. The endpoint should return:

- Obsidian status and index count when visible.
- MemPalace status and safe count/index fields when visible.
- Build-Wiki / Farmer approval/run history visibility.
- Graphify as blocked/not connected when no adapter is visible.
- All Brain writes disabled.
- Owner-facing status descriptors for each Brain source/system.
- No raw local paths.
- No secret-shaped output.

## Phase 20–45 Implementation Direction

- Add local fallback to `GET /api/bridge/brain-sync/status`.
- Add regression tests for the missing-upstream path.
- Update button contracts so Brain Sync source status is read-only/live instead of credential-required.
- Mount the accepted designer Brain Systems page at `/gateway/brain`.

## Completion Gate

Day 37 can close only after:

- Focused tests pass.
- Full validation passes.
- Runtime proof shows authenticated Brain status returns local read-only source/system truth.
- Report/PDF are generated.
- Source and report commits are pushed.

## Phase 20–45 Implemented Backend/API Behavior

- `GET /api/bridge/brain-sync/status` no longer hard-fails when the ClaudeClaw dashboard connection is absent.
- The route still records the upstream blocker:
  - `claudeclaw_dashboard_token_missing`
- The route now returns local read-only Brain status from:
  - Obsidian adapter
  - MemPalace adapter
  - Build-Wiki / Farmer approval/run history
- Graphify remains honestly blocked/not connected unless its adapter appears.
- Brain writes remain disabled:
  - `production_memory_writes_enabled=false`
  - `protected_memory_changes_enabled=false`
  - `shared_brain_writes_enabled=false`
  - `mempalace_writes_enabled=false`
  - `external_connector_writes_enabled=false`

## Phase 45–65 Implemented UI/Status Behavior

- Added `/gateway/brain` and mounted the accepted designer `Brain Systems.html` page.
- Updated button contracts so Brain Sync source status is `READ_ONLY` instead of `CREDENTIAL_REQUIRED`.
- Kept the route read-only; no write button, rebuild action, or protected Brain mutation was enabled.
- Owner-facing status descriptors are included on Brain sources and Brain systems.

## Files Changed

- `src/app/api/bridge/brain-sync/status/route.ts`
- `src/app/api/bridge/brain-sync/status/route.test.ts`
- `src/app/api/bridge/button-contracts/route.ts`
- `src/lib/button-contracts-route.test.ts`
- `src/app/gateway/brain/page.tsx`

## Tests Run

- `pnpm test src/app/api/bridge/brain-sync/status/route.test.ts src/lib/button-contracts-route.test.ts`
- `git diff --check`
- `node scripts/check-protected-file-invariants.mjs`
- `.env` diff check
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`

Full test result:

- Test files: 158 passed
- Tests: 1328 passed

## Runtime Proof

Proof artifact:

- `runtime/day-37-brain-status-proof.json`

Runtime:

- Bind: `127.0.0.1:3337`
- PID after restart: `50544`
- Deployed/source commit: `5dd8b5369ac57d9a629e70fd1d17fcc1fe520f46`

Verified:

- `/login` returned 200.
- Unauthenticated `GET /api/bridge/brain-sync/status` returned a protected response.
- Authenticated `GET /api/bridge/brain-sync/status` returned 200.
- Brain status returned `ok=true`.
- Obsidian, MemPalace, and Build-Wiki source entries are present.
- Build-Wiki system is visible read-only.
- Brain writes are disabled.
- Brain Sync button contract is `READ_ONLY`.
- `/gateway/brain` is reachable/protected as a Gateway page.
- No secret-shaped values in the Brain status payload.
- No raw local paths in the Brain status payload.
- No public local exposure.

## Commit / Push

Source commit:

```text
5dd8b5369ac57d9a629e70fd1d17fcc1fe520f46
```

Push result:

```text
origin/to-knowledge-mc contains 5dd8b5369ac57d9a629e70fd1d17fcc1fe520f46
```

## Rollback

```bash
git revert 5dd8b5369ac57d9a629e70fd1d17fcc1fe520f46
```

## Remaining Blocker

```text
CREDENTIAL_GATED: claudeclaw_dashboard_token_missing
```

This blocker now affects upstream ClaudeClaw enrichment only. It no longer blocks local Mission Control Brain status visibility.

## Next Day Started

Day 38 — Obsidian / Local Knowledge is next.
