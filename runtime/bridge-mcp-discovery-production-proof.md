# Bridge / MCP Discovery Production Proof

Generated: 2026-05-07T22:21:03.928Z

## Executive Result

Bridge/MCP discovery is **PARTIAL GO**. Gateway and Bridge read-only discovery routes work and are protected. No tool execution was requested. The direct MCP list route timed out in the smoke window and remains a blocker for full MCP proof.

## Production Route Evidence

| Route | Result | Notes |
| --- | --- | --- |
| /api/bridge/providers | 200 | 8 providers visible through read-only registry proxy |
| /api/bridge/capability-matrix | 200 | Bridge read-only capability matrix visible |
| /api/gateway/data-layer/getSystems | 200 | discovery only, execution false |
| /api/gateway/data-layer/getTools | 200 | discovery only, execution false |
| /api/gateway/data-layer/getModels | 200 | discovery only, execution false |
| /api/gateway/data-layer/getIntegrations | 200 | discovery only, execution false |
| /api/gateway/nodes/bridge_mcp | 200 | Gateway node connected, no writes/execution |
| /api/gateway/data-layer/execute unauthenticated | 401 | protected route blocks unauthenticated access |
| /api/mcp/list | timeout | direct MCP list proof incomplete |

## Policy Confirmation

| Policy | Status |
| --- | --- |
| Discovery first | pass |
| Execution second | pass, not invoked |
| Auth required | pass |
| No external write | pass |
| No fake access | pass, timeout reported honestly |
| Bridge Session for execution | required |

## Remaining Blockers

| Blocker | Impact | Exact Next Step |
| --- | --- | --- |
| mcp_list_route_timeout | Cannot claim full direct MCP list proof. | Add bounded MCP list timeout handling or fix upstream MCP list latency. |
| no safe tool execution smoke yet | Cannot claim Bridge/MCP execution GO. | Add one read-only tool smoke through a registered adapter after route timeout is fixed. |

## Security Confirmation

- No tool execution was requested.
- No external write occurred.
- No secrets were printed or committed.
- No .env changes were made.
- Protected execute route returned 401 without auth.

## Completion Estimate

| Component | Percent | Status |
| --- | ---: | --- |
| Bridge provider discovery | 85% | live |
| Gateway data-layer discovery | 85% | live |
| Gateway Bridge/MCP node | 85% | connected |
| Direct MCP list | 25% | timeout blocker |
| Tool execution smoke | 0% | not run |
| Bridge/MCP overall | 68% | PARTIAL GO |

## Final Decision

Bridge/MCP discovery: **PARTIAL GO**.

Read-only discovery is production-visible. Full MCP/tool execution proof remains blocked by direct MCP list timeout and missing scoped tool smoke.