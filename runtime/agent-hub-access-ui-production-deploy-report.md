# Agent Hub Access UI Production Deploy Report

Status: PARTIAL GO - deployed/restarted, owner browser confirmation still pending.

## Target

Make the Agent Hub access/control-center fix visible in production Mission Control.

Production owner URL:

- `https://tkmc.knowledge-vs-ai.com/gateway/agent-hub`

Expected production behavior after deploy:

- Agent Control Center does not cover cards.
- Collapse/close/reopen controls remain visible.
- Open UI does not require Bridge Session.
- Agent Zero opens `http://100.116.35.95:50080/`.
- Paperclip opens `http://100.116.35.95:3100/`.
- Open Tools opens `/gateway/tools`, not `/api/bridge/capability-matrix`.
- Open Config opens agent-specific Gateway pages.
- Health/status views render readable owner panels, not raw JSON dumps.
- Hermes and Paperclip are not mislabeled as not installed.
- Pi remains advisory/runtime-not-proven.
- SpaceAgent remains Mission Control panel only with Playwright MCP local-only.
- No secrets, raw paths, fake buttons, or public exposure of local-only services.

## Local Build Included

Files included in the local deployment candidate:

- `gateway-dropin/next.config.mjs`
- `gateway-dropin/src/app/gateway/page.tsx`
- `gateway-dropin/src/components/gateway/GatewayShell.tsx`
- `gateway-dropin/src/components/gateway/gateway-actions.ts`
- `gateway-dropin/src/components/gateway/gateway-status-contracts.ts`
- `gateway-dropin/tests/gateway-shell.test.ts`
- `gateway-dropin/tests/gateway-status-contracts.test.ts`

Local candidate commit:

- `15a701a55908b27235dfa0ff5010ffefb5630278`

Production commits:

- `921e6d2` - gateway-dropin control-center files and reports.
- `b3f3212` - root production Gateway shell port used by the live `/gateway` route.

## Validation Before Deploy

- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm --dir gateway-dropin run typecheck`: passed.
- `pnpm --dir gateway-dropin run build`: passed.
- `pnpm --dir gateway-dropin test`: passed, 48 tests.
- `pnpm run safety:ui-actions`: passed.
- `pnpm --dir gateway-dropin run design-lock:verify`: passed.
- Protected-file invariant scan: passed.
- `.env` diff check: passed.
- Scoped secret scan on changed files: passed.

Note: root `pnpm test` is not available in this repository because the root package has no `test` script.

## Production Promotion Status

Deploy/restart: completed for Mission Control standalone runtime.

Production HEAD after code deploy: `b3f3212`.

Mission Control restart:

- Previous active Next PID after first deploy attempt: `2869446`.
- Final active Next PID after root shell port: `2899312`.
- Tailnet proxy process on `100.116.35.95:3337` was left running; only the Next standalone process was restarted.

Route smoke:

- `/login`: HTTP 200.
- `/gateway`: HTTP 307 unauthenticated redirect to login.
- `/gateway/agent-hub`: HTTP 307 unauthenticated redirect to login.
- `/gateway/tools`: HTTP 307 unauthenticated redirect to login.
- `/gateway/agent-hub/hermes/config`: HTTP 307 unauthenticated redirect to login.
- `/agent-network`: HTTP 307 unauthenticated redirect to login.
- `/agents`: HTTP 307 unauthenticated redirect to login.
- `/api/agent-local-interfaces`: HTTP 401 without owner auth.
- `/api/bridge/paperclip/status`: HTTP 401 without owner auth.

Production bundle proof:

- Built standalone bundle contains `Agent Control Center`.
- Built standalone bundle contains `/gateway/tools`.
- Built standalone bundle contains the new control rewrites for agent config/chat/recommend/research pages.

## Owner Retest Status

Owner confirmation: pending.

Final deploy status is not GO until the owner confirms the authenticated production browser shows the fixed Agent Control Center. Current status remains PARTIAL GO because server deploy and smoke passed, but the owner-only UI view must still be visually confirmed.
