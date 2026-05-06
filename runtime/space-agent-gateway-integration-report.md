# Space Agent Gateway Integration Report

Generated: 2026-05-05

## Executive summary

Space Agent has been integrated into Gateway as a retained specialist agent for browser, web, article, YouTube, video, Firecrawl, crawl, scrape, search, extraction, and page-interaction research stages.

Space Agent does not replace Agent Zero, Hermes, Pi, OpenCloud, OpenClaw+, Bridge/MCP, Brain, or existing agents. Gateway routes research requests to Space Agent through Agent Zero. Space Agent returns a structured Research Packet, then responsibility returns to Agent Zero, Hermes, Pi, or the responsible specialist.

## Source reviewed

- Repository: https://github.com/Sosastrike/To-Knowledge-space-agent.git
- Reviewed commit: 9c26f9f
- Runtime character: browser-first AI agent runtime with a web-browsing module and browser harness surfaces.
- Important boundary: Space Agent also contains mutation-capable surfaces, so Gateway does not expose those surfaces by default.

## Implemented in Gateway

- Added `space_agent` as a `specialist_agent` Gateway node.
- Added Space Agent hierarchy routes:
  - Gateway dispatches to Space Agent.
  - Agent Zero delegates research stages to Space Agent.
  - Hermes and Pi can route research planning through Space Agent.
  - Space Agent reports back through Agent Zero/Hermes and cannot self-promote.
- Added `space_agent_research_packet` capability.
- Added Gateway route classification `research`.
- Routed browser, web, article, YouTube, video, Firecrawl, crawl, scrape, search, extraction, and page-interaction requests to Space Agent.
- Added Pi shadow-dispatcher recommendation support for Space Agent research stages.
- Added Gateway Data Layer support for `specialist_agent` nodes.
- Added Gateway Docs support for Space Agent documentation coverage.
- Added canonical Gateway flow: `flow_agent_zero_gateway_space_agent_research`.
- Added read-only Research Packet contract in `space-agent-research`.

## Research Packet contract

Space Agent Research Packets include:

- packet id
- research type
- request summary with redaction
- allowed surfaces
- forbidden surfaces
- required Gateway route
- Bridge Session requirement
- Firecrawl status
- YouTube/video status
- findings and citations placeholders
- blocked reason when applicable
- owner-visible summary

Default mode is research-only:

- browser interaction disabled until a safe live adapter is approved
- external writes disabled
- tool execution disabled
- no direct secret access
- no raw local paths
- no commander authority

## Routing behavior

Research requests follow this route:

Owner -> Gateway -> Agent Zero -> Space Agent -> Agent Zero

Pi can recommend Space Agent in shadow mode, but Pi does not execute. Hermes can request Space Agent research context for workflow or skill design, but Hermes remains lieutenant and plan-only unless Bridge Session scope allows more.

## Firecrawl behavior

Firecrawl-style requests now enter the Space Agent research stage first. If Firecrawl credentials are missing, Gateway marks Firecrawl blocked and Space Agent can still prepare a Research Packet with an honest blocker and fallback research plan. No fake Firecrawl access is claimed.

## Bridge Session boundaries

Bridge Session or owner-approved scope is required for:

- private account or login-boundary research
- paywalled/private content handling
- browser actions beyond read-only research packet planning
- external writes
- downloads/uploads/delivery actions
- any protected tool execution

## OpenCloud/OpenClaw+/Brain status

OpenCloud stays in the ecosystem as a worker/runtime engine. OpenClaw+ stays the runtime, skills, adapters, and reports layer. Brain systems stay under Gateway. Space Agent only adds a research-specialist route and does not alter OpenCloud/Build-Wiki/Farmer behavior.

## Tony status

Tony remains retired/archive only. Space Agent does not create a second commander and does not change Agent Zero commander authority.

## Tests added or updated

- Gateway graph model includes `specialist_agent` and Space Agent routes.
- Gateway route planner routes research prompts to Space Agent.
- Gateway route planner blocks private/login boundary research.
- Pi shadow dispatcher recommends Space Agent for web/browser/YouTube/Firecrawl research.
- Gateway Data Layer exposes specialist agents through discovery.
- Gateway Docs covers Space Agent.
- Gateway registry API exposes Space Agent node, capability, and flow.
- Research Packet tests cover classification, read-only defaults, Firecrawl blockers, Bridge Session boundary, and redaction.

Validation result:

- Focused Space Agent/Gateway suite: 7 test files passed, 38 tests passed.
- Mission Control typecheck: passed.
- Mission Control production build: passed.
- Mission Control full test suite: 117 test files passed, 1121 tests passed.


## Service status checked

- Mission Control service: active.
- ClaudeClaw service: active.
- Hermes gateway service: active.
- OpenCloud docs farmer timer: active.
- Agent Zero container: running.

## What stayed planning-only

- Live Space Agent browser adapter activation.
- Direct Space Agent UI exposure.
- Firecrawl execution.
- YouTube/video external extraction beyond packet planning.
- Browser interaction beyond read-only packet planning.
- Any write-capable Space Agent route.

## Blockers

- Space Agent live adapter is not activated yet.
- Firecrawl execution depends on Gateway credential status and Bridge Session scope.
- Private/login/paywall research requires owner-approved credentials and Bridge Session scope.
- External writes remain blocked unless Gateway policy and Bridge Session explicitly allow them.

## No-secrets confirmation

No API keys, tokens, auth files, credentials, or environment-file values were printed or committed. The integration uses booleans, blockers, and owner-safe summaries.

## Rollback

After commit, rollback is:

```bash
git revert <space-agent-gateway-commit>
```
