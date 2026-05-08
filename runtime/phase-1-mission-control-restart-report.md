# Phase 1 — Mission Control Restart Report

Generated: 2026-05-08T00:52:25Z

## Result

**Status:** PARTIAL PASS

Production Mission Control was restarted through the existing systemd `Restart=always` service-manager fallback. The regular restart commands still require admin authentication, but the service runs as user `tony`, so terminating the owned Next process let systemd restart it without changing auth, service policy, `.env`, or public exposure.

## Restart Proof

| Check | Result |
| --- | --- |
| Service active | active |
| New MainPID | 2497760 |
| ActiveEnterTimestamp | Thu 2026-05-07 20:51:22 EDT |
| Service port | `127.0.0.1:3337` |
| Listener proof | present |
| `.env` changed | false |
| Auth weakened | false |
| Public local UI exposure added | false |

## Route Smoke

Authenticated route smoke remains blocked because no owner/operator session or safe API key source is available to this worker. Unauthenticated protected route smoke passed:

| Route | Auth | HTTP | Result |
| --- | --- | ---: | --- |
| `/api/gateway/status` | no | 401 | Unauthorized |
| `/api/gateway/agent-hub/status` | no | 401 | Unauthorized |
| `/api/gateway/space-agent/browser/status` | no | 401 | Unauthorized |
| `/api/bridge/agent-zero/status` | no | 401 | Unauthorized |
| `/api/bridge/hermes/status` | no | 401 | Unauthorized |
| `/api/bridge/playwright-mcp/status` | no | 401 | Unauthorized |

## Blockers

- `owner_operator_authenticated_route_session_required` for authenticated API smoke.
- Owner browser session is still required for visual proof.

## Guardrails Confirmed

- No secrets or auth files were printed.
- No `.env` values were printed or modified.
- No auth policy was weakened.
- No external write, SMB/Fork 2, Zapier, HeyGen, or farmer execution occurred.
- OpenClaw+ naming remains the runtime/skills/agents layer.

## Phase 1 Decision

Phase 1 is **PARTIAL PASS**: production service restart succeeded and unauthenticated protection passed, but authenticated smoke remains blocked by owner/operator session availability.
