# Paperclip Research Baseline

## Phase Status

| Phase | Status | Finding |
| --- | --- | --- |
| 000 | Complete | Created a separate Paperclip integration workstream for research and Gateway planning. |
| 001 | Complete | Cloned and inspected `paperclipai/paperclip` in an isolated audit location. |
| 002 | Complete | No production install, service activation, public exposure, or production secret usage occurred. |
| 003 | Complete | Read `README.md`. Paperclip positions itself as a company/workforce orchestration control plane. |
| 004 | Complete | Read `doc/DEVELOPING.md`. Local development uses Node 20+, pnpm 9+, embedded PostgreSQL by default, and private/authenticated bind modes. |
| 005 | Complete | Read `adapter-plugin.md`. It documents a mutable server/UI adapter registry direction and external adapter validation path. |
| 006 | Complete | Inspected `.env.example` with values redacted. It references database, port/UI, auth secret, and optional Discord webhook variables. |
| 007 | Complete | Inspected root, server, UI, and CLI package manifests. |
| 008 | Complete | Inspected `server/` structure, routes, services, adapters, auth, secrets, storage, realtime, and tests. |
| 009 | Complete | Inspected `ui/` structure, adapters, API clients, components, pages, Storybook, and tests. |
| 010 | Complete | Inspected `cli/` structure, commands, auth, doctor, worktree, heartbeat, config, and client commands. |
| 011 | Complete | Inspected `doc/` and `docs/` directories for architecture, deployment, adapters, API, operator guides, plugins, and specs. |
| 012 | Complete | Inspected `skills`, `.agents/skills`, and `.claude/skills`. |
| 013 | Complete | Inspected adapter registry and external plugin loader surfaces. |
| 014 | Complete | Inspected identity/auth model: Better Auth, board API keys, CLI auth challenges, instance roles, company memberships, and agent API keys. |
| 015 | Complete | Inspected task/issue system: issue hierarchy, checkout, comments, documents, attachments, work products, blockers, interactions, and workspace policy. |
| 016 | Complete | Inspected heartbeat execution: wakeup queue, budget checks, workspace resolution, skill loading, adapter invocation, run logs, cost events, and recovery. |
| 017 | Complete | Inspected governance/approval system: approval records, approve/reject/revision/resubmit flows, hire-agent activation, and budget policy updates. |
| 018 | Complete | Inspected budget/cost system: cost events, monthly spend summaries, scoped budget policies, incidents, warnings, and hard stops. |
| 019 | Complete | Inspected plugins: registry, lifecycle, database namespaces, tool registry, sandbox runtime, managed agents/routines, job scheduler, webhooks, and UI contributions. |
| 020 | Complete | Created this baseline report. |

## Sandbox Baseline

- Repository: `paperclipai/paperclip`
- Audited commit: `d0e9cc7`
- Branch: `master`
- License: MIT
- Runtime: Node 20 or newer
- Package manager: `pnpm@9.15.4`
- Production install: no
- Public exposure: no
- Production secrets: none used
- External writes: none run
- Prior sandbox install: completed with lifecycle scripts disabled
- Prior token scan: passed
- Prior dependency audit: blocked for production, with unresolved advisories

## Product Fit

Paperclip maps cleanly to the proposed Gateway Workforce Operations Layer:

- It models companies, org charts, goals, agents, issues, budgets, approvals, work products, and activity.
- It coordinates many agent runtimes through adapters instead of replacing them.
- It has recurring heartbeats, task checkout, execution locks, cost tracking, and audit surfaces.
- It already includes OpenClaw, Claude, Codex, Cursor, Gemini, OpenCode, Pi, process, HTTP, and plugin-style adapter concepts.

Paperclip should remain subordinate to Gateway and Agent Zero. It must not become commander or replace Agent Zero, Hermes, Pi, Space Agent, OpenCloud, OpenClaw+, or existing agents.

## Package Manifest Findings

Root package:

- Private monorepo
- Type module
- Scripts for dev, build, typecheck, tests, release, docs, smoke tests, e2e, and token checks
- Workspaces across server, UI, CLI, packages, adapters, plugins, MCP server, shared, and database packages

Server package:

- Express server
- Better Auth
- Drizzle/embedded PostgreSQL
- storage, secrets, adapters, plugins, heartbeats, costs, budgets, approvals, issues, routines, activity, and workspaces

UI package:

- React/Vite
- Adapter registry/UI config fields
- API clients for agents, approvals, budgets, costs, issues, plugins, routines, secrets, workspaces, and activity

CLI package:

- `paperclipai` command
- Board auth, company import/export, issue/approval commands, heartbeat run, doctor, configure, worktree, routines, environment helpers

## Environment Example

Inspected with values redacted. Keys observed:

- `DATABASE_URL`
- `PORT`
- `SERVE_UI`
- `BETTER_AUTH_SECRET`
- optional `DISCORD_WEBHOOK_URL`

No real values were printed or committed.

## Server Architecture

Major server areas:

- `adapters`: built-in adapter registry, process/HTTP adapters, plugin loader, model lookup
- `auth`: Better Auth integration
- `routes`: API route modules for access, agents, approvals, budgets/costs, issues, plugins, routines, secrets, workspaces, and more
- `services`: core business logic for agents, approvals, budgets, costs, heartbeat, issues, plugins, secrets, workspaces, and recovery
- `secrets`: local encrypted and external stub provider surfaces
- `storage`: local/S3 storage surfaces
- `realtime`: live event plumbing

## Adapter Registry

