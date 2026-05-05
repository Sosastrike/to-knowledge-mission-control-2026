# Gateway Transformation Baseline

## Scope

This document records the baseline for renaming and evolving Mission Control's current Agent Network concept into Gateway.

This is a report-only baseline. No behavior, routes, execution permissions, authentication, connectors, Brain adapters, OpenCloud, Build-Wiki, Agent Zero, Hermes, or Tony archive state were changed in this phase.

## Phase 0 - Current State Freeze

| Area | Current observed state | Notes |
| --- | --- | --- |
| Agent Zero | Status route returned 200 and `status=active`; test-chat returned 200 with `agent_zero_called=true`. | Agent Zero answered that it queried `GET /api/bridge/agent-zero/status` and received HTTP 200. |
| Hermes | Status route returned 200 with `execution_enabled=false`; test-chat returned 405 with `hermes_called=false`. | Hermes live chat is not proven. The POST route still needs compatibility or adapter work in a later phase. |
| Mission Control | `mission-control.service` is active. | Last recorded process was running since Sun 2026-05-03 22:33:02 EDT. Production restart/current standalone load still needs a separate proof phase. |
| Bridge/MCP | Bridge providers route returned 200 with 8 providers. MCP list returned 200 with 21 servers. | Visibility only; no tool invocation was performed. |
| Capability registry | Capability matrix returned 200 with 3 agents and 6 tools. | Registry visibility is present. |
| Brain | Brain status route returned 200. | The smoke response did not expose a populated `systems` array in the summary. Further adapter proof remains separate. |
| Build-Wiki/Farmer | Build-Wiki status route returned 200; Run Now state is `OWNER_APPROVAL_REQUIRED`. | No farmer execution was performed. |
| OpenCloud | Keep. Destroy is not safe yet. | OpenCloud/Build-Wiki dependency work remains outside this baseline. |
| Connectors | Connector readiness returned 6 entries: 4 read-only and 2 credential-required; 0 execution-enabled; 0 write-enabled. | Read-only inventory only. |
| Zapier | Zapier tools route returned 200; connected true; 297 tools visible; execution and writes disabled. | No Zapier writes were performed. |

## Phase 1 - Current Blocker State

| Blocker | Current status |
| --- | --- |
| Agent Zero live call | The authenticated Mission Control test-chat smoke returned `agent_zero_called=true`. This is a positive route proof, but production restart/current standalone proof remains separate. |
| Hermes live call | Blocked. `POST /api/bridge/hermes/test-chat` returned 405 and `hermes_called=false`. |
| Mission Control restart | Service is active, but the last recorded process timestamp predates the newest Gateway baseline work. No restart was performed in this baseline. |
| OpenCloud decision | Keep. Destroy is not safe until replacement coverage and rollback are proven. |
| External writes | Not performed. Zapier, HeyGen, SMB, farmer execution, email send, and Drive/OneDrive upload were not run. |

## Phase 2 - Current UI Naming Inventory

Owner-facing or UI-adjacent places that currently use Agent Network naming:

- `public/designer-mission-control/Mission Control.html`
  - Loads `src/agent-network/agent-network.css`.
  - Includes the comment "Agent Network live read-only shell".
  - Loads `src/agent-network/registry.jsx`.
  - Loads `src/agent-network/AgentNetworkCanvas.jsx`.
  - Loads `src/agent-network/AgentInspector.jsx`.
  - Loads `src/agent-network/AgentNetworkModals.jsx`.
  - Loads `src/agent-network/AgentNetworkPage.jsx`.
- `public/designer-mission-control/src/tkmc-live-adapter.jsx`
  - Uses blocked-write copy containing "Agent Network".
- `src/app/[[...panel]]/route.ts`
  - Routes `agents` and `agent-network` to the `agent-network` panel.
- `src/components/dashboard/agent-network.tsx`
  - Shows "No agent network to display".
  - Shows the heading "Agent Network".
- `public/designer-mission-control/src/dashboard.jsx`
  - Uses `agent-network` page navigation.
  - Shows "Open Agent Network".
- `src/components/dashboard/mission-control-landing.tsx`
  - Shows Agent Network card text and "Open Agent Network".
- `public/designer-mission-control/src/app.jsx`
  - Uses `page === 'agent-network'` and renders `AgentNetworkPage`.
- `public/designer-mission-control/src/agent-network/registry.jsx`
  - Comments refer to the Agent Network page.
- `public/designer-mission-control/src/agent-network/AgentNetworkModals.jsx`
  - Comments refer to Agent Network actions.
- `public/designer-mission-control/src/agent-network/agent-network.css`
  - Comments and selectors use agent network naming.
- `public/designer-mission-control/src/agent-network/AgentNetworkPage.jsx`
  - Uses `data-bind="page.agent-network"`.
  - Shows title "Agent Network".
- `src/components/ui/agent-core-node.tsx`
  - Comment refers to the agent network graph.
