# Day 45 - MCP UI Page

Date: 2026-05-09
Lane: MCP UI Page
Status: DEVELOPER-SIDE CLOSED
Blocker class: SERVICE_DOWN

## Summary

Day 45 closes the MCP owner-facing UI truth gap. The backend MCP registry already reports a canonical blocked/service-down state when no MCP servers are discoverable from the Mission Control runtime. The UI still had stale connected language and a Tony-era visibility check. This work removes those false active claims and wires the UI to the canonical MCP registry/tool contract.

This is not MCP runtime GO. The runtime blocker remains:

`claude_mcp_discovery_unavailable: spawn claude ENOENT`

## What Changed

Files changed:

- `public/designer-mission-control/src/replicas/MCPToolsPage.jsx`
- `src/components/agent-network/AgentNetworkClient.tsx`
- `scripts/check-mcp-ui-contracts.mjs`
- `scripts/check-mcp-status-consistency.mjs`
- `scripts/check-mission-control-route-rendering.mjs`

Implementation:

- MCP Tools page now displays canonical `canonical_status` and `blocker_class`.
- Empty MCP server inventory now shows the exact current blocker instead of implying setup is live.
- MCP Tools page no longer checks `visible_to?.tony`.
- MCP Tools page no longer displays stale setup copy or fake live tool claims.
- Agent Network MCP node no longer says `connected` / `schemas visible`.
- Agent Network MCP node now reports `blocked` / `registry blocked`.
- Added `scripts/check-mcp-ui-contracts.mjs` so stale MCP UI truth and Tony visibility checks fail validation.
- Updated MCP consistency smoke to accept an empty inventory only when paired with canonical blocked/service-down truth and a blocker.
- Updated route rendering smoke to include the non-secret runtime API-key cookie context used by production local smokes.

## Routes And UI Behavior

Routes checked:

- `/api/mcp/status`
- `/api/mcp/servers`
- `/designer-mission-control/Mission%20Control.html?page=mcp-tools`
- Mission Control route-rendering smoke across 46 routes and 8 designer pages

UI behavior:

- Owner-facing MCP page shows `SERVICE_DOWN` when MCP discovery is unavailable.
- Owner-facing MCP page shows the current blocker.
- No MCP tools are shown as live when the server list is empty.
- Reauth/enable/disable remain owner-approval actions when rows exist.
- No tool execution is invoked by the MCP UI smoke.

## Runtime Proof

Production branch: `to-knowledge-mc`

Source commit:

`68c8f7d844599984a3d1269a6bc7ad7464694707`

Origin contains source commit: yes

Runtime restarted: yes

New Mission Control PID:

`86208`

Runtime bind:

`127.0.0.1:3337`

Runtime proof:

- `/login` returned 200.
- `/api/mcp/servers` returned 200 with:
  - `canonical_status: SERVICE_DOWN`
  - `blocker_class: SERVICE_DOWN`
  - `blocker: claude_mcp_discovery_unavailable: spawn claude ENOENT`
  - `total: 0`
  - `writes_enabled: false`
  - `execution_enabled: false`
  - `no_tool_invocation: true`
- Served MCP Tools source contains canonical status/blocker fields.
- Served MCP Tools source does not contain the Tony visibility check.
- Served MCP Tools source does not contain stale `schemas visible` or stale empty-state setup text.

## Validation

Passed:

- `git diff --check`
- `node scripts/check-mcp-ui-contracts.mjs`
- `node scripts/check-mcp-status-consistency.mjs http://127.0.0.1:3337`
- `node scripts/check-mission-control-route-rendering.mjs http://127.0.0.1:3337`
- `node scripts/check-protected-file-invariants.mjs`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test` - 165 files / 1342 tests
- staged secret scan
- `.env` diff check

## Safety

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No MCP execution enabled.
- No fake live tool status.
- No Tony active commander or Tony visibility check added.

## Remaining Blocker

MCP UI is developer-side closed, but MCP runtime remains:

`SERVICE_DOWN`

Reason:

`claude_mcp_discovery_unavailable: spawn claude ENOENT`

Owner/admin action needed:

Install or expose the approved Claude MCP CLI/runtime to the Mission Control runtime context, then rerun MCP registry and tool discovery smokes.

## Rollback

Source rollback:

`git revert 68c8f7d844599984a3d1269a6bc7ad7464694707`

## Next Day Started

Day 46 - Zapier Registry starts next.
