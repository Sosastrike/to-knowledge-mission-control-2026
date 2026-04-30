# Release Grouping / Next Commits

Generated: 2026-04-30T09:25:00-04:00

Mode: release grouping only. No destructive cleanup. No production DB migration. No connector execution.

## Current Branch State

- Branch: `to-knowledge-mc`
- Remote: `sosastrike/to-knowledge-mc`
- Current pushed head: `0a0b6d1`
- Working tree: tracked files clean; untracked designer/reference artifacts remain intentionally unstaged.

## Group A — Runtime Restore / Gateway Stability

Commits:

- `57a5ec6` fix(gateway): normalize local websocket URLs
- `4644a69` test(runtime): stabilize cold connector route checks

Purpose:

- Keep local OpenClaw Gateway websocket URL generation correct.
- Make route/connector checks resilient to cold MCP discovery.

Tests required:

- `pnpm run test`
- `pnpm run build`
- `pnpm run safety:overnight`
- TKMC public login smoke check.

Rollback:

- Revert the commits above if gateway websocket URL behavior regresses.

## Group B — Bridge Mode Read-Only Capability / Provider Visibility

Commits:

- `d0cc1c2` test(bridge): verify live capability matrix
- `2c189c1` feat(bridge): surface full agent capability details
- `5d831e2` feat(bridge): add read-only cost governance
- `1c908fa` test(bridge): guard read-only cost governance

Purpose:

- Surface full agent tools/models/skills/integrations/MCPs/routes/gates/restrictions/cost limits.
- Add `/api/bridge/costs` as read-only cost/rate visibility.
- Keep provider routing, budget enforcement, and execution locked.

Tests required:

- `node scripts/check-bridge-capability-matrix-live.mjs`
- `node scripts/check-bridge-costs-live.mjs`
- `pnpm run safety:overnight`

Rollback:

- Revert the feature commits if Bridge UI layout or cost route breaks.
- No data rollback required because this group is read-only.

## Group C — Connector / Skills / MCP Safety Guards

Commits:

- `4c8accb` refactor(connectors): canonicalize crawl status helpers
- `08b22e8` fix(mcp): restore live server discovery
- `735da51` test(mcp): guard live server inventory
- `61f16d8` test(buttons): guard duplicate button contracts
- `c0e8341` test(connectors): validate readiness contract details
- `fd14f1d` test(skills): guard read-only registry behavior

Purpose:

- Keep FireCrawl/Viral Crawl status canonicalized.
- Restore and guard live MCP server inventory.
- Ensure connector and skill actions stay read-only/locked with no fake success.

Tests required:

- `node scripts/check-mcp-status-consistency.mjs`
- `node scripts/check-connector-readiness-live.mjs`
- `node scripts/check-connector-action-contracts.mjs`
- `node scripts/check-skills-readonly-live.mjs`
- `pnpm run safety:overnight`

Rollback:

- Revert individual guard commits if a check is too strict.
- Revert `08b22e8` only if MCP discovery itself causes runtime instability.

## Group D — Approval / Audit Owner-Gated Package

Commits:

- `5aa94d0` test(approvals): enforce migration lock invariant
- `605802e` docs(approvals): refresh owner migration packet
- `0a0b6d1` docs(approvals): avoid stale head wording

Purpose:

- Keep production approval/audit migration locked until owner approval.
- Keep owner approval packet current enough for the next gated migration decision.

Tests required:

- `node scripts/check-approval-migration-lock.mjs`
- `node scripts/check-approval-readiness-live.mjs`
- `MISSION_CONTROL_DB_PATH=/home/tony/mission-control/.data/mission-control.db bash scripts/test-bridge-approval-migration.sh`

Rollback:

- Documentation-only rollback if wording is wrong.
- No production DB rollback needed because migration is not applied.

## Group E — Runtime Reports / Cleanup Inventory

Commits:

- `1211d2c` docs(runtime): refresh overnight current status
- `bd5544f` docs(runtime): refresh overnight live status
- `a638688` docs(cleanup): refresh live cleanup inventory

Purpose:

- Keep current status and cleanup inventory separated from implementation commits.

Tests required:

- No build needed for report-only commits.
- Run `git status --short` to ensure reports do not include unrelated artifacts.

Rollback:

- Revert report commits if stale or confusing.

## Still Untracked / Intentionally Excluded

- `.designer-review/**`
- `.designer-retirement-backups/**`
- `.commit-tkmc.sh`
- `.tkmc-commit-msg.txt`
- `public/Voice-Biometrics-Executive-Report.pdf`
- `public/lu-ai-collab-v2.mp4`
- `scripts/mc-create-owner.cjs`
- `src/app/login/page.tsx.bak-designer-login-20260428-071138`
- `start-mc.sh.DISABLED`

These remain excluded from release commits until the owner explicitly approves an archive/docs/media cleanup batch.

## Owner-Gated Next Release

Do not include these until explicitly approved:

- Production approval/audit DB migration.
- Telegram approval callback persistence.
- Any connector execution runner.
- Zapier writes.
- FireCrawl SDK/credential sync into Mission Control.
- n8n credential setup.
- Any `.env` or credential change.
