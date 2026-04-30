# Agent Execution Templates

Version: 1.0
Date: 2026-04-29
Status: Canonical templates for the Mission Control Agent Execution Cycle.

## Purpose

These templates turn the Mission Control Agent Execution Cycle into repeatable artifacts.

Agents must use these templates after Bridge Mode preflight and before protected execution.

## Roadmap Template

Every roadmap must include:

- Objective: what the owner wants done.
- Expected outcome: what success looks like.
- Task type: status check, planning, code change, connector read, connector write, memory/Brain Sync, agent request, deployment/infra, credential setup, or general.
- Bridge Mode preflight id: required once persistence exists.
- Selected primary route: tools/models/skills/integrations chosen by Bridge Mode.
- Fallback route: safe route if the primary route is blocked.
- Phases: ordered work phases.
- Tasks: concrete tasks inside each phase.
- Responsible agents: Tony, Agent Zero, Hermes/Hermit, Pac-Man, Codex, OpenCloud/OpenClaw, or future agents.
- Tools/models needed: only resources returned by Bridge Mode.
- Timeline: expected duration and checkpoint cadence.
- Risks: security, cost, production, data, or owner-experience risks.
- Approval gates: protected actions that need owner approval.
- Rollback/fallback plan: how to stop, revert, or recover.
- Deliverables: reports, files, code, routes, tests, or owner-visible results.

## 10-Check Validation Template

Before asking the owner to approve a roadmap, agents must validate it with these checks:

| # | Check | Required Answer |
| --- | --- | --- |
| 1 | Missing credentials | Which credential names are missing, without secret values? |
| 2 | Missing tools | Which tools/integrations/MCPs are unavailable? |
| 3 | Missing approvals | Which protected actions need owner approval? |
| 4 | Duplicate paths | Which duplicate paths exist, and which path is canonical? |
| 5 | Security risks | What access, secret, data, or exposure risks exist? |
| 6 | Cost/rate-limit risks | What provider cost, token, or rate-limit risks exist? |
| 7 | Rollback plan | How can the work be stopped or reverted? |
| 8 | Production impact | What services, routes, data, or users could be affected? |
| 9 | Owner action required | What only the owner can do? |
| 10 | Autonomous readiness | Can the agent run after approval without repetitive questions? |

If any check fails, the agent must revise the roadmap or mark the blocker.

## Plain-Language Summary Template

Use this for the owner-facing Telegram/chat summary:

```text
Sir, here is the plan in plain language:

I will [simple action].
This will produce [expected result].
I will not touch [protected systems].
I need your approval for [approval item], because [plain reason].
If anything fails, I will [fallback/rollback].
```

Avoid heavy technical jargon in this summary. Technical detail belongs in the detailed report/PDF.

## Detailed Report / PDF Template

The detailed report or PDF must include:

- title,
- owner goal,
- Bridge Mode preflight result,
- roadmap,
- 10 validation checks,
- tools/models/skills/integrations selected,
- approval gates,
- credentials needed by name only,
- risks,
- timeline,
- rollback/fallback plan,
- expected deliverables,
- progress-report cadence,
- final success criteria.

Reports and PDFs must not include secret values.

## Telegram Approval Request Template

When approval is required, the Telegram request must include:

- short plain-language summary,
- approve button,
- deny button,
- approval scope,
- risk level,
- expiration/TTL,
- full report link or PDF attachment,
- statement that approval will be logged,
- statement that execution will remain inside the approved scope.

Example:

```text
Approval needed, Sir.

Request: allow Mission Control to run [scoped action].
Why: [plain reason].
Risk: [low/medium/high].
Expires: [TTL].
Report: [link or attachment].

[Approve] [Deny]
```

## Progress Report Template

Checkpoint reports must include:

- completed,
- failed,
- changed,
- next,
- percent complete when measurable,
- blockers,
- secrets exposure status,
- rollback status.

## Final Report Template

Final reports must include:

- plain-language owner summary,
- detailed technical summary,
- PDF/report link when required,
- actions completed,
- tests passed,
- files changed,
- approvals used,
- risks remaining,
- next recommended actions.

## Safety Defaults

Until approval/audit persistence is live:

- approval requests may be planned but not faked,
- protected actions return `OWNER_APPROVAL_REQUIRED` or HTTP `423`,
- connector execution remains disabled,
- Zapier writes remain disabled,
- memory/Brain Sync writes remain disabled,
- production DB migrations remain owner-gated.
