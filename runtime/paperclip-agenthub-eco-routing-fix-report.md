# Paperclip AgentHub ECO Routing Fix Report

Generated: 2026-05-14

## Final Status

Status: PARTIAL GO

Paperclip is reachable and owner-facing AgentHub routing is now normalized to the owner-accessible ECO company. Paperclip writes remain Bridge-gated and were not enabled.

## Root Cause Found

The Paperclip runtime was reachable, but Mission Control had stale Paperclip owner-facing routes in multiple places:

- The static Paperclip detail page still showed the legacy `/gateway/agents/paperclip` route and old root Paperclip URL.
- Several buttons were still wired to generic pages, no-op handlers, or raw/readability-defective status paths.
- The newer AgentHub control routes existed under `/gateway/agent-hub/paperclip/...`, but the legacy `/gateway/agents/paperclip` route was not normalized into the same control-plane view.
- The owner-accessible company is ECO, while TOK remains a separate legacy company access warning.

## Files Changed

- `gateway-dropin/src/components/gateway/GatewayShell.tsx`
- `gateway-dropin/src/components/gateway/gateway-actions.ts`
- `gateway-dropin/src/components/gateway/gateway-status-contracts.ts`
- `gateway-dropin/public/design/gateway/Paperclip.html`
- `gateway-dropin/public/design/gateway/shared/agent-data.js`
- `gateway-dropin/design-lock/gateway-manifest.json`
- `gateway-dropin/tests/gateway-shell.test.ts`
- `src/app/api/bridge/paperclip/[resource]/route.ts`
- `src/app/api/bridge/paperclip/status/route.ts`
- `src/app/api/bridge/paperclip/companies/route.ts`
- `src/app/api/bridge/paperclip/agents/route.ts`
- `src/app/api/bridge/paperclip/issues/route.ts`
- `src/app/api/paperclip/status/route.ts`
- `src/lib/paperclip-live-status.ts`
- `src/lib/agent-local-interfaces.ts`

## Paperclip Button Behavior

| Button | Final behavior |
| --- | --- |
| Open UI | Opens `http://100.116.35.95:3100/ECO/dashboard` in a new tab. No Bridge Session required. |
| Open in New Tab | Opens `http://100.116.35.95:3100/ECO/dashboard` in a new tab. |
| Open Config | Opens `/gateway/agent-hub/paperclip/config`. |
| Open Tools | Opens `/gateway/agent-hub/paperclip/tools`; no raw JSON owner page. |
| Health | Opens `/gateway/agent-hub/paperclip/status`, a readable status page backed by JSON. |
| Status Only | Opens `/gateway/agent-hub/paperclip/status`. |
| Companies | Opens `/gateway/agent-hub/paperclip/companies` and scopes owner-facing routing to ECO. |
| Agents / Agent Clip | Opens `/gateway/agent-hub/paperclip/agents`. |
| Issues | Opens `/gateway/agent-hub/paperclip/issues`. |
| Audit | Opens `/gateway/agent-hub/paperclip/audit`; if no audit source is connected, it shows a readable empty state. |
| Help | Opens `/gateway/agent-hub/paperclip/help`. |
| Bridge Session | Still required for write/run/mutate actions. |
| Send command / Pause queue / Restart / task creation | Remain write/protected actions and are not enabled by this fix. |

## JSON Endpoint Fixed

Paperclip readable pages now use JSON-backed status routes instead of trying to parse Paperclip HTML pages as JSON:

- `/api/paperclip/status`
- `/api/bridge/paperclip/status`
- `/api/bridge/paperclip/companies`
- `/api/bridge/paperclip/agents`
- `/api/bridge/paperclip/issues`

Unauthenticated requests to protected API routes correctly return JSON `401`, not an HTML page.

## Routes Fixed

Normalized owner-facing Paperclip routes:

- `/gateway/agent-hub/paperclip`
- `/gateway/agent-hub/paperclip/status`
- `/gateway/agent-hub/paperclip/config`
- `/gateway/agent-hub/paperclip/companies`
- `/gateway/agent-hub/paperclip/agents`
- `/gateway/agent-hub/paperclip/issues`
- `/gateway/agent-hub/paperclip/tools`
- `/gateway/agent-hub/paperclip/audit`
- `/gateway/agent-hub/paperclip/help`

