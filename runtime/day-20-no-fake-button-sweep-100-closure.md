# Day 20 - No-Fake-Button Sweep 100% Closure

Date: 2026-05-09T17:26:27Z
Branch: to-knowledge-mc
Status: NONE

## Lane

Mission Control / Gateway / Agent Hub visible control contract.

Day 20 is developer-side closed. The no-fake-button contract is tightened, tested, pushed, deployed into the local-only proof runtime, and live-checked against the production server.

## What Was Implemented

- Tightened the canonical button contract for current runtime truth.
- Reclassified Brain Sync source status from READ_ONLY to CREDENTIAL_REQUIRED when CLAUDECLAW_DASHBOARD_TOKEN is absent.
- Reclassified Build-Wiki farmer logs from READ_ONLY to BACKEND_REQUIRED when the farmer service has not produced a log yet.
- Updated the live button-contract checker so approval-request creation is allowed only for OWNER_APPROVAL_REQUIRED controls when:
  - execution_enabled is not true
  - writes_enabled is not true
  - accepted_for_execution is not true
- Added idempotency to the Build-Wiki Run Now live probe so repeated checks do not create fresh approval spam.
- Kept Build-Wiki Run Now scoped only to approval request creation. No service dispatch occurred.
- Added regression coverage for Day 20 runtime blockers and approval-only actions.

## Files Changed

- src/app/api/bridge/button-contracts/route.ts
- scripts/check-button-contract-live-status.mjs
- src/lib/button-contracts-route.test.ts

## Routes And Endpoints Changed

- /api/bridge/button-contracts
  - Button count: 72
  - LIVE: 14
  - READ_ONLY: 31
  - BACKEND_REQUIRED: 6
  - CREDENTIAL_REQUIRED: 5
  - OWNER_APPROVAL_REQUIRED: 14
  - DISABLED: 2
  - no_fake_success: true
  - protected_execution_enabled: false

No external write route was enabled.

## UI Behavior

Every button in the canonical contract remains one of:

- LIVE
- READ_ONLY
- BACKEND_REQUIRED
- CREDENTIAL_REQUIRED
- OWNER_APPROVAL_REQUIRED
- DISABLED

Blocked/gated actions render with disabled/gated behavior. The contract continues to require:

- fake_success_allowed: false
- protected_execution_enabled: false
- should_render_as_disabled for blocked states
- audit_required when approval_required is true

## Service And Runtime Behavior

- Code commit pushed: 7a29b77aead4396067ccc84b7e789654db187678
- origin/to-knowledge-mc includes: 7a29b77aead4396067ccc84b7e789654db187678
- Deploy script rebuilt standalone bundle for commit 7a29b77.
- Deploy script reported PID 87606 on 127.0.0.1:3337, then the child process exited after readiness.
- Local-only screen-backed proof runtime restored:
  - screen: mc-day20-no-fake-buttons
  - PID: 87746
  - bind: 127.0.0.1:3337
- /login returned 200 on the restored proof runtime.
- No new public exposure was added.

## Tests Run

- git diff --check: pass
- pnpm test src/lib/button-contracts-route.test.ts: pass, 3 tests
- node scripts/check-button-contract-routes.mjs: pass
- pnpm run typecheck: pass
- pnpm run build: pass
- pnpm test: pass, 149 files / 1303 tests
- node scripts/check-protected-file-invariants.mjs: pass
- staged secret scan before code commit: pass
- .env diff check: clean

## Runtime Proof

Proof artifacts:

- runtime/day-20-button-contract-static-proof.json
- runtime/day-20-button-contract-live-proof.json
- runtime/day-20-button-contract-summary.json

Live proof:

- node scripts/check-button-contract-live-status.mjs http://127.0.0.1:3337: pass
- endpoints checked: 52
- skipped allowed missing endpoint: 1
- live contract checked: true

Protected action lock proof:

- scripts/check-protected-actions-locked.mjs http://127.0.0.1:3337: pass, 11 checks
- execution_enabled remained false across protected probes.
- writes_enabled remained false across protected probes.
- Approval request creation occurred only through the owner-approved approval queue path.

