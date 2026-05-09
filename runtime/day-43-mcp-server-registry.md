# Day 43 — MCP Server Registry

Date: 2026-05-09
Status: PARTIAL PASS
Blocker class: SERVICE_DOWN
Exact blocker: `claude_mcp_discovery_unavailable: spawn claude ENOENT`

## Lane

MCP server registry, status contract, and read-only discovery surface.

## Objective

Create and prove a canonical MCP server registry that exposes server status, capabilities, owner-facing blocker classification, and safe read-only tool-schema routes without invoking MCP tools or enabling writes.

## Inventory

Reviewed active MCP surfaces:

- `GET /api/mcp/status`
- `GET /api/mcp/list`
- `GET /api/mcp/servers`
- `GET /api/mcp/servers/:id/tools`
- `GET /api/mcp/servers/:id/resources`
- `POST /api/mcp/servers/:id/test`
- `POST /api/mcp/servers/:id/enable`
- `POST /api/mcp/servers/:id/disable`
- `POST /api/mcp/servers/:id/reauth`
- `scripts/check-mcp-status-consistency.mjs`
- MCP tool schema helper
- Owner-facing status contract in `src/lib/owner-status.ts`

## Implemented

Added a canonical MCP registry contract:

- New registry helper maps every MCP server to the locked owner-facing status vocabulary:
  - `LIVE`
  - `READY`
  - `OWNER_GATED`
  - `CREDENTIAL_GATED`
  - `SERVICE_DOWN`
  - `BLOCKED`
  - `DISABLED`
- Server records now include:
  - `id`
  - `canonical_status`
  - `blocker_class`
  - `blocker`
  - `owner_status`
  - `read_enabled`
  - `execution_enabled:false`
  - `writes_enabled:false`
  - `bridge_session_required:true`
  - `approval_required_for_writes:true`
  - `tools_endpoint`
  - `resources_endpoint`
  - capability list
- `/api/mcp/status` now returns canonical status, blocker class, allowed statuses, and explicit no-execution/no-write fields.
- `/api/mcp/servers` now returns the canonical registry records and status summary.
- MCP config discovery now checks:
  - Claude CLI
  - Claude user MCP config
  - Claude config MCP config
  - Claude JSON project MCP config
- MCP tool schema discovery now reads all project-level `.claude.json` MCP server entries rather than one stale project path.
- MCP status consistency smoke now supplies the same non-secret placeholder session cookie used by runtime API smoke, so the proxy does not reject valid API-key checks before route authorization.

## Files Changed

- `src/lib/mcp-server-registry.ts`
- `src/lib/mcp-server-registry.test.ts`
- `src/app/api/mcp/[[...path]]/route.ts`
- `src/lib/mcp-server-tool-schemas.ts`
- `scripts/check-mcp-status-consistency.mjs`

## Routes Changed

- `GET /api/mcp/status`
- `GET /api/mcp/list`
- `GET /api/mcp/servers`

Existing route behavior preserved:

- `GET /api/mcp/servers/:id/tools` remains read-only schema discovery only.
- `GET /api/mcp/servers/:id/resources` remains blocked as not wired.
- `POST /api/mcp/servers/:id/test` remains status-only.
- `POST /api/mcp/servers/:id/enable|disable|reauth` remains owner-approval required.

## UI / Owner-Facing Behavior

MCP server inventory now has one truthful status contract for downstream Mission Control, Gateway, Agent Hub, connector panels, and reports.

Current runtime truth:

- MCP registry route is reachable after auth.
- No MCP servers are visible in the current local runtime.
- MCP CLI discovery is unavailable on this host: `spawn claude ENOENT`.
- MCP execution is disabled.
- MCP writes are disabled.
- No MCP tool invocation occurred.

## Runtime / Service Behavior

Mission Control was rebuilt and restarted after the source change.

- Source commit: `5ce6191`
- Runtime PID after restart: `78864`
- Runtime bind: `127.0.0.1:3337`
- Public exposure: none; listener remains local-only.

Runtime route proof:

- Unauthenticated `GET /api/mcp/status`: 401
- Authenticated `GET /api/mcp/status`: 200
- Authenticated `GET /api/mcp/servers`: 200
- `/api/mcp/status` canonical status: `SERVICE_DOWN`
- `/api/mcp/servers` canonical status: `SERVICE_DOWN`
- Server count: 0
- Sources checked include `claude-json-mcp-config`

## Proof Artifact

- `runtime/day-43-mcp-server-registry-proof.json`

The proof artifact records only summarized response fields. No API key, token, auth file, or raw response body was printed.

## Validation

- `git diff --check`: PASS
- `pnpm run typecheck`: PASS
- `pnpm run build`: PASS
- `pnpm test`: PASS — 164 files / 1339 tests
- `pnpm test src/lib/mcp-server-registry.test.ts`: PASS
- `pnpm test src/lib/owner-status.test.ts`: PASS
- `node scripts/check-protected-file-invariants.mjs`: PASS
- `ALLOW_EMPTY_MCP_SERVERS=1 node scripts/check-mcp-status-consistency.mjs http://127.0.0.1:3337`: PASS
- Staged secret scan: PASS after avoiding secret-shaped synthetic test literals
- `.env` diff: clean

## Blocker Classification

`SERVICE_DOWN`

Reason:

- The current runtime cannot discover live MCP servers because the `claude` CLI is not reachable from this host/runtime shell and no MCP servers are configured in the checked config sources.

Developer-side closure is complete:

- Canonical registry contract exists.
- Safe route behavior exists.
- Empty/unavailable state is truthful.
- Tests and runtime proof pass.

Owner/admin action if live MCP inventory is required on this host:

- Install or expose the approved `claude` CLI to the Mission Control runtime PATH, or configure `CLAUDE_BIN`.
- Configure the desired MCP servers in Claude MCP config or `.claude.json`.
- Restart Mission Control if the service environment changes.
- Re-run authenticated `GET /api/mcp/servers`.

## Commit / Push

Source commit:

- `5ce6191` — `feat(mcp): add canonical server registry contract`

Push:

- `origin/to-knowledge-mc`: pushed

Day 43 report/proof commit:

- Recorded after this report is committed and pushed.

## Rollback

Rollback source change:

```bash
git revert 5ce6191
```

Rollback Day 43 report/proof commit:

```bash
git revert <day43_report_commit_sha>
```

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No MCP tool invocation.
- No MCP writes enabled.
- No raw local paths in runtime proof.
- No fake MCP server visibility.
- No fake GO.

## Closeout Decision

Day 43 is developer-side complete with a truthful `SERVICE_DOWN` blocker for live MCP server discovery in this runtime. The next lane is Day 44 — MCP Tool Discovery.

## Next Day Started

Day 44 — MCP Tool Discovery is the active next lane.
