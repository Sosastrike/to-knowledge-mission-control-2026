# Paperclip Gateway Integration Research Report

Generated: 2026-05-07

## Executive Summary

Paperclip was evaluated as a Workforce Operations Layer for Mission Control Gateway. The right role is task/company/workforce orchestration under Gateway policy, not command authority. Agent Zero remains commander, Hermes remains lieutenant and skill/workflow builder, Pi remains dispatcher candidate, SpaceAgent remains web research specialist, OpenCloud remains a worker/runtime engine, and OpenClaw+ remains the runtime/skills/adapters layer.

Research result: Paperclip is a strong fit for workforce tracking, co-worker modeling, issue/task records, heartbeat routines, budgets, and work-product storage. It should stay sandboxed until its own test blockers, owner login, and Gateway write-adapter design are closed.

## What Paperclip Provides

- Company/workforce structure for agents and co-workers.
- Issue/task tracking that can map Gateway missions into work items.
- Work-product records for research packets, skill proposals, and final reports.
- Heartbeat/routine concepts for recurring status checks.
- Budget and cost governance concepts.
- Adapter/plugin extension points for local model/agent runtimes.
- UI for company, agents, tasks, issues, budgets, approvals, and work products.

## Gateway Fit

Paperclip should be represented as:

- Gateway node: `paperclip`.
- Type: workforce operations layer.
- Authority: subordinate to Gateway and Agent Zero.
- Access mode: read-only until sandbox health, owner auth, and Bridge Session write adapters are proven.
- Write behavior: blocked unless Bridge Session scope and a registered Paperclip adapter explicitly allow it.

## Role Matrix

- Owner: final authority.
- Gateway: routing, policy, registry, documentation, memory, and audit hub.
- Agent Zero: commander and final decision-maker.
- Hermes: lieutenant and skill/workflow builder.
- Pi: dispatcher candidate and route optimizer in shadow mode.
- SpaceAgent: browser/web/YouTube/Firecrawl research specialist.
- Paperclip: workforce/company/task orchestration layer.
- OpenCloud: worker/runtime and future agent-creation support layer.
- OpenClaw+: runtime, skills, adapters, reports, and governance layer.
- Existing agents: retained specialist workforce.

## Integration Model

Gateway request flow:

1. Owner request enters Gateway.
2. Gateway classifies the route.
3. Pi can recommend workforce routing in shadow mode.
4. Agent Zero approves the mission and remains accountable.
5. Paperclip records or tracks the task only when write adapter and Bridge Session allow it.
6. Worker or specialist returns work product.
7. Gateway validates the result.
8. Agent Zero reports to the owner.

## Paperclip Data Objects To Map

- Gateway mission to Paperclip issue.
- Owner command to Paperclip issue.
- Mini-agent task to Paperclip issue.
- SpaceAgent Research Packet to Paperclip work product.
- Hermes skill proposal to issue/work product.
- Pi dispatcher recommendation to issue comment.
- Agent Zero decision to issue approval.
- Bridge Session to governance event.
- Completed task to final report.
- Blocked task to exact blocker.

## Security Model

- Paperclip must not expose public UI routes.
- Paperclip must not receive raw secrets, auth files, or inline tokens.
- Paperclip writes require Bridge Session and registered adapter.
- Paperclip co-workers must have supervisor, purpose, scope, budget, memory TTL, allowed tools, forbidden tools, expiration condition, and audit trail.
- Paperclip cannot replace Agent Zero, Hermes, Pi, SpaceAgent, OpenCloud, OpenClaw+, or existing agents.
- Paperclip cannot use raw root shell, Docker socket, direct secret reads, Zapier writes, HeyGen generation, SMB mount, or broad connector execution.

## Research Findings

- Sandbox install/build/typecheck previously passed.
- Paperclip test suite had Tailnet environment expectation failures in its own repo.
- Loopback and Tailnet sandbox access were previously proven when the sandbox server was intentionally running.
- Owner login is not fully proven.
- Current live service is inactive, so health/UI are blocked until Paperclip is started again in sandbox mode.

## Recommended Implementation Phases

1. Keep Paperclip sandbox-only while its own Tailnet test blocker is addressed or formally waived.
2. Prove health and owner login over Tailnet.
3. Keep Gateway node and bridge routes read-only.
4. Add write adapter only after Bridge Session scope and audit design are complete.
5. Map Paperclip issues/work products to Gateway flows.
6. Add Paperclip budget and heartbeat telemetry after live auth is proven.
7. Re-run full Mission Control and Paperclip validation before persistent service enablement.

## Final Research Decision

Paperclip is approved as a design and read-only Gateway integration track. It is not approved for production workforce execution until sandbox health, owner login, write adapter, Bridge Session scope, and tests pass.
