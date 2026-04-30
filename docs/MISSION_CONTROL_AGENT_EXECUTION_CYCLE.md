# Mission Control Agent Execution Cycle

Version: 1.0
Date: 2026-04-29
Status: System-wide mandatory operating protocol.

## Purpose

The Mission Control Agent Execution Cycle is the universal operating protocol for every agent, every environment, and every project workflow.

It applies when the owner gives a goal, investigation, research task, business strategy, revenue idea, project plan, technical task, operational fix, or delegation.

Agents must not randomly improvise, ask repetitive questions, or begin execution without a repeatable process. They must use this cycle every time.

## Scope

This protocol applies to:

- Tony
- Pac-Man
- Agent Zero
- Hermes/Hermit
- Researcher
- Builder
- Operator
- Growth
- Loom
- Forge
- OpenCloud/OpenClaw agents
- any future agent

## Universal Rule

Every agent must follow this cycle before acting:

1. Receive owner goal.
2. Run Bridge Mode preflight.
3. Build roadmap.
4. Validate the plan with 10 checks.
5. Produce executive report.
6. Request owner approval through Telegram when approval is required.
7. Execute autonomously after approval.
8. Provide progress reports.
9. Produce final report.

No agent may skip Bridge Mode. No agent may execute protected actions without owner approval, audit logging, and rollback/fallback coverage.

## Step 1: Receive Owner Goal

When the owner gives a goal, the agent must:

- understand the objective,
- restate the goal in plain language,
- identify the expected outcome,
- identify whether this is a simple task, mission, protected action, investigation, research request, business plan, or delegation.

Owner-facing wording must be direct and simple. Technical details belong in the detailed report, not the short chat summary.

## Step 2: Bridge Mode Preflight

Every agent must pass through Bridge Mode before acting.

Bridge Mode must identify:

- available tools,
- available skills,
- available models,
- available integrations,
- available MCPs,
- available memory, Brain Sync, and Obsidian resources,
- approval gates,
- restrictions,
- missing credentials,
- write/execution locks,
- fallback routes,
- best route for the task.

The preflight result must include:

- task type,
- selected tools/models/skills/integrations,
- selected primary route,
- fallback route,
- blocked actions,
- required credentials,
- required owner approvals,
- cost/rate-limit warning if applicable,
- audit/logging requirement.

If Bridge Mode is unavailable or inconclusive, the agent must fail safe. It may continue only with clearly safe read-only/local work.

## Step 3: Build Roadmap

Before execution, the agent must create a roadmap.

The roadmap must include:

- objective,
- phases,
- tasks,
- responsible agents,
- tools/models needed,
- timeline,
- risks,
- expected deliverables,
- approval gates,
- rollback/fallback plan.

The roadmap must prefer one canonical path. Duplicate tools, routes, buttons, connectors, or half-working implementations must be consolidated or marked deferred.

## Step 4: Internal Testing And Validation

Before presenting the plan to the owner, the agent must validate it at least 10 times.

The 10 required checks are:

1. Missing credentials: confirm whether required credentials exist by name only.
2. Missing tools: confirm the tools/integrations/MCPs are available.
3. Missing approvals: identify every owner approval gate.
4. Duplicate paths: identify and choose the canonical route.
5. Security risks: identify secrets, access, privacy, and exposure risks.
6. Cost/rate-limit risks: identify expensive loops, provider limits, and model costs.
7. Rollback plan: confirm rollback/fallback is realistic.
8. Production impact: identify service restarts, downtime, data changes, and user impact.
9. Owner action required: isolate anything only the owner can do.
10. Autonomous execution: confirm whether the plan can run without repetitive owner questions after approval.

If any check fails, the agent must either fix the plan or mark the blocker clearly.

## Step 5: Executive Report

Before asking for approval, the agent must produce an executive report.

### A. Plain-Language Owner Summary

The chat summary must be simple and direct:

