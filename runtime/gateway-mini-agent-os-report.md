# Gateway Mini-Agent Operating System Report

Date: May 5, 2026
Track: Gateway design/development, separate from Agent Zero/Hermes live-proof stabilization.

## Executive Summary

Mission Control Gateway now has a first-pass Mini-Agent Operating System contract. The system models Agent Zero, Hermes, and Pi as supervised mini-agent creators/advisors while preserving the authority hierarchy: Owner is final authority, Gateway routes and governs, Agent Zero remains commander, Hermes remains lieutenant, and Pi is only a Gateway Dispatcher candidate / route optimizer / tool-use advisor.

This pass does not create a second Agent Zero, does not replace existing agents, does not delete or disable OpenCloud, does not disable Build-Wiki/Farmer, and does not scrub Tony historical archives.

## Hierarchy

- Owner: final authority.
- Gateway: routing, policy, documentation, memory, and audit hub.
- Agent Zero: commander and final mini-agent activation authority under Owner.
- Hermes: lieutenant / skill and workflow builder.
- Pi: Gateway Dispatcher candidate / route optimizer / tool-use advisor.
- Existing agents: specialist workers retained.
- Mini-agents: temporary or reusable subordinate workers.
- OpenClaw+: runtime, skills, adapters, and reports layer.
- OpenCloud: worker/runtime engine and future skill/tool/agent creation layer.
- Bridge/MCP: tools, models, and integrations access layer.
- Brain: Obsidian, MemPalace, Graphify, and Build-Wiki.

## Mini-Agent Contract

Every mini-agent proposal must include:

- parent supervisor: Agent Zero, Hermes, or Pi.
- Agent Zero command authority.
- explicit scope.
- memory TTL.
- audit trail.
- Gateway route.
- Bridge Session requirement for activation.

Mini-agents cannot:

- act independently without a supervising route.
- become a second Agent Zero.
- replace Agent Zero, Hermes, OpenCloud, OpenClaw+, Mission Control, Bridge/MCP, or Brain.
- use raw root shell.
- use Docker socket.
- read secrets directly.
- run external writes without Bridge Session scope.
- print raw local paths or secrets.
- claim fake Done.

## Gateway Routes Added

- `GET /api/gateway/mini-agents`: read-only Mini-Agent OS status and contract.
- `POST /api/gateway/mini-agents`: creates a supervised proposal only; activation remains blocked until Bridge Session and a registered runtime adapter allow it.

## Implementation Summary

Changed files:

- `src/lib/gateway-mini-agent-os.ts`
- `src/app/api/gateway/mini-agents/route.ts`
- `src/lib/gateway-mini-agent-os.test.ts`
- `src/lib/gateway-model.ts`
- `src/lib/gateway-data-layer.ts`
- `src/lib/gateway-route-auth.test.ts`

## Safety Confirmation

- No secrets were printed.
- No auth files were printed.
- No `.env` changes were made.
- No external writes were run.
- No Zapier writes were run.
- No HeyGen generation was run.
- No SMB mount was attempted.
- No OpenCloud deletion or disablement occurred.
- No Build-Wiki/Farmer disablement occurred.
- No historical Tony records were removed.

## Next Step

Run focused Gateway mini-agent tests, then Mission Control typecheck/build/test. After developer validation passes and Mission Control is restarted through the approved path, verify the Gateway UI shows Agent Zero, Hermes, Pi, mini-agents, OpenCloud, Build-Wiki/Farmer, Bridge/MCP, Brain, and policy-gated routes accurately.