Legacy `/gateway/agents/paperclip` now normalizes to the Paperclip readable status control page instead of serving stale behavior.

## Old/Stale Route References Removed

Production grep confirmed no stale owner-facing references remained in the scoped Paperclip/Gateway files for:

- `/gateway/agents/paperclip`
- root `100.116.35.95:3100/` owner UI button targets
- `paperclip.tail-scale`
- owner-facing "No company access" route targets

Base health constants such as `http://100.116.35.95:3100/api/health` remain valid and are not owner UI launch targets.

## Production Smoke Results

Production host: `100.116.35.95`

Mission Control restart:

- Previous PID: `577586`
- New PID: `620766`
- Restart timestamp: `Thu 2026-05-14 13:49:12 EDT`
- Service state: `active`

Route smoke:

- `http://127.0.0.1:3337/login` -> `200`
- `https://tkmc.knowledge-vs-ai.com/login` -> `200`
- Protected `/gateway` routes -> `307` to `/login` when unauthenticated
- `https://tkmc.knowledge-vs-ai.com/api/bridge/paperclip/status` -> `401` JSON when unauthenticated
- Deployed static Paperclip page contains `http://100.116.35.95:3100/ECO/dashboard`

Direct Paperclip ECO routes:

- `http://100.116.35.95:3100/ECO/dashboard` -> `200`
- `http://100.116.35.95:3100/ECO/agents` -> `200`
- `http://100.116.35.95:3100/ECO/issues` -> `200`

## Validation

Local validation:

- `git diff --check` passed.
- `pnpm --dir gateway-dropin run design-lock:verify` passed.
- `pnpm --dir gateway-dropin run typecheck` passed.
- `pnpm --dir gateway-dropin test -- gateway-shell.test.ts` passed: 51 tests.
- `pnpm run typecheck` passed.
- `pnpm run build` passed.
- `pnpm --dir gateway-dropin run build` passed.
- `pnpm run safety:ui-actions` passed locally with owner-auth live proof still owner-gated.
- `.env` diff check: no changes.

Production validation:

- `git diff --check` passed.
- Production stale-route grep passed.
- `pnpm --dir gateway-dropin run typecheck` passed.
- `pnpm --dir gateway-dropin test -- gateway-shell.test.ts` passed: 51 tests.
- `pnpm run typecheck` passed.
- `pnpm --dir gateway-dropin run build` passed.
- `pnpm run build` passed.
- `.env` diff check: no changes.

Note: the production host does not currently include the local `safety:ui-actions` package script or matching script file, so the safety action scan was run locally against the current code.

## Secret Scan Result

No credential values, cookies, tokens, auth files, passwords, or invite URLs were added or printed.

The scoped diff contains policy words such as "token", "session", "cookies", and "Bridge Session" only in explanatory status text. No secret values were present.

## Write Policy

Paperclip writes remain Bridge-gated.

No Paperclip tasks were created. No Paperclip comments were created. No issues were modified. No database membership edits were made. No `.env` changes were made.

Future Paperclip task writes still require:

- Bridge Session
- write adapter proof
- exact write scope
- owner approval
- audit trail
- rollback path

## TOK Legacy Company State

TOK remains a separate legacy company blocker. This fix does not repair TOK and does not route owner-facing Paperclip actions to TOK.

Owner-facing Paperclip routing now uses ECO only.

## Rollback

Production backup before deployment:

`/tmp/mc-paperclip-eco-backup-20260514134238`

Rollback command:

```bash
sudo systemctl stop mission-control.service
cd /home/tony/mission-control
cp -a /tmp/mc-paperclip-eco-backup-20260514134238/. .
pnpm run build
sudo systemctl start mission-control.service
```

## Owner Retest

Owner should hard refresh:

`https://tkmc.knowledge-vs-ai.com/gateway/agent-hub?refresh=paperclip-eco-20260514`

Then verify:

1. Paperclip card does not say `NOT INSTALLED`.
2. Paperclip Open UI opens `http://100.116.35.95:3100/ECO/dashboard`.
3. Config, status, tools, companies, agents, issues, audit, and help pages do not redirect to the generic Control Center.
4. Health/status no longer says "Endpoint did not return a readable JSON status packet."
5. Writes remain Bridge-gated.