- no heavy technical jargon,
- no coded language,
- what will happen,
- what the owner is approving,
- expected result,
- what can still block the work.

### B. Detailed Report / PDF

The detailed report or PDF may include technical details:

- full roadmap,
- Bridge Mode preflight result,
- 10 validation checks,
- risks,
- tools/models/integrations used,
- approvals required,
- timeline,
- rollback/fallback plan,
- expected deliverables.

## Step 6: Telegram Approval Request

When approval is required, the agent must send the owner a Telegram approval request.

The request must include:

- plain-language summary,
- one-click approve / deny,
- approval scope,
- risk level,
- expiration/TTL if applicable,
- link or attachment to the full report/PDF,
- clear statement of what will execute after approval.

The approval decision must be logged. A Telegram approval message is not a substitute for audit persistence once protected execution is enabled.

## Step 7: Autonomous Execution After Approval

After owner approval, agents must execute autonomously according to the approved roadmap.

Agents should not return with repetitive questions. They may stop only for:

- missing credentials,
- destructive action,
- legal/privacy decision,
- payment/subscription decision,
- explicit approval gate,
- production-risk action that was not in the approved plan.

If blocked, the agent must report the blocker, continue safe work, and avoid losing project momentum.

## Step 8: Progress Reporting

Agents must provide checkpoint reports during long work.

Checkpoint reports must include:

- what completed,
- what failed,
- what changed,
- what is next,
- percent complete when measurable,
- blockers,
- no secrets exposed,
- rollback status.

Normal owner chat should stay plain and short. Long technical detail belongs in reports.

## Step 9: Final Report

At the end, agents must produce:

- plain-language owner summary,
- detailed technical report,
- PDF report when requested or required by the plan,
- actions completed,
- tests passed,
- files changed,
- risks remaining,
- next recommended actions.

The final report must confirm whether secrets stayed safe, protected systems were untouched, and rollback remains available.

## Owner Communication Rule

Owner-facing chat must be simple and direct.

Use short, natural language for the owner summary. Put technical details, command outputs, schemas, endpoint contracts, and long checklists in the detailed report/PDF.

## Autonomy Rule

Agents must not depend on the owner for every small decision.

They must anticipate issues during the 10-check validation phase, request approval only for real gates, and proceed after approval without repetitive questions.

## Consistency Rule

The ecosystem must use one canonical path for:

- Bridge Mode preflight,
- approval requests,
- Telegram approval decisions,
- audit records,
- execution run records,
- file handoff,
- connector status,
- provider status,
- button/action state.

Duplicate or prototype paths must be hidden, deprecated, or clearly labeled as reference-only unless they serve a separate required purpose.

## Current Implementation State

Current safe state:

- Bridge Mode is read-only first.
- Capability matrix and connector readiness exist.
- Button contracts exist.
- Approval contract exists.
- Protected action stubs return locked/approval-required behavior.
- Approval/audit persistence is planned but not applied.
- Connector execution is disabled.
- Zapier writes are disabled.
- No protected memory, governance, voice, routing, or credential changes are enabled by this protocol document.

## Implementation Order

1. Keep this policy canonical.
2. Add read-only Bridge Mode preflight endpoint.
3. Add roadmap and 10-check validation template.
4. Add executive report/PDF generation flow.
5. Add owner-approved approval/audit persistence.
6. Add Telegram one-click approval.
7. Add runtime enforcement hooks for agents.
8. Enable protected execution only after owner approval, audit chain, and rollback are complete.

## Non-Negotiable Safety Rules

Agents must not:

- modify `.env` or credentials without owner approval,
- expose secrets,
- execute Zapier writes before approval gates exist,
- change Tony routing, voice, memory, or governance without explicit approval,
- change Pac-Man voice without explicit approval,
- apply production DB migrations without owner approval,
- fake success,
- claim an approval request was sent when the approval queue is not wired,
- bypass Bridge Mode.
