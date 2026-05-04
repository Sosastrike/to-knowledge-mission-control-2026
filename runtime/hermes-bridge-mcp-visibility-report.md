# Hermes Bridge/MCP Visibility Report

Generated: 2026-05-04

## Scope

Phases 121-140 were completed as a read-only Hermes visibility slice. The change exposes Bridge providers, MCP servers, MCP tool/schema summaries, model provider status, tools, integrations, Build-Wiki/Farmer status, and the OpenCloud-vs-Farmer distinction to Hermes through Mission Control context only.

No execution adapters were enabled in this phase.

## Phase Status

| Phase | Goal | Status | Notes |
| --- | --- | --- | --- |
| 121 | Hermes sees Bridge providers read-only | Completed | Bridge provider registry is included in Hermes read-only context. |
| 122 | Hermes sees MCP servers read-only | Completed | MCP server list is included with reachable, status, and tool count fields. |
| 123 | Hermes sees tool/schema summaries read-only | Completed | Endpoint summaries and schema totals are included; execution remains disabled. |
| 124 | Hermes sees model registry | Completed | OpenRouter, OpenAI, Claude/Anthropic, Codex/ChatGPT, Ollama, NVIDIA, Groq, and Gemini status rows are present. Missing rows are marked blocked instead of guessed. |
| 125 | Hermes reports OpenRouter accurately | Completed | OpenRouter status is copied from the Mission Control model registry. |
| 126 | Hermes sees Codex/ChatGPT plugin status | Completed | Codex/ChatGPT appears as a capability row with no auth values. |
| 127 | Hermes sees Claude/Anthropic plugin status | Completed | Claude/Anthropic appears as connected/configured/blocked based on registry visibility; no API key or token values are exposed. |
| 128 | Hermes sees AgentMail status | Completed | AgentMail/email is represented as a communication integration with Bridge Session required for sends. |
| 129 | Hermes sees Firecrawl status | Completed | Firecrawl reports configured/blocked from the registry and missing credential state. |
| 130 | Hermes sees Google Drive status | Completed | Google Drive reports registry status plus delivery adapter/upload connector state. |
| 131 | Hermes sees OneDrive status | Completed | OneDrive reports registry status plus delivery adapter/upload connector state. |
| 132 | Hermes sees Zapier/HeyGen schemas | Completed | Zapier and HeyGen appear as read-only schema/status capabilities; execution is blocked unless a Bridge Session later allows a registered adapter. |
| 133 | Hermes sees Build-Wiki status | Completed | Build-Wiki/Farmer status is included read-only. |
| 134 | Hermes distinguishes OpenCloud vs Farmer | Completed | Context explicitly states direct OpenCloud access is not proven unless separately visible, while Build-Wiki/Farmer status is visible through Mission Control. |
| 135 | Prompt: integrations | Completed | Guardrail answer added and tested for "What integrations can you see?" |
| 136 | Prompt: models | Completed | Guardrail answer added and tested for "What models can you help Agent Zero use?" |
| 137 | Prompt: tools/MCPs | Completed | Guardrail answer added and tested for "What tools and MCPs can you see?" |
| 138 | Prompt: blocked connectors | Completed | Guardrail answer added and tested for Firecrawl/Drive/OneDrive status. |
| 139 | Commit Bridge/MCP visibility | Pending at report creation | Commit message: feat(bridge): expose full mcp and integration registry to hermes |
| 140 | Phase report | Completed | This report records the phase evidence. |

## Files Changed

- `src/lib/hermes-visibility.ts`
- `src/lib/hermes-bridge.ts`
- `src/lib/hermes-bridge.test.ts`
- `runtime/hermes-bridge-mcp-visibility-report.md`

## Behavior Added

Hermes read-only context now includes:

- Bridge provider registry.
- MCP server list.
- MCP endpoint and schema summary.
- Tool registry summary.
- Model provider registry and required provider fallbacks.
- Integration registry for AgentMail, Firecrawl, Google Drive, OneDrive, Zapier, HeyGen, Telegram, WhatsApp, Codex/ChatGPT, Claude/Anthropic, Build-Wiki/Farmer, and direct OpenCloud status.
- Build-Wiki/Farmer status with Run Now scoped to `opencloud-docs-farmer.service`.
- Direct OpenCloud access distinction.

Hermes owner replies now answer:

- "What integrations can you see?"
- "What models can you help Agent Zero use?"
- "What tools and MCPs can you see?"
- "Can you use Firecrawl/Drive/OneDrive right now?"
- "Can you see OpenCloud or Build-Wiki/Farmer status?"

All of these replies stay read-only and state blocked conditions instead of implying execution.

## Tests Run

- `git diff --check`: passed.
- `pnpm exec vitest run src/lib/hermes-bridge.test.ts`: passed, 17 tests.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 98 test files and 1024 tests.

## Route Smoke

Unauthenticated smoke checks returned 401 as expected:

- Hermes status route.
- Hermes test-chat route.
- Bridge providers route.
- MCP list route.

Authenticated production prompt smoke was not run from this shell because no owner session credential was used or exposed. The phase prompts are covered by the Hermes read-only guardrail unit tests.

## Service Status

- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.
- `agent-zero` container: running.

## Safety

- No external writes were performed.
- No Zapier writes were performed.
- No HeyGen generation was performed.
- No SMB mount was attempted.
- No farmer execution was performed.
- No Docker socket or raw root access was granted to Hermes.
- No `.env` changes were made.
- No credential values, tokens, auth files, or API keys were printed or committed.

## Blockers

- Hermes live chat adapter remains safe-blocked as `hermes_safe_live_chat_adapter_not_configured`; the route returns Mission Control guardrail replies and does not call an execution-capable Hermes adapter.
- Authenticated production route prompts require an owner-authenticated session and were not executed from this shell.

## Rollback

Rollback after commit:

```bash
git revert <commit-hash>
systemctl restart mission-control.service
```
