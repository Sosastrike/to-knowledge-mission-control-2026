# Bridge Mode Product Spec

Version: 1.0
Date: 2026-04-29
Owner policy: read-only first; no protected execution without approval gates and audit persistence.

## Purpose

Bridge Mode is the central tool tunnel for Mission Control.

Bridge Mode is also the mandatory preflight gate in the Mission Control Agent Execution Cycle. Every agent must query Bridge Mode before acting so it can select the correct tools, models, skills, integrations, MCPs, approval gates, fallback routes, and restrictions for the task.

It tells Tony and every connected agent what is available before they act:

- agents
- models
- tools
- skills
- integrations
- MCP servers
- provider routes
- approval gates
- memory and Brain Sync status
- Harness/event routing
- cost/rate limits
- blockers
- restrictions

Bridge Mode is not just the Agent Network graph. Agent Network shows relationships. Bridge Mode shows operational capability, permission, and execution readiness.

## Mandatory Preflight Requirement

Every task must begin with Bridge Mode preflight.

The UI and API must make this clear:

- agents cannot begin a task without a preflight decision,
- preflight returns selected tools/models/skills/integrations,
- preflight returns approval gates and execution locks,
- preflight returns credential and backend blockers,
- preflight returns primary and fallback routes,
- preflight returns the audit/correlation id once persistence exists,
- protected actions must stop with `OWNER_APPROVAL_REQUIRED` or HTTP `423` until approval/audit persistence is live.

Preflight is read-only first. It must not enable connector execution, memory writes, agent-to-agent protected execution, Zapier writes, or production DB changes.

## Product Goals

Bridge Mode must answer:

1. Which agents are available?
2. What can each agent see?
3. What can each agent execute?
4. Which tools/models/skills/integrations are available?
5. Which routes are active, sandbox, backup, or disabled?
6. Which actions need owner approval?
7. Which actions need credentials?
8. Which actions are blocked by missing backend runners?
9. What would happen if an agent tries to act?
10. What is the next safe action?

## UI Sections

### 1. Bridge Overview

Shows:

- total agents
- active agents
- sandbox agents
- backup providers
- disabled providers
- credential-required connectors
- owner-approval-required actions
- active blockers
- latest sync timestamp

### 2. Agent Capability Matrix

One row per agent.

Required columns:

- agent name
- status: `active`, `sandbox`, `backup`, `disabled`, `offline`
- can execute: yes/no
- execution mode: `execute`, `observe`, `review`, `recommend`, `sandbox`, `backup-only`
- available models
- available tools
- available skills
- available integrations
- available MCPs
- current provider routes
- approval gates
- memory/Brain Sync access
- Harness route status
- cost/rate limits
- blockers
- next action

### 3. Tony Route Card

Tony is the operational commander.

Tony card must show:

- primary chat route: `claude_cli_direct`
- task execution route: `openrouter_http`
- tool execution route: `claude_cli_direct`
- cloud fallback/model router: OpenRouter
- emergency local fallback: Ollama
- voice output: ElevenLabs
- STT/input path: Whisper/OpenAI/Groq approved path
- research: FireCrawl
- automation: Zapier, locked until scoped approval
- skills available
- MCPs available
- restrictions
- owner approval requirements

Do not show secrets. Do not show full voice IDs.

### 4. Agent Zero Card

Agent Zero role:

- advisor
- supervisor
- automation strategist
- agent behavior reviewer
- cost/token optimizer
- process improvement reviewer

Allowed MVP mode:

- observe
- recommend
- review

Not allowed until owner approval:

- execute protected actions
- modify Tony memory
- change governance
- change credentials
- change routing
- deploy

### 5. Hermes/Hermit Card

Hermes/Hermit role:

- skill/workflow specialist
- workflow improvement advisor
- tooling advisor
- automation flow researcher

Sandbox meaning:

- visible
- testable
- can be inspected
- can recommend
- cannot perform protected production execution
- cannot write Tony memory
- cannot write Brain Sync
- cannot expose gateway/public ports
- cannot use production credentials unless owner approves

UI label:

`Hermes: sandbox / test-only / not production-authorized yet`

### 6. Provider Inventory

Shows providers grouped by category:

- agent
- model provider
- runtime
- CLI
- gateway
- integration
- MCP
- skill source

Required fields:

