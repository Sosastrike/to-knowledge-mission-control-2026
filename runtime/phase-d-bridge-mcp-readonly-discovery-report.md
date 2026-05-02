# Phase D - Bridge/MCP Read-Only Discovery Closure

Date: 2026-05-02
Repo: /home/tony/mission-control
Branch: to-knowledge-mc

## Scope

Implemented and verified read-only discovery surfaces only:

- GET /api/bridge/providers/:id
- GET /api/mcp/list
- GET /api/zapier/tools
- GET /api/mcp/servers/:id/tools status clarity

No tool execution, Zapier writes, HeyGen generation, provider routing changes, credentials, or .env changes were made.

## Route Behavior

### /api/bridge/preflight

- Authenticated: 200
- Mode: bridge_preflight_read_only_contract
- Unauthenticated: 401

### /api/bridge/providers

- Authenticated: 200
- Mode: bridge_provider_registry_proxy_read_only
- Providers visible: 9
- Unauthenticated: 401

### /api/bridge/providers/:id

- Authenticated /api/bridge/providers/tony: 200
- Authenticated /api/bridge/providers/openrouter: 200
- Mode: bridge_provider_detail_proxy_read_only
- Returns one safe provider record from the canonical provider registry.
- Execution enabled: false
- Routing changes enabled: false
- Unauthenticated: 401

### /api/mcp/list

- Authenticated: 200
- MCP servers visible: 5
- Authoritative route: /api/mcp/list
- Compatibility routes: /api/mcp/status and /api/mcp/servers
- Unauthenticated: 401

### /api/zapier/tools

- Authenticated: 200
- Connected: true
- MCP reachable: false
- Tools total: 297
- Source: cached_snapshot
- HeyGen found: true
- Exact HeyGen tool: mcp__zapier__heygen_create_an_avatar_video_generate
- Required fields: null because live schema passthrough is not available from this route.
- Execution enabled: false
- Writes enabled: false
- Unauthenticated: 401

### /api/mcp/servers/zapier/tools

- Authenticated: 503
- Error: not_wired_yet
- Blocker: Mission Control can list MCP servers read-only, but per-server tool/resource schema passthrough is not wired yet.
- This is an honest unavailable state, not a fake empty tool list.
- Unauthenticated: 401

## Validation

- git diff --check: passed
- pnpm run typecheck: passed
- pnpm run build: passed
- pnpm test: passed, 84 files / 941 tests
- npm run design-lock:verify: not applicable, script is not defined in this repo
- Mission Control restart: service active after standalone restart
- claudeclaw.service: active
- opencloud-docs-farmer.timer: active
- .env diff: 0 lines
- Secret scan: staged scan required immediately before commit

## Safety Confirmation

- No Zapier tools were invoked.
- No HeyGen generation was run.
- No broad connector execution was enabled.
- No web approvals were enabled.
- No provider routing changed.
- No .env files changed.
- No secrets were printed in route output or reports.

## Remaining Blockers

- Per-server MCP tools/schema passthrough is still not wired and correctly returns 503.
- Zapier HeyGen schema remains unavailable from live passthrough; cached inventory proves tool visibility only.
- HeyGen/Zapier live execution remains parked until separately approved.

## Rollback

After commit, rollback with:

git revert <phase-d-commit>
