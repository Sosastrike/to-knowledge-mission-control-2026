# Gateway Architecture Spec

## Scope

This document defines the target Gateway architecture for Mission Control and OpenClaw+.

It covers phases 10 through 19 of the Gateway transformation and is documentation-only. It does not rename routes, change UI behavior, alter authentication, enable execution, modify connector permissions, or change any runtime data.

## Phase 10 - Gateway Purpose

Gateway is the unified routing and governance layer for traffic between:

- Owner
- Agent Zero
- Hermes
- Other agents
- LLM/model providers
- Tools
- APIs
- MCP servers
- Skills
- Events
- Brain systems
- OpenCloud and Build-Wiki/Farmer
- External integrations

Gateway should answer three questions for every request:

- Where can this request go?
- Is it allowed to go there?
- What happened after it was routed?

Gateway is not a replacement for Mission Control, Bridge/MCP, OpenClaw+, or Brain. It coordinates them.

## Phase 11 - Gateway Planes

Gateway is organized into five planes:

| Plane | Purpose | Primary systems |
| --- | --- | --- |
| Control plane | Operator UI, API controls, route configuration, approvals, and live status. | Mission Control UI/API |
| Data plane | Actual request movement through adapters, tools, MCPs, model calls, skills, and delivery surfaces. | Bridge/MCP, OpenClaw+ adapters, model routers, connector adapters |
| Policy plane | Rules that decide whether a request is allowed, blocked, redacted, audited, or approval-gated. | Governance docs, Bridge Session, auth, approvals, allowlists, redaction, audit |
| Observability plane | Health, logs, traces, route status, token/cost metrics, audit records, and run reports. | Mission Control reports, runtime logs, audit records, health routes |
| Registry plane | Source of truth for what exists and what state it is in. | Capability, skill, model, tool, agent, integration, API, MCP, Brain registries |

The planes are conceptual boundaries. They can live in the same repository at first as long as the responsibilities stay clear.

## Phase 12 - Control Plane

Mission Control UI/API becomes the Gateway control plane.

Responsibilities:

- Display Gateway Map, Gateway Nodes, Gateway routes, Gateway health, and Gateway flows.
- Show Agent Zero as commander.
- Show Hermes as lieutenant / skill-workflow specialist.
- Show Tony only as retired/archive when intentionally visible.
- Provide authenticated owner controls.
- Open and inspect Bridge Sessions.
- Trigger approval-gated actions only through registered controls.
- Show live route health and blocked reasons.
- Provide safe test-chat surfaces for Agent Zero and Hermes.
- Expose reports and audit summaries.

Non-goals:

- The control plane does not bypass auth.
- The control plane does not directly read secrets.
- The control plane does not run raw shell, Docker socket operations, or uncontrolled filesystem actions.
- The control plane does not make blocked connectors appear active.

## Phase 13 - Data Plane

Bridge/MCP and OpenClaw+ adapters become the Gateway data plane.

Responsibilities:

- Route model calls through approved model/provider adapters.
- Route MCP calls through MCP server/tool adapters.
- Route skill execution through OpenClaw+ / ClaudeClaw skill adapters.
- Route Brain access through Brain, Obsidian, MemPalace, Graphify, Brain Sync, and Build-Wiki/Farmer adapters.
- Route delivery through approved report, Telegram, AgentMail, Drive, OneDrive, and Mission Control delivery adapters.
- Enforce read-only versus write-enabled versus execution-enabled status at adapter boundaries.
- Return structured blocked reasons instead of pretending a connector worked.

Data plane actions must be registered, scoped, and auditable.

## Phase 14 - Policy Plane

Governance laws, Bridge Session, auth, approvals, allowlists, redaction, and audit become the Gateway policy plane.

Responsibilities:

- Require owner authentication for protected routes.
- Require Bridge Session approval for execution-capable operations.
- Enforce connector allowlists and domain restrictions.
- Enforce redaction on owner-facing outputs, logs, reports, and test-chat context.
- Prevent direct secret reads.
- Prevent raw root shell, Docker socket, and uncontrolled deletion access.
- Prevent Zapier writes, HeyGen generation, SMB mounting, external farmers, and Build-Wiki execution unless explicitly approved through the exact scoped session.
- Ensure every external write or adapter action is audited.
- Ensure unavailable connectors return blocked status.

Policy decisions should be explicit and inspectable.

## Phase 15 - Observability Plane

Logs, traces, route health, token/cost metrics, audit records, and run reports become the Gateway observability plane.

Responsibilities:

- Show health for Agent Zero, Hermes, Bridge/MCP, Brain systems, model providers, skills, and integrations.
- Record Gateway flow lifecycle events.
- Record policy decisions, approvals, denials, blocked actions, and execution results.
- Track model/provider status, token usage, cost summaries, and fallback behavior where available.
- Track report generation and delivery state.
- Track Build-Wiki/Farmer timer/service status and Run Now approval state.
- Prevent raw secrets, raw paths, internal task IDs, stack traces, and private tokens from appearing in owner-facing reports.

Observability should explain what happened without exposing sensitive internals.

## Phase 16 - Registry Plane

Capabilities, skills, models, tools, agents, integrations, APIs, and Brain systems become the Gateway registry plane.

