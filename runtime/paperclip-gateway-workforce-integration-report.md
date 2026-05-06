# Paperclip Gateway Workforce Integration Report

## Executive Summary

Paperclip was cloned and evaluated in an isolated sandbox as a candidate Workforce Operations Layer for Gateway. It was not installed into production, not exposed publicly, and not given any production secrets. Gateway now represents Paperclip as a visible but blocked workforce layer until its dependency audit risk is remediated or formally waived.

## Role Decision

- Owner remains final authority.
- Gateway remains the routing, policy, registry, audit, memory, and documentation hub.
- Agent Zero remains commander.
- Hermes remains lieutenant and skill/workflow builder.
- Pi remains dispatcher/route optimizer candidate.
- Space Agent remains browser/web/YouTube/Firecrawl research specialist.
- Paperclip is proposed as the workforce/company/task orchestration layer.
- OpenCloud and OpenClaw+ remain worker/runtime systems.
- Mini-agents remain scoped subordinate workers.
- Tony remains historical archive only.

Paperclip does not replace any existing agent or runtime.

## Repo Audit

- Repository: `paperclipai/paperclip`
- Audited HEAD: `d0e9cc7`
- License: MIT
- Package manager: `pnpm@9.15.4`
- Node engine: Node 20 or newer
- Architecture observed:
  - Node/Express server
  - React/Vite UI
  - CLI package
  - shared packages for database, server, adapters, MCP server, plugins, and shared types
  - adapters for OpenClaw, Claude, Codex, Pi, HTTP/webhook-style workers
- Product scope observed:
  - organization chart / co-worker agents
  - goals and daily tasks
  - recurring heartbeats
  - budget and cost controls
  - issues, tasks, and work products
  - governance and approval gates
  - audit/activity logs
  - company isolation

## Sandbox Status

- Clone location: isolated audit clone
- Production install: no
- Persistent service: no
- Public exposure: no
- Production secrets used: no
- External writes run: no
- Lifecycle install scripts: disabled during dependency install
- Token scan: passed
- Focused shared package typecheck: passed

## Dependency Audit

`pnpm audit --prod` returned unresolved advisories:

- Total advisories: 30
- High: 11
- Moderate: 17
- Low: 2

Representative risk areas include SQL injection, denial of service, XML parser issues, SDK file-permission advisories, and frontend sanitization/parser dependencies. Because of this, Paperclip production activation is blocked until the dependency audit is clean or the owner explicitly accepts a documented waiver.

## Gateway Integration

Gateway now includes:

- Node: `paperclip`
- Type: `workforce_layer`
- Role: `workforce_company_task_orchestration_layer`
- Parent: Gateway
- Supervisors: Agent Zero and Gateway
- Execution state: proposal-only until Bridge Session
- External writes: require Bridge Session
- Status: blocked
- Blockers:
  - `production_install_blocked_by_dependency_audit`
  - `paperclip_service_not_configured`
  - `bridge_session_required_for_workforce_mutations`

## Gateway Capability

Capability added:

- `paperclip.workforce_operations`

It covers:

- co-worker agent orchestration
- daily task assignment
- simultaneous job supervision
- recurring heartbeat management
- budget and cost tracking
- issue/task/work-product tracking
- governance and approval records
- OpenClaw adapter coordination
- MCP server integration planning

## Policy

Paperclip policies added:

- `paperclip_no_public_exposure`
- `paperclip_workforce_mutations_bridge_session_required`

Policy result:

- Read-only Gateway visibility is allowed.
- Production service activation is blocked.
- Workforce mutations require Gateway routing, Agent Zero authority, and Bridge Session scope.
- Paperclip cannot become commander.
- Paperclip cannot bypass Gateway.
- Paperclip cannot run external writes by default.
- Paperclip cannot receive raw root shell, Docker socket, or direct secret access.

## Tests

Tests added/updated for:

- Paperclip appears as a Gateway workforce layer.
- Paperclip is blocked until audit/service blockers clear.
- Paperclip capability is visible to Agent Zero, Hermes, and Pi.
- Paperclip is not commander.
- Agent Zero remains commander.
- Tony remains archived.
- Paperclip no-public-exposure and Bridge Session policies exist.

Validation results:

- Paperclip shared package typecheck: passed in sandbox.
- Mission Control focused Gateway tests: passed, 16 tests.
- Mission Control typecheck: passed.
- Mission Control build: passed.
- Mission Control full test suite: passed, 127 files / 1,180 tests.

## Blockers

- Dependency audit has unresolved advisories.
- Paperclip service is not configured.
- No production service mode has been approved.
- No public or Tailnet endpoint has been created.
- No live Paperclip workflow was run.

## Next Step

Keep Paperclip in Gateway as a blocked workforce layer while the team decides whether to remediate the dependency audit, pin/upgrade vulnerable packages, or formally waive specific advisories before any local-only service trial.

## Rollback

- Revert the Gateway model/test commit that adds the Paperclip workforce layer.
- Remove the `paperclip` Gateway node/capability/policies from the registry.
- Remove this report if the Paperclip track is paused.

## No-Secrets Confirmation

No secrets, tokens, auth files, passwords, or environment values were printed, committed, or exposed. No `.env` files were modified.