- `public/designer-mission-control/src/replicas/WorkspaceRail.jsx`
  - Uses `{ id: 'agent-network', label: 'Agent Network', icon: 'Network' }`.
- `src/app/agents/route.ts`
  - Redirects to `/designer-mission-control/Mission%20Control.html?page=agent-network`.
- `src/components/agent-network/AgentNetworkClient.tsx`
  - Component path, comments, heading, and footer references use Agent Network naming.
- `src/components/agent-network/agent-network.module.css`
  - Module path and comments use Agent Network naming.
- `src/app/api/bridge/button-contracts/route.ts`
  - Button labels and route metadata include Agent Network.
- `src/app/api/bridge/capability-matrix/route.ts`
  - Exposes "Agent Network UI" as an available tool label.
- `src/app/api/bridge/agent-zero/hermes-handoff/route.ts`
  - UI summary mentions Agent Network.

## Phase 3 - Current API, Response, Type, and File Naming Inventory

Agent Network naming appears in API-adjacent files, exported types, and compatibility routes:

- `src/app/[[...panel]]/route.ts`
  - Treats `agents` and `agent-network` as aliases for the `agent-network` panel.
- `src/app/agents/route.ts`
  - Defines `AGENT_NETWORK_URL` and `redirectToAgentNetwork`.
- `src/app/api/bridge/button-contracts/route.ts`
  - Defines `agent-network` route/button metadata.
- `src/app/api/bridge/capability-matrix/route.ts`
  - Publishes "Agent Network UI" in the capability answer.
- `src/app/api/bridge/agent-zero/hermes-handoff/route.ts`
  - Uses Agent Network wording in owner-facing summary text.
- `src/lib/agent-network-hierarchy.ts`
  - Exports `AGENT_NETWORK_STATUS_STATES`.
  - Exports `AgentNetworkStatusState`.
  - Exports `CanonicalAgentNetworkTier`.
  - Exports `CanonicalAgentNetworkRow`.
  - Exports `CANONICAL_AGENT_NETWORK_TIERS`.
  - Exports `CANONICAL_AGENT_NETWORK_SEED_IDS`.
  - Exports `CANONICAL_AGENT_NETWORK_HIERARCHY`.
  - Exports `getCanonicalAgentNetworkTierDefs`.
  - Exports `normalizeAgentNetworkId`.
  - Exports `isCanonicalAgentNetworkSeedId`.
  - Exports `getCanonicalAgentNetworkRows`.
  - Exports `isTonyActiveInHierarchy`.
- `src/lib/agent-network-hierarchy.test.ts`
  - Imports and tests the Agent Network hierarchy contract.
- `src/components/dashboard/agent-network.tsx`
  - Exports `AgentNetworkProps` and `AgentNetwork`.
- `src/components/agent-network/AgentNetworkClient.tsx`
  - Imports hierarchy types/functions and renders the Agent Network UI.

## Phase 4 - Current Data Model Naming Inventory

Current graph, node, edge, and hierarchy structures:

- `src/lib/agent-network-hierarchy.ts`
  - Canonical hierarchy with commander, lieutenant, runtime, system, and archive tiers.
  - Seed IDs, rows, edges, labels, and skill policy.
  - Tony archive status helper.
- `src/components/agent-network/AgentNetworkClient.tsx`
  - Tier-laned canvas and map-style presentation.
  - `TIER_DEFS`, `KNOWN_TIER_OF`, row buckets, bridge sections, external/tailnet grouping, and health/route display logic.
  - Connects Agent Zero, Hermes, OpenClaw+, Bridge/MCP, Brain systems, and archive nodes visually.
- `src/components/dashboard/agent-network.tsx`
  - ReactFlow-style graph built around `Node`, `Edge`, `AgentNode`, and `AgentNetwork`.
- `public/designer-mission-control/src/agent-network/registry.jsx`
  - `SEED_AGENTS` records with `tier`, `reports_to`, `supervises`, `handoff_targets`, `health_score`, and `engines`.
  - Agent operations: `createAgent`, `retireAgent`, `promote`, `setTier`, `setStatus`, `connectEngine`, `handoff`, `requestApproval`, `resolveApproval`, and `getCommanders`.
- `public/designer-mission-control/src/agent-network/AgentNetworkCanvas.jsx`
  - Builds nodes and edges from `engines[]` and `supervises[]`.
  - Renders tier lanes and recent handoff animation.
- `public/designer-mission-control/src/agent-network/AgentInspector.jsx`
  - Shows inspector fields including tier, reports-to, health, and handoff targets.
- `public/designer-mission-control/src/agent-network/AgentNetworkModals.jsx`
  - Add-agent wizard with tier, role, permissions, engines, and supervisor flow.
  - Baseline finding: the static modal default still includes `reports_to: 'tony'`; this is recorded only and not changed in this baseline.
