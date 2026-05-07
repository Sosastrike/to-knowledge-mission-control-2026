# Paperclip Before OpenClaw+ Gateway Chain Correction

## Decision
Paperclip is the Gateway Workforce Control Plane. OpenClaw+ / ClaudeClaw is the Runtime / Skills Engine. Paperclip sits before OpenClaw+ in the operating chain and does not replace it.

## Correct Gateway Chain
Owner -> Gateway -> Agent Zero / Pi / Hermes -> Paperclip -> OpenClaw+ -> mini-agents / specialist agents / skills / tools / reports / approvals

## Roles
- Agent Zero remains commander.
- Pi remains dispatcher / route optimizer candidate.
- Hermes remains lieutenant / skill and workflow builder.
- Paperclip organizes and supervises workforce/task operations before runtime execution.
- OpenClaw+ executes runtime work through registered adapters and Bridge Session policy.
- Existing agents and mini-agents remain retained subordinate workers; no second Agent Zero is created.

## Paperclip Manages
- co-worker agents
- mini-agent creation requests
- task queues and daily work
- budgets and costs
- heartbeats
- approvals
- work products
- task status
- supervision and assignment history

## OpenClaw+ Handles
- agents
- skills and functions
- reports and approvals
- Telegram/voice routing
- runtime ledgers
- mini-agent execution
- tool execution through Gateway / Bridge Session

## No Deletion Or Replacement
No OpenClaw+ deletion, replacement, or disablement occurred. No Agent Zero, Hermes, Pi, Space Agent, OpenCloud, existing agent, or Tony historical archive deletion occurred.

## Tests Required
- Gateway model tests should verify Paperclip is before OpenClaw+.
- Gateway route-planner tests should verify skill execution routes through Paperclip before OpenClaw+.
- Paperclip bridge tests should verify the OpenClaw+ adapter is supervised by Paperclip.
- Paperclip gauntlet should verify the corrected chain is owner-visible and secret-safe.