The server registry supports built-ins and external adapter/plugin seams.

Observed built-in or dependency adapters include:

- ACpX local
- Claude local
- Codex local
- Cursor local
- Gemini local
- OpenCode local
- OpenClaw Gateway
- Pi local
- Hermes adapter
- process
- HTTP

`adapter-plugin.md` describes a mutable registry direction with `registerServerAdapter`, `unregisterServerAdapter`, UI registry equivalents, and server-side runtime validation for external adapter strings.

## Identity and Auth

Observed surfaces:

- Better Auth sessions and users
- auth accounts/sessions/verifications
- board API keys
- CLI auth challenge flow
- instance admin roles
- company memberships
- agent API keys
- short-lived agent JWT support
- local trusted and authenticated deployment modes
- private/public exposure distinction

Gateway implication:

- Paperclip should run local/private first.
- Any owner-facing access must remain behind Mission Control/Gateway auth or Tailnet-only auth.
- Paperclip credentials must be stored in protected sources and exposed only as booleans/status.

## Task and Issue System

Observed capabilities:

- company/project/goal-linked issues
- parent/sub-issue hierarchy
- blockers/dependencies
- single-assignee checkout and release
- comments
- documents and revisions
- attachments
- issue work products
- issue thread interactions
- ask user questions, request confirmation, and suggest tasks interaction types
- execution workspace and runtime service control

Gateway fit:

- Paperclip can become the workforce issue/task ledger.
- Gateway should classify Paperclip mutating issue actions as protected workforce mutations requiring Bridge Session scope.

## Heartbeat Execution

Observed capabilities:

- agent wakeup requests
- heartbeat runs and events
- run logs
- budget checks before or during execution
- workspace resolution
- secret loading through service layer
- skill loading and sync
- adapter invocation
- cost event creation
- session state
- recovery of orphaned/stale runs

Gateway fit:

- Paperclip heartbeats map to Gateway workforce flows.
- Heartbeat execution must stay disabled until a local/private service trial passes and Bridge Session rules are enforced.

## Governance and Approvals

Observed capabilities:

- company-scoped approval records
- approval comments
- approve/reject/request-revision/resubmit flows
- hire-agent approval activation
- budget policy updates through approval paths
- activity/audit logging

Gateway fit:

- Paperclip approvals can complement Gateway/Bridge Session approvals, but Gateway remains the final policy hub.
- Any protected action must still pass Gateway policy and owner scope.

## Budget and Cost System

Observed capabilities:

- cost events by company/agent/project/goal/issue/provider/model
- monthly spend summaries
- budget policies by company, project, or agent
- warning and hard-stop states
- budget incidents
- pause/cancel hooks for over-budget scopes

Gateway fit:

- Paperclip could supply workforce budget/cost observability for mini-agents and co-worker agents.
- It should not execute or resume agents when budget policy blocks them.

## Plugin System

Observed capabilities:

- plugin registry and lifecycle
- plugin config and company settings
- plugin-owned database namespaces and migrations
- plugin entities, jobs, logs, state, webhooks
- plugin tool registry with namespaced tools
- plugin worker manager
- sandbox runtime with explicit module allow-listing and no implicit host globals
- managed agents/routines
- UI contributions

Gateway fit:

- Useful for future Gateway extension packs and workforce-specific tools.
- Must remain sandboxed and capability-gated.
- No plugin should receive raw root shell, Docker socket, direct secrets, or broad connector execution.

## MCP Server

Paperclip includes an MCP server exposing tools for:

- current actor and inbox
- agents
- issues
- heartbeat context
- comments
- documents/revisions
- projects/goals
- approvals and approval decisions
- checkout/release
- issue interactions
- workspace runtime controls
- generic API request fallback

Gateway fit:

- Discovery-first mapping is promising.
- Mutating MCP tools must be blocked unless Gateway policy and Bridge Session scope permit them.

## Skills and Agent Instructions

Observed skill folders:

- Paperclip workflow skill
- create-agent skill
- create-plugin skill
- plan-to-task conversion skill
- development skill
- diagnostic skill
- memory-file skill
- terminal-bench-loop skill
- agent-maintenance skills in `.agents/skills`
- design guide in `.claude/skills`

Gateway fit:

- Hermes can use these as references for workflow and mini-agent design.
- Agent Zero should approve activation.
- Mini-agent use must be scoped, audited, and TTL-bound.

## Production Blockers

- Dependency audit remains unresolved.
- No local/Tailnet Paperclip service has been approved or started.
- No Paperclip Bridge Session policy implementation exists yet.
- No Paperclip live route proof exists inside Mission Control.
- No Paperclip secrets source has been configured.
- No Paperclip external write path is authorized.

## Recommended Next Phases

1. Keep Paperclip as a blocked Gateway workforce-layer node.
2. Design Paperclip Gateway route contracts:
   - read-only discovery
   - issue/task import
   - co-worker registry
   - budget/cost status
   - heartbeat status
   - approval status
3. Add a Mission Control read-only Paperclip status route.
4. Add a local-only service plan, but do not start it until dependency audit blockers are resolved or waived.
5. Build policy tests for Paperclip:
   - no public exposure
   - no writes without Bridge Session
   - no root shell
   - no Docker socket
   - no direct secret reads
   - Agent Zero remains commander
   - Paperclip cannot replace existing agents

## No-Secrets Confirmation

No secrets, tokens, auth files, passwords, or environment values were printed, committed, or exposed. `.env.example` was inspected with values redacted. No `.env` files were modified.
