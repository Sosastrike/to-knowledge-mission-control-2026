# Bridge Mode Preflight Policy

Version: 1.0
Date: 2026-04-29
Status: Mandatory policy, read-only enforcement first.

## Purpose

Bridge Mode is the mandatory pre-flight checkpoint for Tony and every agent before starting any task.

Bridge Mode preflight is Step 2 of the system-wide Mission Control Agent Execution Cycle. The preflight result feeds the roadmap, 10-check validation, executive report/PDF, Telegram approval request, and final execution record.

Bridge Mode exists so agents do not guess what is available. Before acting, each agent must discover:

- available tools
- available skills
- available models
- available integrations
- available MCPs
- available memory, Brain Sync, and Obsidian resources
- approval gates
- execution restrictions
- credential blockers
- cost and rate limits
- fallback routes
- required owner approvals

The expected result is that no agent says it did not know a tool, model, skill, integration, or approval gate existed.

## Mandatory Preflight Rule

Every task must start with Bridge Mode preflight.

The preflight sequence is:

1. Identify the task type.
2. Query the Bridge Mode capability matrix.
3. Determine allowed tools, models, skills, integrations, MCPs, and memory resources.
4. Check restrictions and approval gates.
5. Check whether write/execution is locked.
6. Choose the best allowed route.
7. Record the chosen route.
8. Begin work only after the preflight result is available and allowed.

The preflight result must be available before any roadmap is approved or any agent starts protected work.

## No-Bypass Rule

Agents must not bypass Bridge Mode.

If Bridge Mode is unavailable, stale, or inconclusive, the agent must fail safe:

- do not guess,
- do not execute protected actions,
- do not use unverified tools,
- do not invent integration capabilities,
- report that Bridge Mode preflight is unavailable,
- continue only with clearly safe read-only/local work if policy allows it.

## Agent Responsibilities

Every agent is responsible for:

- running Bridge Mode preflight before work,
- selecting resources from the preflight result,
- respecting restricted/locked states,
- reporting credential blockers,
- requesting owner approval when required,
- avoiding fake success,
- logging the preflight decision,
- using fallback routes only when the preflight result allows them.

Tony remains the operational leader under the owner, but Tony also must pass through Bridge Mode before task execution.

Agent Zero remains observe/recommend/review only until owner-approved execution rules exist.

Hermes/Hermit remains sandbox/read-only until owner-approved promotion and credentials exist.

## Allowed Actions

Without extra owner approval, agents may:

- read Bridge Mode capability data,
- read provider status,
- read connector readiness,
- read button contracts,
- read MCP server inventory,
- read skill search/list results,
- perform safe local analysis,
- produce plans, reports, and implementation proposals.

## Blocked Actions

Agents must not execute these without explicit owner approval and audit persistence:

- credentials or `.env` changes,
- memory writes or protected Brain Sync writes,
- governance changes,
- Tony voice changes,
- model routing changes,
- Zapier writes,
- connector execution,
- n8n workflow execution/toggle,
- FireCrawl crawl/scrape jobs that ingest/export protected data,
- MCP enable/disable/reauth or unclassified tool invocation,
- skill install/enable/disable,
- service restarts outside approved scope,
- firewall/Caddy/Cloudflare/Docker exposure changes,
- production DB migrations,
- external-user access changes.

## Task-Type Routing

Bridge Mode preflight should classify each task into one primary type:

- `status_check`: use read-only provider, service, health, and registry endpoints.
- `planning`: use policy/docs/specs and read-only capability matrix.
- `code_change`: use repo tools, typecheck/build/test, and protected-file rules.
- `connector_read`: use connector readiness and read-only tool inventory only.
- `connector_write`: require owner approval, audit persistence, and scoped execution gate.
- `memory_or_brain_sync`: read-only by default; writes require owner approval and audit.
- `agent_request`: Tony-led; Agent Zero/Hermes are observe/review/sandbox unless promoted.
- `deployment_or_infra`: owner approval required before restart/firewall/Caddy/Cloudflare/Docker changes.
- `credential_setup`: owner credential action required; agents must not print or manually edit secrets.

## Tool, Model, Skill, and Integration Discovery

Preflight must query or consume:

- `GET /api/bridge/capability-matrix`
- `GET /api/bridge/connector-readiness`
- `GET /api/bridge/providers`
- `GET /api/bridge/button-contracts`
- `GET /api/bridge/approval-contract`
- `GET /api/mcp/status`
- `GET /api/mcp/servers`
- skill search/list endpoints

The agent must use the returned states instead of assumptions.

## Approval-Gate Handling

If Bridge Mode returns `OWNER_APPROVAL_REQUIRED`, the agent must:

- stop the protected action,
- explain the approval needed,
- identify the exact endpoint/action/scope,
- report whether the approval queue is connected,
- avoid creating fake approval records,
- continue only with safe read-only work.

If approval persistence is not connected, buttons and agents must return HTTP `423` or `OWNER_APPROVAL_REQUIRED` without pretending a request was sent.

## Credential Blockers

If Bridge Mode returns `CREDENTIAL_REQUIRED`, the agent must:

- identify the credential names only,
- never print secret values,
- ask the owner to add credentials through the approved secret path,
- continue with safe read-only work.

## Backend-Required Behavior

If Bridge Mode returns `BACKEND_REQUIRED`, the agent must:

- not fake execution,
- not claim the feature is live,
- report the missing backend component,
- recommend the next implementation step,
- continue with safe work that does not depend on the missing backend.

## Fallback Behavior

Fallback routes are allowed only when Bridge Mode marks them as available.

Examples:

- Tony primary chat route: `claude_cli_direct`
- Tony cloud fallback/model router: OpenRouter, locked behind routing approval
- Tony local emergency fallback: Ollama, backup only
- Hermes: sandbox/local provider only until promoted

Agents must not silently switch models/providers when routing is protected.

## Audit and Logging Requirements

Every preflight must eventually be logged with:

- task id or correlation id,
- agent id,
- task type,
- owner goal summary,
- selected route,
- selected tools/models/skills/integrations,
- approval gates encountered,
- credential blockers,
- backend blockers,
- fallback route chosen,
- roadmap id,
- 10-check validation result,
- executive report link,
- PDF report link when generated,
- Telegram approval message id when approval is required,
- owner approval decision,
- execution run id once execution is enabled,
- decision outcome.

Current implementation starts with read-only preflight. Persistent audit logging requires the owner-approved approval/audit DB migration.

## Mission Control Agent Execution Cycle Link

Bridge Mode preflight is mandatory inside the larger Mission Control Agent Execution Cycle:

1. Receive owner goal.
2. Run Bridge Mode preflight.
3. Build roadmap.
4. Validate with the 10 required checks.
5. Produce executive report.
6. Request owner approval through Telegram when required.
7. Execute autonomously after approval.
8. Provide progress reports.
9. Produce final report.

The canonical cycle document is `docs/MISSION_CONTROL_AGENT_EXECUTION_CYCLE.md`.

The roadmap, 10-check validation, executive report, PDF, Telegram approval, progress, and final report templates are in `docs/AGENT_EXECUTION_TEMPLATES.md`.

## Failure Behavior

If Bridge Mode is unavailable:

- fail safe,
- report `Bridge Mode preflight unavailable`,
- do not execute protected actions,
- do not invent available resources,
- continue only with local/read-only diagnostics if safe,
- record the failure once audit logging exists.

## Implementation Order

1. Build read-only preflight.
2. Add audit logging.
3. Enforce preflight for agent tasks.
4. Prevent bypass at runtime/middleware.
5. Enable protected execution only through owner-approved approval gates.
