# Phase F - Bridge/MCP Live Schema Passthrough Closure

Date: 2026-05-02
Repo: /home/tony/mission-control
Branch: to-knowledge-mc

## Scope

Implemented read-only MCP HTTP tools/list passthrough for configured Claude MCP servers, using the existing Claude MCP OAuth cache with secrets redacted.

No tools were invoked. No Zapier writes, HeyGen generation, external webhooks, broad connector execution, .env changes, auth weakening, or provider routing changes were made.

## Result

GET /api/mcp/servers/zapier/tools is now live:

- HTTP status: 200
- route_state: read_only_live_schema_passthrough
- mcp_reachable: true
- tools_total: 302
- source: claude_mcp_oauth_cache
- auth_attached: true
- auth_redacted: true
- execution_enabled: false
- writes_enabled: false
- no_tool_invocation: true

Unauthenticated requests still return 401 Unauthorized.

## HeyGen Schema Visibility

Exact tool:

- mcp__zapier__heygen_create_an_avatar_video_generate

Raw MCP tool name:

- heygen_create_an_avatar_video_generate

Schema status:

- schema_available: true
- required_fields: instructions
- exposed safe property names:
  - instructions
  - output_hint
  - test
  - title
  - scenes
  - caption
  - dimension
  - folder_id
  - callback_id

## Bridge/Zapier Routes

GET /api/zapier/tools?q=heygen:

- HTTP status: 200
- mcp_reachable: true
- tools_total: 302
- source: zapier_mcp
- HeyGen found: true
- required_fields: instructions
- execution_enabled: false
- writes_enabled: false

GET /api/bridge/zapier/tools/search?q=heygen:

- HTTP status: 200
- mcp_reachable: true
- tools_total: 302
- source: zapier_mcp
- HeyGen found: true
- required_fields: instructions
- execution_enabled: false
- writes_enabled: false

## Validation

- git diff --check: passed
- pnpm run typecheck: passed
- pnpm run build: passed
- pnpm test: passed, 84 files / 941 tests
- Mission Control restarted: active
- claudeclaw.service: active
- opencloud-docs-farmer.timer: active
- .env diff: 0 lines
- Staged secret scan: required immediately before commit

## Safety Confirmation

- No MCP tools were invoked.
- No Zapier write happened.
- No HeyGen generation happened.
- No external webhook was sent.
- No credentials or tokens were printed.
- Auth remains required for all checked routes.
- Execution remains disabled.
- Writes remain disabled.

## Remaining Blockers

The schema passthrough blocker is closed for read-only tools/list. Live HeyGen generation remains intentionally blocked until a separate owner-approved execution phase because generation is a protected external write.

## Rollback

After commit, rollback with:

git revert <phase-f-commit>
