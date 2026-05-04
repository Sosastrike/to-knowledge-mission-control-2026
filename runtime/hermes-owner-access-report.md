# Hermes Owner Access Report

Date: 2026-05-04

## Summary

Hermes owner access is code-ready in Mission Control, but not live in production yet because `mission-control.service` could not be restarted without interactive admin authentication.

The safe access path is Mission Control, not direct public exposure. Hermes has a user systemd gateway service and an installed CLI/dashboard command, but no standalone Hermes owner UI is currently running. Direct dashboard exposure was not enabled because Hermes dashboard can manage sensitive configuration and must not be opened publicly.

## Decision

Status: partial access ready, production blocked.

Hermes is not fully accessible to the owner yet. The new Mission Control Hermes test chat surface and corrected read-only POST behavior are built and tested, but production is still serving the old route until an admin-authorized restart loads the new standalone build.

Do not claim Hermes live chat until `POST /api/bridge/hermes/test-chat` returns a live response with `hermes_called: true`.

## Runtime Discovery

| Item | Result |
| --- | --- |
| Hermes service name | `hermes-gateway.service` |
| Service scope | user systemd service |
| Service status | active |
| ExecStart | Hermes gateway run command |
| Working directory | Hermes agent installation directory |
| Runtime user | `tony` |
| Process | Python module running Hermes gateway |
| Hermes-owned local HTTP port | none proven |
| Tailnet Hermes UI port | none enabled |
| Standalone UI | dashboard command exists, not running |
| Auth requirement | Hermes auth/config exists, values not exposed |
| Public exposure | not enabled |

Observed non-Hermes ports:

- Port 9876 is an SMTP relay webhook, not Hermes.
- Mission Control production is on port 3337.
- Agent Zero is on its own already-known service port.
- OpenClaw Gateway is local-only.

## Local URL / Tailnet URL

Hermes gateway does not currently expose a verified HTTP chat endpoint.

| Access Surface | Status |
| --- | --- |
| Direct local Hermes UI | not running |
| Direct Tailnet Hermes UI | not enabled |
| Public Hermes UI | blocked by rule |
| Mission Control proxy | code-ready, production restart blocked |
| Owner URL | Mission Control Agent Network Hermes card after restart |

The optional dashboard can be started locally by Hermes, but it was not exposed because binding it to Tailnet/public access without a dedicated auth review could expose sensitive settings.

## Mission Control Changes

Implemented:

1. `POST /api/bridge/hermes/test-chat` now returns a truthful blocked response when no safe live Hermes adapter exists.
2. The route no longer returns a successful-looking response with `hermes_called:false`.
3. Agent Network now shows an owner-facing "Open Hermes Test Chat" box on the Hermes lieutenant card.
4. The UI sends authenticated same-origin POST requests to the Hermes test-chat route.
5. Execution remains disabled.
6. Writes, uploads, and protected actions remain disabled.

## Route Behavior

Latest-build temporary standalone validation:

| Route | Result |
| --- | --- |
| unauthenticated `GET /api/bridge/hermes/status` | 401 |
| authenticated `GET /api/bridge/hermes/status` | 200 |
| unauthenticated `POST /api/bridge/hermes/test-chat` | 401 |
| authenticated `POST /api/bridge/hermes/test-chat` | 503 |

The authenticated POST response correctly returned:

- `ok: false`
- `hermes_called: false`
- `execution_enabled: false`
- `writes_enabled: false`
- `protected_actions_enabled: false`
- blocker: `hermes_safe_live_chat_adapter_not_configured`

Production validation before restart:

| Route | Result |
| --- | --- |
| unauthenticated `GET /api/bridge/hermes/status` | 401 |
| authenticated `GET /api/bridge/hermes/status` | 200 |
| unauthenticated `POST /api/bridge/hermes/test-chat` | 401 |
| authenticated `POST /api/bridge/hermes/test-chat` | 405 |

Production still needs the approved admin restart to load the new route behavior.

## Hermes Live Tests

Live Hermes chat tests were not marked passed.

Reason:

- Hermes does not have a proven safe local chat API.
- Direct CLI one-shot is unsafe for this owner access route because it can load tools and make provider calls.
- Hermes provider auth currently appears degraded for the configured provider path.
- The Mission Control route correctly refuses to fake `hermes_called: true`.

Expected after future live adapter work:

- "Can you see Mission Control?" should return yes only if Hermes was actually called with redacted Mission Control context.
- "Who is the commander?" should answer Agent Zero.
- "What is your role?" should answer lieutenant / skill and workflow specialist.
- "Can you see OpenCloud or Build-Wiki?" should distinguish direct OpenCloud access from Build-Wiki/Farmer status.
- "Can you help Agent Zero create skills?" should answer from the shared skill registry.

## Tests Passed

Mission Control checks:

- `pnpm run typecheck` passed.
- `pnpm run build` passed.
- Full `pnpm test` passed: 99 test files, 1037 tests.
- Focused Hermes bridge test passed: 19 tests.
- Agent Zero full ecosystem gauntlet passed during this run: 10,000 deterministic dry-run scenarios, zero failures.

Latest-build temporary route smoke passed with the intended blocked status.

## Service Status

| Service | Status |
| --- | --- |
| `mission-control.service` | active |
| `hermes-gateway.service` | active |
| Production Mission Control restart | blocked by interactive admin authentication |

Production Mission Control process remains the old process until restarted:

- MainPID: 2077627
- ActiveEnterTimestamp: Sun 2026-05-03 22:33:02 EDT

## Files Changed

Code:

- `src/lib/hermes-bridge.ts`
- `src/lib/hermes-bridge.test.ts`
- `src/components/agent-network/AgentNetworkClient.tsx`

Report:

- `runtime/hermes-owner-access-report.md`

## Commits

- `bd4c64a` fix(mission-control): enable hermes read-only test chat
- `deef4d0` feat(mission-control): add hermes test chat surface
- report commit pending at the time this file was written

## Security Confirmation

- No secrets printed.
- No API keys printed.
- No auth files printed.
- No `.env` files modified.
- No auth weakening.
- No public Hermes port opened.
- No direct Tailnet Hermes UI exposed.
- No raw root shell or Docker socket access given to Hermes.
- No external writes run.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No OpenCloud destruction.

An accidental Hermes CLI invocation attempted a provider call while checking help behavior; it did not complete successfully, and the generated debug dump from that accidental attempt was removed without printing its contents.

## Rollback

Rollback code changes:

```bash
git revert deef4d0
git revert bd4c64a
```

Rollback report:

```bash
git revert <hermes_owner_access_report_commit>
```

Restart after rollback, using the approved admin method:

```bash
systemctl restart mission-control.service
systemctl is-active mission-control.service
```

## Remaining Blockers

1. Production Mission Control restart requires interactive admin authorization.
2. Hermes safe live chat adapter is not configured.
3. Hermes direct standalone dashboard is not running and was not exposed.
4. Hermes configured provider path appears degraded, so direct CLI chat is not safe to use as the owner access path.
5. Owner-facing Mission Control Hermes test chat will not be live until production is restarted.

## Exact Next Step

Run the approved admin restart for `mission-control.service`, then verify:

1. authenticated `GET /api/bridge/hermes/status` returns 200;
2. authenticated `POST /api/bridge/hermes/test-chat` returns 503 with the safe-adapter blocker, not 405;
3. unauthenticated status/test-chat return 401 or 403;
4. Agent Network shows the Hermes lieutenant card with "Open Hermes Test Chat."

After that, build the safe Hermes live adapter separately. Only then should `hermes_called: true` be expected.
