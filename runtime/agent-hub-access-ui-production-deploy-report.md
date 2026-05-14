# Agent Hub Access UI Production Deploy Report

Status: PENDING DEPLOY ATTEMPT.

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

- pending at report creation time.

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

Deploy/restart: pending.

Production HEAD: pending.

Mission Control restart PID/timestamp: pending.

Route smoke:

- `/login`: pending.
- `/gateway`: pending.
- `/gateway/agent-hub`: pending.
- `/gateway/tools`: pending.
- `/agent-network`: pending.
- `/agents`: pending.

## Owner Retest Status

Owner confirmation: pending.

Final deploy status is not GO until the owner confirms the production browser shows the fixed Agent Control Center.
