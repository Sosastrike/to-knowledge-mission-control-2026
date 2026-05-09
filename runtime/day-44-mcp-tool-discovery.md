# Day 44 — MCP Tool Discovery

Date: 2026-05-09
Status: PARTIAL PASS
Blocker class: BLOCKED
Exact blocker: `mcp_server_not_configured`

## Lane

MCP per-server tool/schema discovery.

## Objective

Ensure MCP tool discovery is real when a server is configured and reachable, truthful when unavailable, and never presents zero-tool or unavailable discovery as connected/live. Tool invocation and writes must remain disabled.

## Inventory

Reviewed active tool discovery surfaces:

- `GET /api/mcp/servers/:id/tools`
- `src/lib/mcp-server-tool-schemas.ts`
- `src/lib/zapier-tool-bridge.ts`
- Agent Zero ecosystem context MCP tool summaries
- Gateway / connector readiness references to MCP tools
- MCP button contracts for Refresh, Test server, and Enable/Disable/Reauth

Existing protected behavior retained:

- Tool discovery route is authenticated.
- Tools/list is read-only.
- No MCP tool is invoked.
- Mutating MCP config actions require owner approval.

## Implemented

Added canonical owner-facing status fields to MCP tool discovery results:

- `canonical_status`
- `blocker_class`
- `owner_status`
- `read_enabled`
- `bridge_session_required:true`
- `approval_required_for_writes:true`
- `allowed_owner_statuses`
- `read_tools_total`
- `write_tools_total`
- `unknown_tools_total`

Tool discovery now classifies:

- Live read-only schemas as `READY`.
- Missing OAuth/auth as `CREDENTIAL_GATED`.
- Failed tools/list calls as `SERVICE_DOWN`.
- Missing or unsupported server config as `BLOCKED`.

Every discovered tool still includes:

- `write_classification`
- `approval_required`
- `execution_enabled:false`
- `writes_enabled:false`
- schema availability and required fields

## Files Changed

- `src/lib/mcp-server-tool-schemas.ts`
- `src/lib/mcp-server-tool-schemas.test.ts`

## Routes Changed

- `GET /api/mcp/servers/:id/tools`

No execution route was added.

## UI / Owner-Facing Behavior

Downstream Mission Control/Gateway/Agent Hub/connector surfaces can now distinguish:

- Tool schemas visible and read-only.
- Tool discovery blocked because the server is not configured.
- Tool discovery credential-gated.
- Tool discovery service-down.

This prevents a zero-tool or unavailable MCP tools response from being shown as connected/live.

## Runtime / Service Behavior

Mission Control was rebuilt and restarted after the source change.

- Source commit: `827221a`
- Runtime PID after restart: `81357`
- Runtime bind: `127.0.0.1:3337`
- Public exposure: none; listener remains local-only.

Runtime tool discovery proof:

- Unauthenticated `GET /api/mcp/servers/sample/tools`: 401
- Authenticated `GET /api/mcp/servers/sample/tools`: 503
- Tool route canonical status: `BLOCKED`
- Tool route blocker class: `BLOCKED`
- Tool route error: `mcp_server_not_configured`
- Tool count: 0
- Read tools: 0
- Write tools: 0
- Unknown tools: 0
- No tool invocation: true
- Execution enabled: false
- Writes enabled: false

Registry context during proof:

- Authenticated `GET /api/mcp/servers`: 200
- MCP server count: 0
- Registry canonical status: `SERVICE_DOWN`
- Registry blocker class: `SERVICE_DOWN`

## Proof Artifact

- `runtime/day-44-mcp-tool-discovery-proof.json`

The proof artifact contains summarized response fields only. No API key, token, auth file, raw tool response, or secret value was printed.

## Validation

- `git diff --check`: PASS
- `pnpm run typecheck`: PASS
- `pnpm run build`: PASS
- `pnpm test`: PASS — 165 files / 1342 tests
- `pnpm test src/lib/mcp-server-tool-schemas.test.ts`: PASS
- `pnpm test src/lib/mcp-server-registry.test.ts`: PASS
- `node scripts/check-protected-file-invariants.mjs`: PASS
- Staged secret scan: PASS
- `.env` diff: clean

## Blocker Classification

`BLOCKED`

Reason:

- The current runtime has no configured MCP server named `sample`, so per-server tool discovery correctly returns `mcp_server_not_configured`.
- The broader MCP registry remains `SERVICE_DOWN` because the local runtime cannot discover Claude MCP servers and no configured MCP servers are visible.

Developer-side closure is complete:

- Tool discovery result contract exists.
- Tool schemas remain read-only.
- Unavailable/zero-tool states are truthful.
- Tests and runtime proof pass.

Owner/admin action for live tool discovery:

- Configure at least one approved MCP server in Claude MCP config or `.claude.json`.
- Ensure the Mission Control runtime can discover it.
- If the server is HTTP and authenticated, ensure a non-expired approved OAuth/session path exists.
- Re-run authenticated `GET /api/mcp/servers/<server>/tools`.

## Commit / Push

Source commit:

- `827221a` — `feat(mcp): add tool discovery status contract`

Push:

- `origin/to-knowledge-mc`: pushed

Day 44 report/proof commit:

- Recorded after this report is committed and pushed.

## Rollback

Rollback source change:

```bash
git revert 827221a
```

Rollback Day 44 report/proof commit:

```bash
git revert <day44_report_commit_sha>
```

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No MCP tool invocation.
- No MCP writes enabled.
- No fake connected/live tool state.
- No raw local paths in runtime proof.
- No fake GO.

## Closeout Decision

Day 44 is developer-side complete with a truthful `BLOCKED` route-level blocker for missing configured MCP server and a broader `SERVICE_DOWN` registry blocker from Day 43. The next lane is Day 45 — MCP UI Page.

## Next Day Started

Day 45 — MCP UI Page is the active next lane.