Responsibilities:

- Provide one source of truth for available systems.
- Represent connected/configured/read-only/write-enabled/execution-enabled/blocked/missing-credential states.
- Represent Bridge Session requirements per capability.
- Represent ownership as ecosystem / Gateway, not Tony.
- Represent available_to for Agent Zero and Hermes.
- Represent exact blockers for unavailable capabilities.
- Feed owner-facing answers from registry data instead of guesses.

Registry entities should be safe to show to the owner without exposing credential values.

## Phase 17 - Gateway Node Types

Gateway Map nodes are typed. Initial node types:

| Node type | Description | Examples |
| --- | --- | --- |
| `owner` | Human owner / creator authority. | Owner |
| `commander` | Primary owner-facing operator. | Agent Zero |
| `lieutenant` | Secondary specialist supporting the commander. | Hermes |
| `agent` | Other assistant or automation agents. | Future agents |
| `model` | LLM or model provider route. | OpenRouter, OpenAI, Claude, Codex, Ollama |
| `mcp_server` | MCP server exposed under Bridge/MCP. | MCP servers |
| `api` | Direct API or gateway-backed service. | AgentMail, Firecrawl, Zapier, HeyGen |
| `tool` | Tool callable through Bridge/MCP or adapters. | Search, report creation, delivery adapter |
| `skill` | OpenClaw+ / ClaudeClaw skill or workflow. | Shared ecosystem skills |
| `event` | Trigger, webhook, schedule, or approval event. | Bridge Session approval, timer event |
| `brain` | Knowledge, memory, graph, sync, or farmer system. | Obsidian, MemPalace, Graphify, Brain Sync, Build-Wiki |
| `data` | Dataset, vault, index, report store, or knowledge source. | Reports, safe indexes, registry data |
| `opencloud` | OpenCloud dependency or service surface. | OpenCloud docs source |
| `external_source` | External system or source outside the core runtime. | Google Drive, OneDrive, Telegram, approved domains |

Each node should expose:

- `id`
- `type`
- `label`
- `role`
- `status`
- `health`
- `read_enabled`
- `write_enabled`
- `execution_enabled`
- `requires_bridge_session`
- `blocked_reason`
- `owner_visible_summary`

## Phase 18 - Gateway Edge Types

Gateway routes are typed edges. Initial edge types:

| Edge type | Meaning |
| --- | --- |
| `command` | Owner or commander sends a command to a target. |
| `delegation` | Agent Zero delegates planning or analysis to Hermes or another agent. |
| `tool_call` | A node invokes a registered tool adapter. |
| `model_call` | A node invokes a model/provider route. |
| `mcp_call` | A node invokes an MCP server/tool route. |
| `event` | A trigger, schedule, webhook, approval, or system event routes traffic. |
| `memory` | A node reads/writes memory through Brain or MemPalace adapters. |
| `sync` | A node initiates or observes sync/farmer/Build-Wiki movement. |
| `approval` | A request enters an approval or Bridge Session path. |
| `report` | A node creates, stores, attaches, or delivers a report. |
| `blocked` | A route was considered but blocked by policy, missing capability, missing credential, or unavailable adapter. |

Each edge should expose:

- `id`
- `type`
- `source`
- `target`
- `purpose`
- `policy`
- `status`
- `requires_bridge_session`
- `audit_event_id`
- `blocked_reason`

## Phase 19 - Gateway Flow Object

Each routed request receives a Gateway flow object.

Recommended shape:

```json
{
  "flow_id": "opaque-owner-safe-id",
  "source": {
    "node_id": "owner",
    "node_type": "owner"
  },
  "target": {
    "node_id": "agent_zero",
    "node_type": "commander"
  },
  "purpose": "Answer owner question using live registry context",
  "policy": {
    "auth_required": true,
    "authenticated": true,
    "bridge_session_required": false,
    "bridge_session_id": null,
    "read_allowed": true,
    "write_allowed": false,
    "execution_allowed": false,
    "redaction_profile": "owner_safe"
  },
  "status": "completed",
  "audit": {
    "audit_event_id": "opaque-owner-safe-audit-id",
    "created_at": "iso_timestamp",
    "completed_at": "iso_timestamp",
    "external_write": false,
    "secrets_exposed": false
  },
  "result": {
    "summary": "Agent Zero answered from the live registry.",
    "blocked_reason": null,
    "owner_visible": true
  }
}
```

Required flow fields:

- `flow_id`
- `source`
- `target`
- `purpose`
- `policy`
- `status`
- `audit`
- `result`

Allowed flow statuses:

- `created`
- `policy_check`
- `approval_required`
- `approved`
- `routed`
- `running`
- `completed`
- `blocked`
- `failed`
- `expired`
- `cancelled`

Owner-facing flow summaries must avoid raw local paths, raw task IDs, stack traces, secret values, and internal provider logs.

## Phase 20 - Commit Boundary

Commit this architecture spec only:

`docs(gateway): define gateway architecture planes and node model`

No functionality changes are part of this commit.

## Safety Confirmation

- No secrets are included in this document.
- No `.env` content is included.
- No credential values are included.
- No auth weakening is proposed.
- No external writes are proposed for this phase.
- No behavior change is included in this phase.