Route smoke:

- unauth /gateway -> 307 /login
- auth /gateway -> 200
- unauth /gateway/agent-hub -> 307 /login
- auth /gateway/agent-hub -> 200
- unauth /gateway/bridge-session -> 307 /login
- auth /gateway/bridge-session -> 200
- unauth /api/bridge/button-contracts -> 401
- auth /api/bridge/button-contracts -> 200

## 2026-05-10 Corrective Proof

Day 20 was rechecked after the later auth/runtime changes. The first live
button-contract probe correctly failed unauthenticated with 401, then exposed a
real Build-Wiki Run Now idempotency regression once the local proof cookie was
included.

Corrective implementation:

- Updated scripts/check-button-contract-live-status.mjs to send the local proof
  cookie with the API key when probing the protected local runtime.
- Updated scripts/check-protected-actions-locked.mjs to use the same protected
  local proof context.
- Fixed createBuildWikiRunNowApproval so a repeated idempotency key returns the
  existing Build-Wiki Run Now approval, including expired approvals, instead of
  surfacing a SQLite UNIQUE constraint as 502.
- Added a regression test proving expired Run Now idempotency keys are reused
  safely with execution_enabled=false and accepted_for_execution=false.

Corrective validation:

- git diff --check: pass
- pnpm test src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts
  src/lib/button-contracts-route.test.ts: pass, 2 files / 9 tests
- pnpm run typecheck: pass
- pnpm run build: pass
- pnpm test: pass, 172 files / 1364 tests
- node scripts/check-button-contract-live-status.mjs http://127.0.0.1:3337:
  pass, 55 endpoints checked, 1 allowed missing endpoint skipped
- node scripts/check-protected-actions-locked.mjs http://127.0.0.1:3337:
  pass, 11 protected probes locked
- node scripts/check-mission-control-route-rendering.mjs
  http://127.0.0.1:3337: pass, 46 routes checked, 8 designer pages checked
- node scripts/check-protected-file-invariants.mjs: pass
- .env diff check: clean

Corrective runtime proof:

- Rebuilt standalone bundle after source changes.
- Restarted local-only Mission Control proof runtime on 127.0.0.1:3337.
- Old PID: 82838
- New PID: 89946
- No new public exposure.
- Build-Wiki Run Now probe now returns 200 with approval_request_created=false
  for the existing expired idempotency key. It does not dispatch
  opencloud-docs-farmer.service and does not enable writes.

## Current Honest Blockers Captured By The Contract

- Brain Sync source status: CREDENTIAL_REQUIRED because CLAUDECLAW_DASHBOARD_TOKEN is absent in the proof runtime.
- Build-Wiki farmer logs: BACKEND_REQUIRED because the farmer service has not produced a readable log yet.
- Build-Wiki Run Now: OWNER_APPROVAL_REQUIRED; creates approval request only and does not dispatch opencloud-docs-farmer.service until owner approval.
- Firecrawl jobs: CREDENTIAL_REQUIRED.
- n8n controls: CREDENTIAL_REQUIRED.
- External writes and protected actions: OWNER_APPROVAL_REQUIRED.

## Safety Confirmation

- No .env changes.
- No secrets printed.
- No auth weakening.
- No fake Done.
- No fake GO.
- No external connector write.
- No Zapier write.
- No HeyGen generation.
- No SMB/Fork 2.
- No external farmer.
- No new public local exposure.

## Remaining Blocker

Blocker: none for Day 20 developer-side closure.

Blocker class: NONE

Owner-facing visual confirmation remains part of later authenticated visual proof and UX final pass lanes, not a Day 20 developer blocker.

## Commit And Push

Code commit: 7a29b77aead4396067ccc84b7e789654db187678

Push result: pushed to origin/to-knowledge-mc.

Report commit: pending.

Rollback command:

```bash
git revert 7a29b77aead4396067ccc84b7e789654db187678
```

## Next Day Started

Day 21 - Owner-Facing Status Language has automatically started.
