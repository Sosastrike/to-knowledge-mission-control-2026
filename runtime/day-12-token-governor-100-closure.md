# Day 12 - Token Governor 100% Closure

Date: 2026-05-09
Branch: to-knowledge-mc
Lane: Token Governor
Status: DEVELOPER-SIDE CLOSED
Blocker class: NONE for the Day 12 preflight enforcement surface
Code commit: 0993942ad756a8ed1429c18c17459c7407dac199
Rollback: git revert 0993942ad756a8ed1429c18c17459c7407dac199

## Scope

Day 12 closes the Token Governor preflight lane. It adds a real budget/model enforcement surface that can be called before model/provider execution, persists safe audit rows, and reports truthful allow/warn/block decisions without changing provider routing or enabling writes.

This is not a claim that every model call in Mission Control is fully hard-wired through Token Governor yet. That broader cross-route enforcement belongs to later dispatcher/status-consistency and no-fake-action days. Day 12 acceptance is the working preflight route, tests, runtime proof, and safe audit behavior.

## What Was Implemented

- Added a canonical Token Governor preflight evaluator.
- Added budget states:
  - within_budget
  - warning
  - blocked
  - missing_budget
  - model_restricted
- Added decisions:
  - allow
  - warn
  - block
- Added blocker reasons:
  - token_governor_budget_warning
  - token_governor_budget_exhausted
  - token_governor_budget_missing
  - token_governor_model_restricted
- Added restricted model/provider preflight blocking for expensive or explicitly restricted routes.
- Added owner-safe text sanitization before audit persistence.
- Added safe audit event shape:
  - event: token_governor.preflight
  - no_secrets_exposed: true
  - raw_paths_exposed: false
  - external_write: false
- Confirmed Token Governor preflight never enables:
  - execution
  - writes
  - external writes
  - provider route changes

## Files Changed

- src/lib/token-governor.ts
- src/lib/token-governor.test.ts
- src/app/api/gateway/token-governor/route.ts
- src/app/api/gateway/token-governor/route.test.ts

Parked duplicate artifacts remained untracked and were not staged.

## Routes / Endpoints Changed

### GET /api/gateway/token-governor

Purpose: authenticated status/readiness.

Behavior:
- Requires viewer authentication.
- Returns canonical_status: READY.
- Returns token_usage summary when available.
- Confirms enforcement_enabled: true.
- Confirms execution_enabled, writes_enabled, external_writes_enabled, and provider_route_changes_enabled are false.

### POST /api/gateway/token-governor

Purpose: authenticated preflight evaluation.

Behavior:
- Requires operator authentication.
- Accepts scope, subject_id, subject_name, model, spent/projected/budget cents, and optional token estimates.
- Calculates projected cost when token estimates are provided.
- Loads subject spend from token_usage when spent_cents is omitted.
- Returns:
  - 200 for allow
  - 200 for warn
  - 409 for block
- Persists a safe audit_log row with action token_governor.preflight.
- Does not execute a model call.
- Does not route to a provider.
- Does not write externally.

## UI Behavior

The existing Gateway FULL v3 designer route remains mounted and unchanged. No designer token/class changes were made.

The new API gives the Gateway Token Governor page a real status/preflight data source. Later UI days can hydrate visible budget controls from this endpoint without inventing fake live status.

## Service / Runtime Behavior

Build and standalone deployment were run from commit 0993942.

Deployment note:
- The first deploy script run used its default bind shape and exited before route smoke.
- That process was stopped.
- Final runtime proof used a controlled local-only listener:
  - host: 127.0.0.1
  - port: 3337
  - pid: 35869
  - route-smoke key: synthetic local smoke key

Final listener check showed only 127.0.0.1:3337 for the proof runtime.

## Runtime Proof

Smoke base: http://127.0.0.1:3337

Results:
- GET /login: 200
- GET /api/gateway/token-governor unauthenticated: 401
- GET /api/gateway/token-governor authenticated: 200
  - ok: true
  - canonical_status: READY
  - enforcement_enabled: true
  - execution_enabled: false
  - writes_enabled: false
  - external_writes_enabled: false
- POST preflight allow: 200
  - decision: allow
  - audit_persisted: true
  - execution_enabled: false
  - writes_enabled: false
  - external_writes_enabled: false
- POST preflight warning: 200
  - decision: warn
  - blocked_reason: token_governor_budget_warning
  - audit_persisted: true
- POST preflight budget exhausted: 409
  - decision: block
  - blocked_reason: token_governor_budget_exhausted
  - audit_persisted: true
- POST preflight restricted model: 409
  - decision: block
  - blocked_reason: token_governor_model_restricted
  - audit_persisted: true

Protected action invariant live check:
- scripts/check-protected-actions-locked.mjs against http://127.0.0.1:3337
- ok: true
- checked: 11
- execution and writes remained disabled for protected actions.

## Tests Run

- pnpm test src/lib/token-governor.test.ts src/app/api/gateway/token-governor/route.test.ts
  - 2 files passed
  - 9 tests passed
- git diff --check
  - passed
- pnpm run typecheck
  - passed
- pnpm run build
  - passed
  - route list included /api/gateway/token-governor
- pnpm test
  - 144 files passed
  - 1281 tests passed
- node scripts/check-protected-file-invariants.mjs
  - ok: true
- staged secret scan
  - no matches
- .env diff check
  - clean
- MISSION_CONTROL_API_KEY synthetic smoke context + scripts/check-protected-actions-locked.mjs
  - ok: true

## Safety Confirmation

- No .env changes.
- No secrets printed.
- No auth weakening.
- No fake send/upload/execution.
- No provider route changes.
- No external writes.
- No new durable public local exposure.
- No raw owner path exposure in API payloads.
- No parked artifacts staged.

## Remaining Blockers

None for the Day 12 preflight enforcement acceptance gate.

Known future work:
- Later dispatcher/model-call days must wire every relevant provider execution path through the Token Governor preflight before execution.
- Later UI days must hydrate the designer Token Governor page from this endpoint without changing the accepted FULL v3 design contract.

## Closeout Ledger

- Day number and lane: Day 12 - Token Governor
- Status: DEVELOPER-SIDE CLOSED
- Blocker classification: NONE
- Commit hash: 0993942ad756a8ed1429c18c17459c7407dac199
- Push result: pushed to origin/to-knowledge-mc
- Deployed commit: 0993942
- Runtime proof: local-only standalone proof on 127.0.0.1:3337, pid 35869
- Rollback command: git revert 0993942ad756a8ed1429c18c17459c7407dac199
- Next day automatically started: Day 13 - Mission Control Shell 100% Closure
