# Paperclip Workspace Map Report

Generated: 2026-05-07

## Scope

This report covers phases 231-240 for Paperclip workforce workspace routing.

## Workspace Map

| Workspace | Gateway role | Safe workspace ref | Coding worktree rule |
| --- | --- | --- | --- |
| Mission Control | Gateway dashboard, APIs, policy, registry, reports | workspace_ref_mission_control | coding tasks require isolated worktree refs |
| ClaudeClaw / OpenClaw+ | Runtime, skills, adapters, reports, governance | workspace_ref_claudeclaw_openclaw | coding tasks require isolated worktree refs |
| SpaceAgent | Browser, web, YouTube, Firecrawl research specialist | workspace_ref_space_agent | coding tasks require isolated worktree refs |
| Pi | Dispatcher candidate, route optimizer, tool-use advisor | workspace_ref_pi_dispatcher | coding disabled until promoted through policy |
| Paperclip | Workforce operations, issues, work products, budgets, routines | workspace_ref_paperclip_lab | coding tasks require isolated worktree refs |

## Policies

- Coding tasks must use an isolated worktree ref.
- Tasks must run against the selected workspace ref only.
- Wrong-workspace execution is blocked.
- Work products are stored as protected refs.
- Paperclip issue attachments are planned, but real writes require Bridge Session and a configured Paperclip write adapter.
- Mission Control Gateway links are represented as safe refs.
- Owner-facing payloads must not expose raw local paths.

## Status

The implementation is dry-run policy and registry support only. No live worktrees were created, no Paperclip issues were written, and no external writes occurred.

## No-Secrets Confirmation

No credentials, token values, auth files, environment values, or raw local workspace paths are included in this report.
