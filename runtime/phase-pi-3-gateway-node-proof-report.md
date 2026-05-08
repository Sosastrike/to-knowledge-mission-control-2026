# Phase PI-3 — Pi Gateway Node Proof Report

Generated: 2026-05-07 21:38:52

## Result

**PARTIAL GO / protected route proof.** Gateway contains Pi as the canonical node `pi`, owner-facing Agent Hub ID `pi-mono`, and status endpoint `/api/bridge/pi/status`. The requested `pi_dispatcher` identity is exposed as the canonical role label in the Pi status payload, while the registry-compatible node remains `pi`.

## Routes

| Route | Proof |
| --- | --- |
| `GET /api/gateway/nodes/pi` | unauthenticated returns 401 |
| `GET /api/gateway/nodes/pi-mono` | unauthenticated returns 401; alias protection confirmed |
| `GET /api/bridge/pi/status` | unauthenticated returns 401 |
| `GET /api/gateway/agent-hub/agents/pi-mono` | unauthenticated returns 401 |
| `GET /api/gateway/agent-hub/agents/pi-mono/health` | unauthenticated returns 401 |

## Status Truth

- Gateway node: `pi`
- Canonical role label: `pi_dispatcher`
- Agent Hub ID: `pi-mono`
- Status: shadow/read-only
- Execution enabled: false
- Writes enabled: false
- Public exposure: false
- Blocker: `pi_runtime_session_not_proven`

## Tests Passed

- `src/lib/gateway-agent-hub.test.ts`: 3 passed
- `src/lib/gateway-route-auth.test.ts`: 1 passed
- `src/lib/gateway-pi-dispatcher.test.ts`: 9 passed

## Remaining Blocker

Authenticated owner route payload proof still requires an owner/admin session. Unauthenticated protection is proven.
