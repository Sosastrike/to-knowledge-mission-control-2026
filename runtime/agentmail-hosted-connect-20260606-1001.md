# AgentMail Hosted Connect Hop Report

Generated: 2026-06-06 10:01 America/New_York

## Scope
- Active runtime: `/home/tony/mission-control`
- Service: `mission-control.service`
- Runtime cwd after restart: `/home/tony/mission-control/.next/standalone`
- Goal: replace the AgentMail credential dead-end with a hosted AgentMail console / MCP OAuth connect path while preserving monitor-first and send-disabled behavior.

## Files Changed
- `package.json`
- `scripts/agentmail/connect-agentmail.sh`
- `src/app/agentmail/page.tsx`
- `src/app/api/agentmail/connect/status/route.ts`
- `src/app/api/agentmail/connect/test/route.ts`
- `src/app/api/agentmail/connect/sync/route.ts`
- `src/app/api/agentmail/connect/provision-preview/route.ts`
- `src/components/gateway/GatewayShell.tsx`
- `src/lib/agentmail-local-control.ts`
- `src/lib/agentmail-local-control.test.ts`
- `src/lib/agentmail-api-routes.test.ts`

## Routes Added
- `GET /api/agentmail/connect/status`
- `POST /api/agentmail/connect/test`
- `POST /api/agentmail/connect/sync`
- `POST /api/agentmail/connect/provision-preview`

All routes are protected and return `401` unauthenticated.

## UI Behavior
- `/agentmail` now includes `Connect AgentMail` as the primary control-plane section.
- The primary CTA opens the hosted AgentMail console URL.
- The UI shows:
  - Hosted Console
  - Google/SSO Status
  - MCP OAuth Status
  - API Key Fallback
  - Last Sync
  - Bridge session status
  - Sync inbox registry
  - Gateway route preview
- Localhost is not the primary next action.
- Send state remains `approval required`.

## Connect Flow Behavior
- Missing AgentMail credential now maps to `owner_sso_required`.
- Detected runtime AgentMail credential metadata maps to `connected` or `sync_ready`.
- Inbox sync preview is preview-only and does not provision automatically.
- Bridge Session remains required before send.

## MCP/OAuth Behavior
- Hosted MCP URL: `https://mcp.agentmail.to/mcp`
- The connect script supports Claude Code-compatible registration:
  - `claude mcp add --transport http agentmail https://mcp.agentmail.to/mcp`
- On this server, Claude CLI was present and registered the hosted AgentMail MCP connector in the local Claude config.
- No Google credentials, OAuth tokens, cookies, or browser sessions were accessed.

## API-Key Fallback Behavior
- AgentMail API key fallback is detected from runtime metadata only.
- Keys are masked as `am_****last4`.
- No AgentMail key is written to `.env`.
- No AgentMail key is exposed to browser-local storage or client-side JavaScript.

## Inbox Sync Preview Behavior
- Preview includes:
  - known Mission Control agents
  - missing inboxes
  - proposed inbox assignments
  - proposed scoped credential references
  - bridge routing preview
- Initial targets remain conservative:
  - Pi: `L1_draft_only`
  - Agent Zero: `L1_draft_only`
  - Gateway: `L0_monitor_only`
  - Bridge Unit: `L0_monitor_only`
  - Mission Control Monitor: `L0_monitor_only`
  - Audit Archive: `L0_monitor_only`

## Audit Behavior
- Added sanitized audit helper for AgentMail connect actions.
- Supported audit actions include connection tests, sync preview, sync completion/blocked state, console/MCP status, and bridge-session-required state.
- Audit details are sanitized for secret-like values and local paths.

## Verification
- Targeted tests:
  - `pnpm exec vitest run src/lib/agentmail-local-control.test.ts src/lib/agentmail-api-routes.test.ts`
  - Result: 2 files, 19 tests passed.
- Typecheck:
  - `pnpm run typecheck`
  - Result: passed.
- Production build:
  - `pnpm run build`
  - Result: passed.
- Route smoke after restart:
  - `/login` -> `200`
  - `/agentmail` unauthenticated -> `401`
  - `/api/agentmail/status` unauthenticated -> `401`
  - `/api/agentmail/connect/status` unauthenticated -> `401`
  - `/api/agentmail/connect/test` unauthenticated -> `401`
  - `/api/agentmail/connect/sync` unauthenticated -> `401`
  - `/api/agentmail/connect/provision-preview` unauthenticated -> `401`
- Service:
  - `mission-control.service` active.
  - cwd: `/home/tony/mission-control/.next/standalone`
- Script:
  - `bash -n scripts/agentmail/connect-agentmail.sh` passed.
  - `pnpm run agentmail:connect` opened/printed hosted connect path safely in headless mode.

## Secret Safety
- `.env` and `.env.local` diff: unchanged.
- Touched-file secret scan: clean.
- No full AgentMail API keys, Google credentials, OAuth tokens, cookies, browser sessions, webhook secrets, or authorization headers were printed or written.
- `credential_values_exposed:false`, `tokens_exposed:false`, and `env_values_exposed:false` remain in returned contract payloads.

## Current Runtime Truth
- AgentMail hosted connect path is now available.
- Local WebSocket monitor remains disconnected until AgentMail is connected and scoped runtime credentials or supported MCP access are available.
- Inbox registry remains preview/not-provisioned until owner completes AgentMail hosted sign-in and approves registry sync/provisioning.
- Outbound email send remains blocked and approval-required.

## Rollback
Revert only this scoped commit, rebuild, and restart Mission Control:

```bash
cd /home/tony/mission-control
git revert <agentmail-hosted-connect-commit>
pnpm run build
sudo systemctl restart mission-control.service
```