- provider id
- display name
- category
- state
- endpoint if safe
- credential name only
- credential present yes/no
- route owner
- allowed agents
- blocked agents
- next action

### 7. Tool / Skill / MCP Inventory

Shows:

- tool name
- tool type
- source
- read/write classification
- credential requirement
- approval requirement
- allowed agents
- blocked agents
- rate limit
- status
- next action

### 8. Approval Gates

Shows all protected categories:

- credentials
- memory write
- governance
- Tony voice
- routing/model changes
- Zapier writes
- n8n execution
- FireCrawl credentialed jobs
- MCP reauth/enable/disable
- skill install/enable/disable
- service restart
- firewall
- Caddy/Cloudflare
- Docker exposure
- external-user access

Each gate must show:

- current state
- required owner action
- whether HTTP 423 is enforced
- whether approval persistence exists
- whether audit persistence exists
- rollback requirement

### 9. Brain Sync Panel

Read-only MVP:

- memory health status
- source list
- current sync state
- last sync timestamp
- stale data warnings
- memory write locked indicator

Future execution:

- `brain_sync_events`
- memory proposals
- source confidence tags
- owner-approved memory updates only

### 10. Harness Panel

Read-only MVP:

- event route list
- gateway status
- agent handoff status
- connector health
- blocked routes

### 10a. File Handoff Ledger Panel

Read-only MVP:

- show canonical file handoff ledger path from ClaudeClaw
- list recent file IDs, task IDs, assigned agent, local path, destination, and status
- show `temp`, `pending_destination`, `delivered`, and `failed` states honestly
- show Google Drive destination as pending unless a Drive upload runner is explicitly wired
- show missing permission/manual-step guidance when an external destination cannot be written
- do not execute uploads, connector writes, deletions, or file moves from this panel
- link file handoff facts into Brain Sync and task history visibility

Future execution:

- persistent `harness_events`
- ticket routing
- approved handoff execution
- failure alerts
- retry policy
- owner-approved destination delivery after the canonical approval/audit path exists

### 11. Cost / Rate Limits

Shows:

- provider-level daily usage
- agent-level token usage
- task-level cost if known
- loop warnings
- rate limits
- expensive job warning state
- approval required for expensive jobs

## Agent Capability Matrix Schema

Read-only API object:

```json
{
  "agent_id": "tony",
  "agent_name": "Tony",
  "status": "active",
  "mode": "execute",
  "models": [],
  "tools": [],
  "skills": [],
  "integrations": [],
  "mcps": [],
  "routes": {},
  "approval_gates": [],
  "execution_permissions": {},
  "brain_sync": {},
  "harness": {},
  "cost_limits": {},
  "blockers": [],
  "next_action": null
}
```

## Status Semantics

### Active

Available for production use within its approved scope.

### Configured

Credential/config appears present, but the provider may not be routed to any agent yet.

### Sandbox

Visible and testable, but not production-authorized for protected execution.

### Backup

Available only as fallback or emergency route.

### Disabled

Unavailable by policy or configuration.

### Credential Required

Backend contract exists but required credential is missing.

### Backend Required

UI/API contract exists but runner, persistence, or adapter is missing.

### Owner Approval Required

Action must not run until approval gate and audit chain allow it.

## Permission Model

Permissions are explicit.

Allowed modes:

- `observe`
- `recommend`
- `review`
- `draft`
- `request_approval`
- `execute_approved_action`
- `never_allowed`

Default rule:

- If permission is unknown, deny execution.
- If action is protected, return HTTP `423`.
- Empty allowlist does not mean open access.
- Sandbox agents cannot execute protected actions.

## Read-Only MVP

Read-only MVP must:

- add a visible Bridge Mode section
- show the full agent/provider/tool matrix
- aggregate current live APIs
- show blockers honestly
- disable protected actions
- return 423 for protected writes
- avoid DB migrations if possible
- avoid fake success

Read-only MVP must not:

- execute Zapier writes
- execute n8n workflows
- write memory
- write Brain Sync events
- expose Hermes publicly
- promote Hermes to production
- change Tony routes
- change Tony voice
- change governance
- change credentials

## Execution-Enabled Future Version

Execution requires:

- approval persistence
- audit chain
- rollback plan
- connector run records
- source confidence
- TTL/scoped permissions
- owner UI approval
- protected action category enforcement

Execution-enabled endpoints must be added only after owner approval.