- `public/designer-mission-control/src/agent-network/agent-network.css`
  - Styling selectors for nodes, edges, edge flow, tier lanes, and node states.

## Phase 5 - Naming Migration Map

| Current name | Gateway name |
| --- | --- |
| Agent Network | Gateway |
| Agent Network graph | Gateway Map |
| Agent Network card | Gateway Node |
| Agent Network node | Gateway Node |
| Agent relationship | Gateway route |
| Agent execution path | Gateway flow |
| Agent status | Gateway health |
| Agent handoff | Gateway dispatch |
| Agent hierarchy | Gateway topology |
| Agent tier | Gateway lane |
| Agent inspector | Gateway node inspector |
| Agent Network registry | Gateway registry |
| Agent Network route | Gateway route alias |
| Agent Network UI | Gateway UI |
| Agent Network client | Gateway client |
| Agent Network modal | Gateway control modal |
| Agent Network report | Gateway report |

Terms that stay in place:

- Mission Control remains the operator dashboard.
- Bridge/MCP remains the access layer under Gateway.
- OpenClaw+ / ClaudeClaw remains the runtime, skills, adapters, reports, and governance layer.
- Agent Zero remains commander.
- Hermes remains lieutenant / skill-workflow specialist.
- Tony remains retired/archive only.
- Brain remains Obsidian, MemPalace, Graphify, Brain Sync, and Build-Wiki/Farmer.

## Phase 6 - Compatibility Rule

Compatibility rule for the first migration wave:

- Keep existing `agent-network` panel names, directory names, and API routes as compatibility aliases until the Gateway UI and new Gateway route are safely introduced.
- Keep `/agents` redirect compatibility.
- Keep existing API behavior unchanged during the baseline and first UI rename.
- New owner-facing UI copy should say Gateway, Gateway Map, Gateway Node, Gateway route, Gateway flow, Gateway health, and Gateway dispatch.
- New API routes may be added under Gateway naming later, but old Agent Network routes should remain as aliases until all callers and reports are migrated.
- Data model exports can receive Gateway-named aliases before old names are removed.
- No Tony labels should be introduced by the Gateway rename. Tony remains archived only.

## Phase 7 - Gateway Mission Document

Gateway mission:

Gateway is the unified Mission Control layer that routes, governs, observes, and controls AI/API traffic across agents, LLMs, MCPs, APIs, skills, tools, events, Brain systems, OpenCloud/Build-Wiki, and external integrations.

Gateway is inspired by the AI gateway architecture pattern. It is not a KongHQ installation in this phase.

Gateway responsibilities:

- Route owner and system requests to Agent Zero, Hermes, Brain systems, Bridge/MCP, tools, models, skills, and integrations.
- Govern access with authentication, Bridge Session approvals, connector scopes, and execution policies.
- Observe health, route status, model/provider availability, connector readiness, Brain adapter state, and delivery adapter state.
- Control dispatch between Agent Zero and Hermes without fake access, raw secret reads, raw root shell, Docker socket access, or unapproved external writes.
- Preserve existing Mission Control, Bridge/MCP, OpenClaw+, Brain, Build-Wiki, OpenCloud, and archive data.

## Phase 8 - Baseline Commit Plan

Commit this report only:

`docs(gateway): record agent network to gateway baseline`

The commit must contain only `runtime/gateway-transformation-plan.md`.

## Phase 9 - No Functionality Change

No behavior change is included in this baseline.

Not changed:

- No routes were renamed.
- No API responses were changed.
- No UI labels were changed.
- No compatibility aliases were added yet.
- No Agent Zero, Hermes, Bridge/MCP, Brain, connector, OpenCloud, Build-Wiki, Telegram, AgentMail, Drive, OneDrive, Zapier, or HeyGen behavior was changed.
- No service was restarted.
- No secrets were printed.
- No `.env` file was modified.
- No external writes were performed.

## Recommended Next Implementation Phases

1. Add Gateway-named aliases in code while preserving existing Agent Network imports and routes.
2. Rename owner-facing UI copy from Agent Network to Gateway.
3. Add `/gateway` and `page=gateway` route aliases while keeping `/agents` and `page=agent-network` compatibility.
4. Add Gateway-named data model exports that wrap existing hierarchy data.
5. Update button contracts and capability matrix labels to say Gateway.
6. Update tests to assert Gateway owner-facing text and legacy alias compatibility.
7. Restart Mission Control through the approved admin path and prove production route behavior.
8. Continue Hermes live-chat adapter work separately from the Gateway rename.

## Safety Confirmation

- No secrets were printed.
- No auth files were read.
- No `.env` file was modified.
- No authentication behavior was weakened.
- No external connector writes were run.
- No Zapier writes were run.
- No HeyGen generation was run.
- No SMB mount was attempted.
- No farmer execution was run.
- OpenCloud was not destroyed.
- This baseline is report-only.
