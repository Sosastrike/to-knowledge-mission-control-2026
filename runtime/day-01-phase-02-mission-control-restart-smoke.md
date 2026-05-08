# Day 1 / Phase 2 - Mission Control Restart And Smoke

Generated: 2026-05-08

## Objective

Prove production Mission Control is running the latest pushed code, then run authenticated and unauthenticated route smoke for the core Gateway / Agent ecosystem surfaces.

## Result

**PASS / PARTIAL GO.** Production was restarted through the controlled standalone Next process path. PID and timestamp changed. Core authenticated routes worked. Unauthenticated protected routes returned `401`. Hermes live chat remains honestly blocked by its known safe adapter blocker.

## Branch / HEAD

| Item | Value |
|---|---|
| Branch | `to-knowledge-mc` |
| Production HEAD | `db918dc` |
| Latest pushed HEAD | `db918dc` |

## Restart Proof

| Item | Value |
|---|---|
| Old PID | `3248542` |
| Old timestamp | `Fri May 8 08:24:02 2026` |
| New PID | `3254632` |
| New timestamp | `Fri May 8 08:28:23 2026` |
| `/login` after restart | 200 |
| Mission Control bind | `127.0.0.1:3337` |
| Production proxy bind | Tailnet address on port `3337` |
| Playwright MCP bind | `127.0.0.1:8931` |

## Authenticated Route Smoke

Authenticated API smoke used the existing production API-key auth path. No key value was printed.

| Route | Result | Truth |
|---|---:|---|
| `GET /api/gateway/status` | 200 | Gateway status reachable |
| `GET /api/gateway/registry` | 200 | Gateway registry reachable |
| `GET /api/gateway/agent-hub/status` | 200 | Agent Hub status reachable |
| `GET /api/bridge/agent-zero/status` | 200 | Agent Zero status reachable |
| `POST /api/bridge/agent-zero/test-chat` | 200 | `agent_zero_called` present |
| `GET /api/bridge/hermes/status` | 200 | Hermes status reachable |
| `POST /api/bridge/hermes/test-chat` | 503 | blocked by `hermes_safe_live_chat_adapter_not_configured` |
| `GET /api/bridge/pi/status` | 200 | Pi shadow status reachable |
| `GET /api/bridge/playwright-mcp/status` | 200 | Playwright MCP local-only status reachable |
| `GET /api/bridge/paperclip/status` | 200 | Paperclip bridge status reachable |
| `GET /api/gateway/space-agent/browser/status` | 200 | SpaceAgent browser status reachable |

## Unauthenticated Route Smoke

| Route | Result |
|---|---:|
| `GET /api/gateway/status` | 401 |
| `GET /api/gateway/registry` | 401 |
| `GET /api/gateway/agent-hub/status` | 401 |
| `GET /api/bridge/agent-zero/status` | 401 |
| `POST /api/bridge/agent-zero/test-chat` | 401 |
| `GET /api/bridge/hermes/status` | 401 |
| `POST /api/bridge/hermes/test-chat` | 401 |
| `GET /api/bridge/pi/status` | 401 |
| `GET /api/bridge/playwright-mcp/status` | 401 |
| `GET /api/bridge/paperclip/status` | 401 |
| `GET /api/gateway/space-agent/browser/status` | 401 |

## Services

| Service/process | State |
|---|---|
| Mission Control standalone Next | running, PID `3254632` |
| Playwright MCP | running, local-only on `127.0.0.1:8931` |
| Production proxy | listening on production Tailnet address port `3337` |

## Files Changed

- `runtime/day-01-phase-02-mission-control-restart-smoke.md`
- `runtime/day-01-phase-02-mission-control-restart-smoke.pdf`

## Commands / Routes Used

- production `git rev-parse --short HEAD`
- controlled kill/start of the standalone Next process bound to `127.0.0.1:3337`
- `curl` authenticated route smoke
- `curl` unauthenticated route smoke
- process and port inspection
- log tail secret-pattern count
- `.env` diff check

## Tests

No build/test suite was run in this phase. This phase is production restart and route smoke. Day 1 validation runs typecheck/build/tests after all Day 1 reporting and hygiene checks.

## Blockers

| Blocker | Impact |
|---|---|
| `hermes_safe_live_chat_adapter_not_configured` | Hermes live adapter remains NO-GO. Status route is reachable, but `hermes_called:true` is not proven. |
| `owner_authenticated_browser_session_required` | This phase proves API auth and production restart, not the owner's actual browser session. |

## No-Secrets Confirmation

- No API key value was printed.
- No token value was printed.
- No auth file was printed.
- Last 200 Mission Control log lines had `0` secret-shaped pattern matches.
- `.env` diff check returned no changed env files.
- No public local service exposure was added.

## Rollback

Production is running commit `db918dc`. Roll back only if needed:

```bash
git revert db918dc
```

To restart the previous built artifact, rebuild from the desired commit and restart the standalone process bound to `127.0.0.1:3337`.

## Updated Percentage

Mission Control production restart gate: **GO for restart and protected route smoke**.

Overall ecosystem remains **90% PARTIAL GO** because Hermes, Firecrawl, Paperclip owner login, owner-browser proof, and Bridge Session proof remain unresolved.

## Exact Next Step

Proceed to Day 1 / Phase 3: owner-authenticated browser visual proof. If an owner browser session is unavailable, record `owner_authenticated_browser_session_required` and continue safe non-browser-dependent work.
