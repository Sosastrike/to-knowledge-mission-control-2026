# Playwright MCP Developer Handoff Report

Generated: 2026-05-07

## Purpose

This handoff documents the Playwright MCP production integration work for the Gateway / SpaceAgent browser automation track.

Playwright MCP is a **tool server**, not an agent. It is owned by SpaceAgent, routed and governed by Gateway, supervised by Agent Zero, and subject to Bridge Session policy for interactive or sensitive actions.

## Architecture Placement

Owner → Gateway → Pi / Agent Zero / Hermes → SpaceAgent → Playwright MCP

- Agent Zero remains commander.
- Hermes remains lieutenant and workflow/skill builder.
- Pi remains dispatcher candidate.
- SpaceAgent owns browser, web, YouTube, Firecrawl, and Playwright MCP research.
- Playwright MCP provides local browser automation evidence only.
- OpenCloud and OpenClaw+ remain intact.

## Runtime Service

Recommended and deployed runtime mode:

```bash
npx -y @playwright/mcp@0.0.74 --headless --isolated --browser=firefox --port 8931 --host 127.0.0.1 --allowed-hosts localhost:8931,127.0.0.1:8931 --output-mode file --snapshot-mode full --console-level info --block-service-workers
```

Notes:

- Current package accepts `firefox`, `webkit`, `chrome`, and `msedge`; it does not accept `chromium` as a browser option.
- Chrome install requires administrator permission on this host.
- Firefox was installed through the package browser installer and verified.
- Service is local-only and not exposed publicly.

## Mission Control Files

Implemented files:

- `src/lib/playwright-mcp.ts`
- `src/app/api/bridge/space-agent/playwright-mcp/status/route.ts`
- `src/app/api/gateway/space-agent/playwright-mcp/evidence/route.ts`

Updated files:

- `src/app/api/bridge/space-agent/status/route.ts`
- `src/components/gateway-agent-hub/AgentHubControlCenter.tsx`
- `src/lib/gateway-agent-hub.ts`
- `src/lib/gateway-model.ts`
- `src/lib/gateway-registry-api.ts`
- `src/lib/space-agent-api.ts`
- `src/lib/space-agent-health.test.ts`
- `src/lib/space-agent-routes.test.ts`
- `src/lib/gateway-agent-hub.test.ts`
- `src/lib/gateway-model.test.ts`
- `src/lib/gateway-registry-api.test.ts`

## New API Routes

### `GET /api/bridge/space-agent/playwright-mcp/status`

Auth: viewer required.

Behavior:

- Connects to local MCP endpoint.
- Lists MCP tools.
- Reports local-only endpoint summary.
- Reports browser mode, transport, and blocker state.
- Never returns credentials, auth files, cookies, storage state, or raw filesystem paths.

### `POST /api/gateway/space-agent/playwright-mcp/evidence`

Auth: operator required.

Behavior:

- Accepts a safe public URL.
- Blocks localhost/private-network/file/data URLs.
- Navigates with Playwright MCP.
- Returns a Browser Evidence Packet:
  - packet id
  - Gateway flow id
  - source URL
  - retrieved timestamp
  - snapshot excerpt
  - screenshot reference status
  - console summary
  - network summary
  - blockers
  - no external write flag

## Gateway Registry Contract

SpaceAgent now reports:

- `playwright_mcp_status: connected_local_only`
- `playwright_mcp_endpoint: localhost:8931/mcp`
- `playwright_mcp_service: playwright-mcp.service`
- `playwright_mcp_transport: streamable_http`
- `playwright_mcp_browser_mode: headless_firefox_isolated`
- `playwright_mcp_public_exposure: false`
- `playwright_mcp_interactive_actions_bridge_session_required: true`
- `playwright_mcp_authenticated_browsing_owner_approval_required: true`

Firecrawl remains separate:

- Firecrawl credential configured: no
- Firecrawl status: blocked
- Firecrawl blocker: `firecrawl_missing_credential`

## Policy Rules

- Discovery and safe public evidence are read-only.
- Interactive browser actions require Bridge Session.
- Authenticated browsing requires owner-approved scope.
- Login-required pages, private accounts, CAPTCHAs, paywalls, and restricted content are blocked unless explicitly approved.
- Playwright MCP cannot send email, upload files, run Build-Wiki, run Zapier, generate HeyGen, mount SMB, access Docker socket, read secrets, or become commander.

## Verification

Automated validation passed:

- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`
- Targeted SpaceAgent and Gateway route tests

Full suite result:

- 132 test files passed.
- 1,234 tests passed.

Runtime smoke result:

- MCP service active.
- Tool count: 23.
- `browser_navigate` succeeded.
- `browser_snapshot` succeeded.
- Snapshot contained the expected safe test page content.
- Listener bound to `127.0.0.1:8931` only.

## Deployment State

Committed:

- `d1d9bcc` — `feat(gateway): wire playwright mcp for spaceagent browser evidence`

Blocked:

- Production Mission Control restart requires administrator authentication.
- Browser smoke through production Mission Control must wait until the root service is restarted.

## Production Restart Procedure

An administrator should restart Mission Control:

```bash
systemctl restart mission-control.service
```

Then verify:

```bash
systemctl is-active mission-control.service
systemctl show mission-control.service -p MainPID -p ActiveEnterTimestamp
```

After restart, run authenticated checks:

```bash
GET /api/bridge/space-agent/playwright-mcp/status
POST /api/gateway/space-agent/playwright-mcp/evidence
```

Expected:

- Status route returns connected local-only Playwright MCP state.
- Evidence route returns a Browser Evidence Packet for a safe public URL.
- Unauthenticated calls return 401/403.
- Gateway / Agent Hub shows SpaceAgent with Playwright MCP browser automation connected.

## Rollback

Code rollback:

```bash
git revert d1d9bcc
```

Runtime rollback:

```bash
systemctl --user disable --now playwright-mcp.service
```

If the report commit is also reverted, use the commit hash from the final owner message.

## Developer Next Step

Get administrator restart for Mission Control, then run authenticated production route and browser UI smoke. If both pass, Playwright MCP can be marked live under SpaceAgent in Gateway. Until then, the status remains **PARTIAL GO**.
