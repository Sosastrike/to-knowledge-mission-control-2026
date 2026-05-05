# Gateway Observability and Audit

## Scope

Phases 151-160 added read-only Gateway observability.

## Completed

- Added Gateway flow traces in the form `owner -> gateway -> target -> result`.
- Added derived Gateway audit records for policy decisions and execution decisions.
- Added latency fields with honest `not_recorded` status when a route has no measured duration.
- Added health metrics from Gateway node status and last heartbeat.
- Added blocker metrics for node, capability, and trace blockers.
- Added external write metrics that remain disabled unless a future active Bridge Session records allowed writes.
- Added LLM cost/token placeholders that report unavailable usage without inventing values.
- Added route replay safe mode through `/api/gateway/replay`; it returns a plan only and never executes.
- Added the Gateway Observability UI panel for route decisions, audit records, blockers, and usage placeholders.

## Safety

- No route replay executed a target.
- No external write was run.
- No tool, Zapier, HeyGen, AgentMail, Drive, OneDrive, SMB, or farmer execution was run.
- No secrets or auth file contents were printed or committed.

## Rollback

```bash
git revert <phase-commit>
```
