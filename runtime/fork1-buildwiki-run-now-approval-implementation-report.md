# Fork 1 — Build-Wiki Run Now Approval Flow (Scoped)
Date: 2026-05-09  
Status: IMPLEMENTED (scoped), pending owner approval for live dispatch proof

## Scope Executed
- Wired only the **Run Now** approval flow for Build-Wiki / Farmer Sync.
- Kept strict scope to:
  - `action = buildwiki.run_now`
  - `target_service = opencloud-docs-farmer.service`
- Did **not** wire pause/resume/add source/external farmer/SMB or other connectors in this hop.

## Files Changed
1. `/Users/sosastrike/Documents/to-knowledge-mission-control-2026/src/components/agent-network/AgentNetworkClient.tsx`
2. `/Users/sosastrike/Documents/to-knowledge-mission-control-2026/src/app/api/bridge/brain-sync/build-wiki/run-now/route.test.ts`

## Endpoint Added
- No new endpoint was added in this hop.
- Reused existing scoped route:
  - `POST /api/bridge/brain-sync/build-wiki/run-now`
- Existing dispatch route remains the execution surface:
  - `POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch`

## UI Behavior (Updated)
- Build-Wiki Run Now card now shows explicit progress state:
  - `Request run` → `Approval pending` → `Run dispatched / completed`
- State labels now reflect backend `ui_state` truthfully:
  - `pending_approval`, `approved/dispatching`, `completed`, `failed`, `denied`, `expired`
- No fake completion states were introduced.

## Approval Request Behavior
- `POST /api/bridge/brain-sync/build-wiki/run-now`:
  - Requires active Bridge Session with `buildwiki.run_now` scope.
  - Creates owner-channel approval request.
  - Does **not** execute immediately.
  - Returns `ui_state: pending_approval` and execution remains disabled.

## Audit Behavior
- Existing dispatch route preserves audit-path contract:
  - Dispatch writes `bridge_connector_runs` and `bridge_audit_events`.
  - Target service remains hard-guarded to `opencloud-docs-farmer.service`.

## Verification Results
1. `pnpm run typecheck` ✅
2. `pnpm run build` ✅
3. `pnpm run test` ✅ (138 files / 1252 tests)
4. Targeted Run Now route tests ✅
   - blocked without scoped Bridge Session
   - success creates scoped owner approval request and keeps execution disabled
5. `git diff --check` ✅
6. `node scripts/check-protected-file-invariants.mjs` ✅
7. Route smoke script launched with local server:
   - Auth-gated routes rendered correctly for unauthenticated access (307/401 expected)
   - API-key-protected checks were blocked locally with 401 in this environment

## Service/Timer Verification
- Local workstation runtime does not provide `systemctl` (`command not found`), so direct local verification of:
  - `opencloud-docs-farmer.service`
  - `opencloud-docs-farmer.timer`
  is blocked in this environment.
- Live dispatch and service/timer verification must run on the Linux runtime host where systemd is present.

## Secrets / Safety
- No `.env` change.
- No secret/token output.
- No auth weakening.
- No connector broadening.

## Commit / Push
- Pending at time of report writing; will be appended after commit/push.

## Rollback Command
- Will be recorded as:
  - `git revert <commit_sha>`