## Approval-Gated Execution Rules

Protected write flow:

1. Agent requests action.
2. Bridge Mode classifies action.
3. If protected, return `423 Locked`.
4. Create approval request only through explicit request endpoint.
5. Owner approves/denies.
6. Audit record is written.
7. Runner checks approval scope and TTL.
8. Runner executes.
9. Audit record stores result.
10. Rollback pointer is recorded.

No implicit approval.

## Memory / Brain Sync Integration

Brain Sync rules:

- no auto memory injection without approval
- all shared knowledge includes source, timestamp, confidence, and owner/agent attribution
- stale memory is not treated as fact
- agents can recommend memory updates
- protected memory cannot be overwritten automatically

Bridge Mode must show:

- which agents can read memory
- which agents can propose memory
- which agents can write memory
- which writes require owner approval

## Harness Routing Integration

Harness routes:

- tickets
- workflow events
- agent activity
- connector status
- integration status
- sync health
- handoffs
- failure alerts

Bridge Mode must show:

- route source
- route target
- route state
- permission state
- blocker
- owner approval requirement

## Audit Logging Requirements

Every protected action must record:

- event id
- timestamp
- actor
- agent
- target
- action
- action category
- payload hash
- approval id
- decision
- owner reason
- before reference
- after reference
- rollback pointer
- result

Audit records must not store secrets.

## Required API Endpoints

Read-only MVP:

- `GET /api/bridge/mode`
- `GET /api/bridge/agents`
- `GET /api/bridge/agents/:id/capabilities`
- `GET /api/bridge/tools`
- `GET /api/bridge/models`
- `GET /api/bridge/integrations`
- `GET /api/bridge/mcps`
- `GET /api/bridge/skills`
- `GET /api/bridge/routes`
- `GET /api/bridge/permissions`
- `GET /api/bridge/blockers`
- `GET /api/bridge/costs`
- `GET /api/bridge/approval-gates`
- `GET /api/bridge/button-contracts`

Future protected execution:

- `POST /api/bridge/approval-requests`
- `POST /api/bridge/approval-requests/:id/approve`
- `POST /api/bridge/approval-requests/:id/deny`
- `POST /api/bridge/execute`
- `POST /api/bridge/dry-run`
- `POST /api/bridge/handoff`
- `POST /api/bridge/memory-proposals`
- `POST /api/bridge/brain-sync/events`
- `POST /api/bridge/harness/events`

## Required Tables

Do not migrate until owner approves.

- `bridge_agent_profiles`
- `bridge_agent_capabilities`
- `bridge_agent_permissions`
- `bridge_tool_inventory`
- `bridge_skill_inventory`
- `bridge_mcp_inventory`
- `bridge_model_routes`
- `bridge_provider_routes`
- `bridge_integration_routes`
- `bridge_approval_requests`
- `bridge_audit_events`
- `bridge_action_locks`
- `bridge_execution_runs`
- `bridge_connector_runs`
- `bridge_brain_sync_events`
- `bridge_memory_proposals`
- `bridge_harness_events`
- `bridge_cost_limits`
- `bridge_rate_limits`
- `bridge_external_access_scopes`

## Security Requirements

- No secrets in UI.
- Credential names only.
- Protected writes default to locked.
- Sandbox agents cannot execute protected actions.
- Public dashboards must stay behind approved auth.
- Agent-to-agent execution requires owner-approved scopes.
- External users require explicit access policy.
- Tony voice is Tony-only.
- Tony memory is protected.
- Governance changes require owner approval.

## Initial Implementation Plan

Phase 1: read-only Bridge Mode MVP.

1. Add left-rail `Bridge Mode`.
2. Add `BridgeModePage`.
3. Add `GET /api/bridge/mode` aggregate endpoint.
4. Render agent capability matrix.
5. Render Tony route card.
6. Render Agent Zero observe/review card.
7. Render Hermes sandbox card.
8. Render provider/tool/skill/MCP inventory.
9. Render approval gate table.
10. Render blockers and next actions.
11. Ensure all protected action buttons are disabled or return `423`.
12. Typecheck/build/restart.

Phase 2: approval/audit persistence design.

Phase 3: owner-approved DB migration.

Phase 4: connector dry-run/probe runners.

Phase 5: execution-enabled connector runners.

Phase 6: Brain Sync and Harness write integration.

Phase 7: external-user bridge.
