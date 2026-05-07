# Paperclip Gateway Bridge Report

Generated: 2026-05-07

## Executive Summary

Mission Control Gateway has Paperclip bridge contracts for read-only workforce status, company/agent/issue inventory, test task blocking, Agent Zero task handoff, Hermes proposal handoff, Pi dispatcher recommendations, SpaceAgent research tasks, and workforce flow dry runs.

Status: bridge contract implemented and tested. Live Paperclip service remains blocked because the sandbox service is not running.

## Bridge Routes

- `GET /api/bridge/paperclip/status`
- `GET /api/bridge/paperclip/companies`
- `GET /api/bridge/paperclip/agents`
- `GET /api/bridge/paperclip/issues`
- `POST /api/bridge/paperclip/test-chat`
- `POST /api/bridge/paperclip/tasks`
- `POST /api/bridge/paperclip/proposals`
- `POST /api/bridge/paperclip/dispatcher-recommendations`
- `POST /api/bridge/paperclip/research-tasks`
- `POST /api/bridge/paperclip/workforce-flow`

## Gateway Node

- Node id: `paperclip`.
- Label: Paperclip Workforce Control Plane.
- Status: blocked until service is running.
- Role: workforce/company/task orchestration layer.
- Authority: subordinate to Gateway and Agent Zero.
- External writes: disabled by default.

## Agent Visibility

- Agent Zero sees Paperclip status and task handoff routes.
- Hermes sees Paperclip registry and proposal routes.
- Pi sees Paperclip task queue/recommendation routes in shadow mode.
- SpaceAgent appears in Paperclip research-task tracking flows.

## Write Policy

All Paperclip mutation routes are dry-run or blocked unless:

1. Paperclip service is running and authenticated.
2. A registered Paperclip write adapter exists.
3. A Bridge Session is active.
4. The Bridge Session scope explicitly allows the target action.
5. Gateway audit records the policy and execution decision.

## Blocked Behavior

When Paperclip cannot be called or written to, routes return exact blockers instead of fake completion. Common blockers include:

- `paperclip_sandbox_service_not_running`
- `paperclip_status_not_reachable`
- `paperclip_safe_test_task_adapter_not_configured`
- `active_bridge_session_required_for_paperclip_task_create`
- `paperclip_write_adapter_not_configured`

## Tests

Validated by:

- Paperclip bridge payload tests.
- Paperclip bridge route auth tests.
- Gateway registry/node tests.
- Final Paperclip 1,000-scenario routing gauntlet.
- Full Mission Control test suite.

## No-Secrets Confirmation

Bridge payloads are tested for no secret values, no auth files, no raw local paths, no fake Done, and no write/execute flags in read-only mode.
