# Day 64 - Runtime Health Dashboard

Date: 2026-05-11
Lane: Runtime / deployment / security
Status: developer-side PASS, production owner visual status unchanged
Blocker class: NONE for local runtime-health proof

## Objective

Expose a safe runtime health contract in Mission Control so the owner-facing dashboard can show the current runtime commit, local bind posture, standalone bundle status, PID/listener match, and deployment timestamps without exposing secrets or raw local paths.

## Scope

Implemented a protected runtime health endpoint and wired its safe payload into the Mission Control dashboard data model.

The endpoint is intentionally read-only. It does not restart services, does not mutate environment files, and does not execute external writes.

## Files Changed

- `src/lib/runtime-health.ts`
- `src/app/api/runtime/health/route.ts`
- `src/app/api/runtime/health/route.test.ts`
- `src/app/api/status/route.ts`
- `src/components/dashboard/dashboard.tsx`
- `src/components/dashboard/widget-primitives.tsx`
- `src/components/dashboard/widgets/runtime-health-widget.tsx`
- `runtime/day-64-runtime-health-live.json`
- `runtime/day-64-dashboard-runtime-health-live.json`
- `runtime/day-64-runtime-health-dashboard.md`
- `runtime/day-64-runtime-health-dashboard.pdf`

## Routes Changed

- Added protected `GET /api/runtime/health`.
- Extended `GET /api/status?action=dashboard` with `runtimeHealth`.

## UI Behavior

Mission Control dashboard now has a runtime health widget that shows:

- Runtime status.
- Current source commit and branch.
- Expected safe bind host and port.
- Standalone bundle/static readiness.
- PID file and listener match state.
- Last build/static sync timestamps.
- Exact blocker list when the runtime cannot be classified as live.

No raw local filesystem paths are shown. The PID file is reported as a safe relative label only.

## Service / Runtime Behavior

Runtime health detection checks:

- `.next/standalone/server.js` or standalone `server.js`.
- `.next/standalone/.next/static` or `.next/static`.
- `.next/standalone/server.pid` or `server.pid`.
- Local listener PID on the configured port.
- Whether the PID file matches the active listener.

The bind contract remains local-only:

- Expected host: `127.0.0.1`
- Override variable: `MC_HOSTNAME`
- Proof port: `3337`
- No new public exposure added: `true`

## Proof Artifacts

- `runtime/day-64-runtime-health-live.json`
- `runtime/day-64-dashboard-runtime-health-live.json`

Observed live proof:

- Runtime health status: `LIVE`
- Runtime source commit at proof time: `ccc0ce5`
- Branch: `to-knowledge-mc`
- PID file value: `81685`
- Listener PID: `81685`
- PID matched listener: `true`
- Runtime cwd mode: `standalone`
- Raw path leak in dashboard proof artifact: `false`
- Secret output in dashboard proof artifact: `false`

## Tests / Checks

Fresh validation required before commit:

- `git diff --check`
- `pnpm test src/app/api/runtime/health/route.test.ts`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`
- `node scripts/check-protected-file-invariants.mjs`
- staged secret scan
- `.env` diff check

## Deploy / Restart / Smoke

Mission Control standalone was rebuilt and restarted in local-only mode on `127.0.0.1:3337`.

Live smoke results:

- `GET /api/runtime/health` authenticated with API key and session cookie returned `status: LIVE`.
- `GET /api/status?action=dashboard` authenticated included `runtimeHealth`.
- Runtime health proof confirmed no public bind.

## Rollback

Use:

```bash
git revert <day-64-runtime-health-commit-sha>
MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh
```

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No external writes.
- No fake runtime status.
- No raw local paths in staged runtime proof artifacts.

## Next Day

Day 65 starts automatically after commit and push: Protected Route Smoke 100% Closure.
