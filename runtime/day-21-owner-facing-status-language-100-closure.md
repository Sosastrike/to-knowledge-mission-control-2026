# Day 21 — Owner-Facing Status Language 100% Closure

Date: 2026-05-09
Branch: to-knowledge-mc
Code commit: b277980
Push result: pushed to origin/to-knowledge-mc
Status: CLOSED for developer-side Day 21 gate
Blocker class: NONE

## Lane
Day 21 replaced vague implementation states with a canonical owner-facing status contract for the active Mission Control / Gateway surface.

Canonical owner statuses:
- LIVE
- READY
- OWNER_GATED
- CREDENTIAL_GATED
- SERVICE_DOWN
- BLOCKED
- DISABLED

The old internal words remain available as diagnostic fields where needed, but owner-facing API payloads now include `owner_status` with label, summary, reason, blocker class, tone, and read/write/execute truth.

## What Was Implemented
- Added `src/lib/owner-status.ts`.
- Added canonical status descriptors with locked status vocabulary.
- Added owner-safe reason redaction for paths, auth-file names, bearer values, and secret-shaped tokens.
- Wired `owner_status` into Agent Hub agents and supporting runtime systems.
- Added `allowed_owner_statuses` and `owner_status_summary` to `/api/gateway/agent-hub/status`.
- Added `owner_status` descriptors and `allowed_owner_statuses` to `/api/bridge/button-contracts`.
- Updated designer-mounted Agent Hub hydration to use `owner_status.tone` and owner-facing status summaries without changing the locked FULL v3 class names or token source.

## Files Changed
- `src/lib/owner-status.ts`
- `src/lib/owner-status.test.ts`
- `src/lib/gateway-agent-hub.ts`
- `src/lib/gateway-agent-hub.test.ts`
- `src/lib/gateway-agent-hub-designer-data.test.ts`
- `src/lib/button-contracts-route.test.ts`
- `src/app/api/bridge/button-contracts/route.ts`
- `public/designer-mission-control/design/gateway/shared/agent-data.js`

## Routes / Endpoints Changed
- `GET /api/gateway/agent-hub/status`
- `GET /api/gateway/agent-hub/agents`
- `GET /api/gateway/agent-hub/agents/:id`
- `GET /api/gateway/agent-hub/agents/:id/health`
- `GET /api/gateway/agent-hub/registry`
- `GET /api/bridge/button-contracts`

## UI Behavior
- Agent Hub live hydration now maps canonical owner-facing statuses to the locked designer color grammar.
- READY uses blue.
- OWNER_GATED and CREDENTIAL_GATED use yellow.
- SERVICE_DOWN and BLOCKED use red.
- DISABLED uses gray.
- LIVE uses green.
- No FULL v3 rendering classes were renamed.
- `shared/tokens.css` remains the token source.
- No fake execution state was introduced.

## Runtime Proof
Proof artifact: `runtime/day-21-owner-status-language-proof.json`

Runtime bind:
- 127.0.0.1:3337

Runtime PID:
- 92606

Route/API proof:
- `/login` returned 200.
- Unauthenticated `/gateway` redirected to `/login`.
- Unauthenticated `/gateway/agent-hub` redirected to `/login`.
- Unauthenticated `/api/gateway/agent-hub/status` returned 401.
- Session-cookie protected `/gateway` returned 200.
- Session-cookie protected `/gateway/agent-hub` returned 200.
- Runtime-key authenticated `/api/gateway/agent-hub/status` returned 200.
- Runtime-key authenticated `/api/bridge/button-contracts` returned 200.

Agent Hub owner status proof:
- Paperclip: OWNER_GATED
- Agent Zero: READY
- Hermes: OWNER_GATED
- SpaceAgent: READY
- Pi-mono: READY
- OpenClaw+: SERVICE_DOWN

Button contract owner status proof:
- LIVE: 33
- READY: 5
- OWNER_GATED: 12
- CREDENTIAL_GATED: 9
- SERVICE_DOWN: 6
- DISABLED: 7
- BLOCKED: 0

## Tests Run
- `pnpm test src/lib/owner-status.test.ts src/lib/gateway-agent-hub.test.ts src/lib/gateway-agent-hub-designer-data.test.ts src/lib/button-contracts-route.test.ts`
  - 4 files / 12 tests passed.
- `pnpm run typecheck`
  - passed.
- `pnpm run build`
  - passed.
- `pnpm test`
  - 150 files / 1306 tests passed.
- `node scripts/check-protected-file-invariants.mjs`
  - passed.
- `git diff --check`
  - passed.
- Staged secret scan
  - passed.
- `.env` diff check
  - clean.

## Safety
- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No fake Done / fake GO / fake live status.
- No raw local paths added to owner-facing payloads.
- No external writes.
- No SMB/Fork 2.
- No Zapier writes.
- No HeyGen generation.
- No external farmers.

## Rollback
Rollback code commit:

```bash
git revert b277980
```

## Remaining Blocker
None for Day 21 developer-side closure.

System-level blockers remain tracked in their lanes:
- OpenClaw+ runtime doctor remains SERVICE_DOWN until a reachable OpenClaw+ CLI/runtime is installed or exposed to the Mission Control runtime user.
- Paperclip remains OWNER_GATED/SERVICE_DOWN depending the active service/session proof lane.
- Bridge approved execution remains owner-approval gated until an approved scoped action executes.
- Delivery connector lanes remain gated until their credentials/session/Bridge proof gates pass.

## Next Day
Day 22 — Authenticated Visual Proof starts automatically after this report commit.
