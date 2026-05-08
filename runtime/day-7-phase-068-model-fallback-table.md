# Day 7 Phase 068 - Gateway Model Fallback Table

Generated: 2026-05-07 23:56 ET

## Objective
Create a truthful model fallback table for Gateway routing.

## Fallback Table
| Use Case | Preferred Route | Fallback | Blocked/Notes |
| --- | --- | --- | --- |
| Owner commander chat | Agent Zero route | Claude/OpenAI provider if configured | Agent Zero remains commander |
| Hermes planning | Hermes live adapter when hermes_called:true | No-tool/no-write planning stub | Currently blocked live |
| Local backup | Ollama | None | Backup only; not default |
| Cloud general model | OpenAI or Anthropic | Gemini/NVIDIA where configured | No secret values exposed |
| Router aggregation | OpenRouter | None | Not configured |
| Low-latency alternate | Groq | None | Not configured |
| Paperclip co-worker | Paperclip bridge | Agent Zero planning route | Paperclip login/session blocked |

## Decision
PARTIAL GO. The table is usable for routing visibility; live model invocation remains constrained by each provider route and Bridge/Gateway policy.

## Files Changed
- src/app/api/bridge/brain-context/route.ts
- src/app/api/bridge/capability-matrix/route.ts
- src/app/api/mcp/[[...path]]/route.ts
- src/lib/mcp-server-tool-schemas.ts
- src/lib/zapier-tool-bridge.ts
- src/app/api/integrations/route.ts

## Tests And Validation
- git diff --check: passed.
- pnpm run typecheck: passed.
- pnpm run build: passed.
- pnpm exec vitest run src/lib/bridge-provider-sanitizer.test.ts: passed, 2 tests.
- pnpm test: passed, 134 files and 1,241 tests.
- Authenticated route smoke: passed for Day 7 read-only targets.
- Unauthenticated route smoke: 401 for protected Day 7 routes.
- Raw path / secret-shape scan over Day 7 route payloads: 0 leaks after remediation.

## Services
- Mission Control standalone: active after controlled restart, new PID 2769575, restart time 2026-05-07 23:53:43 ET.
- Hermes gateway service: active; live Hermes chat remains blocked by adapter status, not service liveness.
- Playwright MCP service: active local-only.
- Build-Wiki / Farmer legacy timer: active; literal unit name opencloud-docs-farmer.timer.

## Commits And Rollback
- Commit: 115b274.
- Rollback command after commit: git revert 115b274.

## Updated Percentage Snapshot
- Agent Zero: 94% PARTIAL GO.
- Hermes: 42% NO-GO live until hermes_called:true.
- Pi Dispatcher: 80% PARTIAL GO / SHADOW.
- Gateway / Agent Hub: 94% PARTIAL GO after Day 7 leak remediation; owner-auth visual proof still pending.
- Brain systems: 82% PARTIAL GO read-only; writes Bridge-gated.
- Bridge / MCP / tools: 78% PARTIAL GO.
- Models / providers: 76% PARTIAL GO.
- n8n: 10% NO-GO / not installed.
- Overall ecosystem: 93% PARTIAL GO.

## No-Secrets Confirmation
No secret values, API keys, auth files, tokens, passwords, .env contents, or raw absolute local paths are included in this report. No .env file was modified.

## Exact Next Step
Wire model fallbacks into UI only as live/gated/blocked, never as fake connected.
