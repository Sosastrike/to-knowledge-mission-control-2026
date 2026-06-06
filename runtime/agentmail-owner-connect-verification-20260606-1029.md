# AgentMail Owner Connect Verification Follow-up

Generated: 2026-06-06 10:29 America/New_York

## Owner Connect Result
- Owner reported hosted AgentMail / Google SSO login was accepted.
- Mission Control service does not receive Google browser session state, OAuth tokens, or cookies, by design.
- Local Claude CLI MCP config is detected, but this does not prove `mission-control.service` can use AgentMail at runtime.

## Root Cause Fixed
- Previous `Test connection` and `Sync inbox registry` controls were plain HTML forms posting to JSON API routes.
- Browser navigation landed on `/api/agentmail/connect/test` and rendered JSON, which looked like an error page.
- The MCP action also opened the raw MCP endpoint as a browser page; raw MCP endpoints can return unauthorized and are not the owner console UI.

## Fix Applied
- Added `src/app/agentmail/AgentMailConnectActions.tsx` client component.
- `Test connection` now calls `/api/agentmail/connect/test` with `fetch()` and renders the result inline on `/agentmail`.
- `Sync inbox registry` now calls `/api/agentmail/connect/provision-preview` with `fetch()` and renders the result inline on `/agentmail`.
- Removed the clickable raw MCP endpoint from the UI action row.
- Added `Back to Gateway` and `Back to Mission Control` controls.
- Added runtime truth mapping: local MCP config detected but not service-visible becomes `api_key_required` with blocker `agentmail_mcp_oauth_not_visible_to_mission_control_runtime`.

## Current Runtime Truth
- AgentMail hosted console path works for owner login.
- Mission Control runtime access is not yet proven through `mission-control.service`.
- Expected status after local MCP config detection but no service credential: `api_key_required` / `agentmail_mcp_oauth_not_visible_to_mission_control_runtime`.
- API-key fallback remains required unless AgentMail MCP/OAuth becomes visible to the Mission Control server runtime through an approved connector path.
- WebSocket monitor remains disconnected until scoped runtime access is present.
- Inboxes remain preview/not provisioned.
- Bridge session remains required.
- Send state remains `approval_required`.

## Verification
- Targeted tests: `pnpm exec vitest run src/lib/agentmail-local-control.test.ts src/lib/agentmail-api-routes.test.ts` -> 20 passed.
- Typecheck: `pnpm run typecheck` -> passed.
- Build: `pnpm run build` -> passed.
- Restart: only `mission-control.service` restarted.
- Service status: active.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.
- Route smoke:
  - `/login` -> 200
  - `/agentmail` unauthenticated -> 401
  - `/api/agentmail/status` unauthenticated -> 401
  - `/api/agentmail/connect/status` unauthenticated -> 401
  - `/api/agentmail/connect/test` unauthenticated -> 401
  - `/api/agentmail/connect/sync` unauthenticated -> 401
  - `/api/agentmail/connect/provision-preview` unauthenticated -> 401

## Secret Safety
- `.env` and `.env.local` unchanged.
- Touched-file secret scan clean.
- No Google credentials, cookies, OAuth tokens, AgentMail API keys, webhook secrets, authorization headers, browser sessions, or local secret file contents were logged or exposed.

## Remaining Exact Blocker
- `agentmail_mcp_oauth_not_visible_to_mission_control_runtime` if MCP config is present only for local Claude CLI.
- `api_key_required` if Mission Control needs direct server-side AgentMail access.

## Rollback
```bash
cd /home/tony/mission-control
git revert <followup-commit>
pnpm run build
sudo systemctl restart mission-control.service
```
