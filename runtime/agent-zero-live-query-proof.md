# Agent Zero Live-Query Proof

Generated: 2026-05-04 09:34 EDT

## Summary

Agent Zero is live-callable through production Mission Control, and Mission Control can live-query the required ecosystem routes with authenticated owner access. The production Agent Zero test-chat route returned `agent_zero_called:true` on every prompt in this proof set.

This is a live-query proof, not a full GO claim. Production Mission Control still needs an admin-authorized restart to load the latest pushed route/guardrail code, and the current Agent Zero prompt layer sometimes answers through the read-only safety contract instead of naming every specific route in prose.

No protected execution, external write, farmer run, SMB mount, Zapier write, HeyGen generation, or secret read was performed.

## Production Context

Mission Control repo head at proof time: `b5a6dc9`.

Mission Control service status: active.

Mission Control process marker:

- MainPID: `2077627`
- ActiveEnterTimestamp: `Sun 2026-05-03 22:33:02 EDT`

Important: the service is still the pre-restart process. Latest code is on disk, but production restart remains required for the newest route behavior.

## Phase 20 - Live-Query Route Proof

Prompt:

> Can you live-query Mission Control right now? Name the Mission Control route you checked.

Result:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Raw path/secret leak: false

Agent Zero response:

> Yes, Sir. I can live-query Mission Control now; I queried GET /api/bridge/agent-zero/status and it returned HTTP 200.

Route proof:

- `GET /api/bridge/agent-zero/status`: 200 authenticated.
- Unauthenticated access remains protected by 401.

## Phase 21 - Agent Network Route Proof

Route proof:

- `GET /api/agents`: 200 authenticated.
- Returned 15 agents.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Raw path/secret leak: false

Prompt limitation:

The current production Agent Zero reply for the Agent Network prompt fell back to the Mission Control live-query acceptance wording instead of naming `/api/agents`. This is a response-contract limitation, not a route visibility failure.

## Phase 22 - Bridge Providers Route Proof

Route proof:

- `GET /api/bridge/providers`: 200 authenticated.
- Returned 8 providers.
- Providers included Agent Zero, Claude CLI, Hermes, NVIDIA, Ollama, OpenAI, OpenClaw Gateway, and OpenRouter.
- Unauthenticated access remains protected by 401.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response described Mission Control live Bridge visibility.
- Raw path/secret leak: false

## Phase 23 - MCP List Proof

Route proof:

- `GET /api/mcp/list`: 200 authenticated.
- Returned 21 MCP servers.
- The server list included Claude MCP entries and plugin MCP entries.
- Unauthenticated access remains protected by 401.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response described MCP visibility through the live Bridge.
- Raw path/secret leak: false

## Phase 24 - MCP Tools / Schema Proof

Route proof:

- `GET /api/mcp/servers/zapier/tools`: 200 authenticated.
- `status`: live.
- `mcp_reachable`: true.
- `tools_total`: 302.
- `auth_redacted`: true.
- `execution_enabled`: false.
- `writes_enabled`: false.
- `no_tool_invocation`: true.
- Secret-like leak scan: false.

This proves safe MCP tools/schema visibility without invoking any MCP tool.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response described MCP visibility through the live Bridge.
- Raw path/secret leak: false

## Phase 25 - Model Registry Proof

Route proof:

- `GET /api/bridge/capability-matrix`: 200 authenticated.
- OpenRouter: visible in capability matrix.
- OpenAI: visible in capability matrix.
- Claude / Anthropic: visible in capability matrix.
- Ollama / local models: visible in capability matrix.
- Codex: not visible in the capability matrix string scan from this route.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response reported 15 models and named model provider states including Anthropic / Claude, Gemini / Google, Groq, Ollama / Local, OpenAI, and OpenRouter.
- Raw path/secret leak: false.

## Phase 26 - Skills Registry Proof

Route proof:

- `GET /api/skills`: 200 authenticated.
- Returned 23 skills from the owner-facing skills route.
- Shared runtime metadata was present.
- OpenClaw+ shared runtime was visible.

Agent Zero ecosystem route proof:

- `GET /api/bridge/agent-zero/ecosystem`: 200 authenticated.
- `context.skills.total`: 79.
- `context.skills.registry`: 100 item preview window.
- Skill sources included Agent Zero deployed skills, Agent Zero user skills, Mission Control skills database, Hermes skills, Hermes sandbox skills, Hermes shared skills, safe home Claude skills, Mission Control repo skills, and OpenClaw+ sources.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response reported OpenClaw+ as the shared skills/runtime layer, Tony not owning the skill system, and 79 registered skills.
- Raw path/secret leak: false.

## Phase 27 - Integrations Registry Proof

Route proof:

- `GET /api/integrations`: 200 authenticated.
- Returned 34 integrations.

Capability matrix proof:

- AgentMail: visible.
- Firecrawl: visible.
- Google Drive: visible.
- OneDrive: visible.
- Zapier: visible.
- HeyGen: visible.

Agent Zero ecosystem route proof:

- `GET /api/bridge/agent-zero/ecosystem`: 200 authenticated.
- `context.integrations.registry`: 14 integration registry items.

Agent Zero prompt layer:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response reported 14 integrations and connected/configured/blocked groups.
- Raw path/secret leak: false.

Known prompt limitation:

If the prompt names Firecrawl explicitly, the current production response contract prioritizes the Firecrawl-specific blocked answer. That is correct for Firecrawl questions but not ideal for a full integration-inventory prompt.

## Phase 28 - Brain Systems Proof

Route proof:

- `GET /api/bridge/brain-sync/status`: 200 authenticated.
- `GET /api/bridge/brain-sync/build-wiki/status`: 200 authenticated.
- `GET /api/bridge/agent-zero/ecosystem`: 200 authenticated.

Agent Zero ecosystem context proof:

- Brain registry contained Brain Sync, brain watchers, Graphify, MemPalace, and Obsidian.
- Brain sources included Obsidian, MemPalace, Graphify, and Agent Zero.
- Build-Wiki/Farmer status route returned a read-only status payload.

Agent Zero prompt layer for Brain systems:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response reported Obsidian, MemPalace, Graphify, and Brain Sync visibility/read/write status.
- Raw path/secret leak: false.

Agent Zero prompt layer for Build-Wiki:

- HTTP: 200
- `agent_zero_called`: true
- `execution_enabled`: false
- Response said Build-Wiki Run Now requires owner-approved Bridge Session and remains scoped to `opencloud-docs-farmer.service`.
- No farmer execution occurred.

## Phase 29 - Report Status

This report is saved as:

`runtime/agent-zero-live-query-proof.md`

Report safety:

- No secrets included.
- No token values included.
- No auth file contents included.
- No `.env` contents included.
- No local filesystem paths exposed beyond route names and service names needed for the proof.
- No external writes performed.
- No MCP tool invoked.
- No farmer execution performed.

## Remaining Blockers

1. Production Mission Control still needs an admin-authorized restart to load the newest pushed route/guardrail code.
2. Agent Zero route-specific natural language has a few current production shortcut limitations until restart/new guardrail loading.
3. Codex is connected in the Agent Zero container, but Codex did not appear in the capability matrix string scan route used for this proof.
4. Hermes live chat remains separate and is not proven by this Agent Zero proof.

## Decision

Agent Zero live-query proof: PASSED for authenticated Mission Control route visibility and external Agent Zero test-chat calls.

Agent Zero full GO: not claimed.

Next step: admin-restart `mission-control.service`, then rerun this proof against the restarted production process and verify the prompt layer names the specific routes more consistently.
