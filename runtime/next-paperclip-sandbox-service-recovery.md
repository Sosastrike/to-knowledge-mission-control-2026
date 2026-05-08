# NEXT-2 — Paperclip Sandbox Service Recovery

## Objective
Move Paperclip from `paperclip_sandbox_service_not_running` toward live health proof in local/Tailnet-safe mode.

## Result
PARTIAL+ (Tailnet Paperclip health is reachable directly, and Mission Control now includes an automatic Tailnet fallback candidate derived from the Mission Control public host; owner login proof is still pending).

## Actions Executed
1. Probed local loopback Paperclip health endpoint.
2. Probed Tailnet Paperclip health endpoint.
3. Implemented Paperclip endpoint candidate fallback in runtime code:
   - when loopback is unavailable and no explicit Paperclip endpoint is set,
   - derive Tailnet host from `NEXT_PUBLIC_APP_URL` / `MC_PUBLIC_BASE_URL` / `APP_URL` / `MISSION_CONTROL_PUBLIC_URL`,
   - probe `http(s)://<tailnet-host>:3100`.
4. Added regression test covering loopback failure + Tailnet fallback success.
5. Confirmed no public exposure changes were introduced.
6. Prepared exact owner/admin runtime wiring package for cases where environment requires explicit endpoint pinning.

## Proof
- `http://127.0.0.1:3100/api/health` -> unreachable from this runtime context.
- `http://100.116.35.95:3100/api/health` -> `200` with `{"status":"ok","deploymentMode":"authenticated","bootstrapStatus":"ready",...}`.

## Interpretation
- Paperclip service is reachable on Tailnet endpoint.
- Bridge runtime now has a safe automatic Tailnet fallback path for Paperclip health checks.
- Paperclip remains non-GO because owner login/session and live workforce data routes are still not proven.

## Exact Owner/Admin Action Package
1. Set Mission Control runtime Paperclip endpoint via service manager (not `.env` file edits):
   - `PAPERCLIP_API_URL=http://100.116.35.95:3100`
2. Restart Mission Control runtime.
3. Re-run:
   - `GET /api/bridge/paperclip/status`
   - `GET /api/bridge/paperclip/companies`
   - `GET /api/bridge/paperclip/agents`
   - `GET /api/bridge/paperclip/issues`
4. Keep writes blocked until Bridge Session scope and adapter proof are complete.

## Current Blockers
- `paperclip_owner_session_required`
- `paperclip_auth_required_or_not_configured` (for company/agent/issue reads when owner session is absent)

## Safety Confirmations
- No public exposure added.
- No production secrets used.
- No `.env` changes.
- No auth weakening.

## Files Changed
- `src/lib/paperclip-bridge.ts`
- `src/lib/paperclip-bridge.test.ts`
- `runtime/next-paperclip-sandbox-service-recovery.md`
- `runtime/next-paperclip-sandbox-service-recovery.pdf`

## Next Step
After endpoint/runtime wiring, re-run Paperclip bridge read-only routes and owner-login lane.
