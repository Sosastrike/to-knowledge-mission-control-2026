# System Cleanup / Canonicalization Policy

Version: 1.0
Date: 2026-04-29
Scope: To-Knowledge Mission Control repository and production-adjacent artifacts

## Purpose

Mission Control must keep one canonical production path for every feature, route, connector, button, document, and operational flow.

Cleanup is allowed only when it is evidence-based, reversible, and production-safe. The first pass is always inventory-only.

## Canonicalization Rule

When duplicate paths exist, keep the canonical path that is newest, authenticated, tested, and production-safe.

Selection order:

1. Live working path.
2. Authenticated route over static/prototype route.
3. Read-only inventory route plus separate approval-gated execution route.
4. Zapier canonical path when Zapier is the chosen automation path.
5. Direct API path only when Zapier cannot cover the feature.
6. Proposed migration over old draft migration.
7. Runtime endpoint truth over stale handoff documents.

## Safe Automatic Actions

These may be marked reference-only without owner approval:

- duplicate docs that point to a newer canonical doc,
- old designer package docs once runtime endpoints are canonical,
- duplicate button-contract docs once `GET /api/bridge/button-contracts` is canonical,
- duplicate runbooks with a newer canonical replacement,
- old draft migration files that clearly point to the proposed migration.

## Quarantine First

These must be quarantined before deletion unless owner explicitly approves deletion:

- stale generated reports,
- old runtime reports,
- old migration drafts,
- unused scripts,
- old prototype files,
- duplicate helper scripts,
- local `.log`, `.pid`, `.bak`, and `._*` artifacts,
- designer package snapshots that are not active production routes.

Quarantine location:

`runtime/archive/system-cleanup/YYYYMMDD-HHMMSS/`

Quarantine must include a manifest with original path, reason, evidence, rollback command, and checks run.

## Owner Approval Required Before Deletion

Never delete these without explicit owner approval:

- `.env` or `.env.*` files,
- credentials, secrets, private keys, tokens,
- database files,
- backups,
- production logs needed for audit,
- source files imported by the running app,
- active systemd/service files,
- current production route paths,
- Tony memory, voice, routing, or governance files,
- Zapier approval/audit records,
- Obsidian, Brain, or memory content.

## Required Checks Before Quarantine/Delete

Run all applicable checks before any future quarantine or deletion:

- `git status --short`
- import/reference scan with `rg`
- route scan for active Next routes
- service/systemd reference scan
- `pnpm run typecheck`
- `pnpm run build`
- `node scripts/check-button-contract-routes.mjs`
- `node scripts/check-bridge-readonly-mvp.mjs`
- secret scan on staged changes
- Mission Control smoke test
- verify Tony/Voice unchanged
- verify Zapier writes locked
- verify `.env` unchanged

## Required Checks After Quarantine/Delete

Run:

- `pnpm run typecheck`
- `pnpm run build`
- affected endpoint smoke tests
- Mission Control route smoke test
- `node scripts/check-button-contract-routes.mjs`
- `node scripts/check-bridge-readonly-mvp.mjs`
- secret scan
- verify Tony/Voice unchanged
- verify Zapier writes locked
- verify no protected execution enabled

## Rollback Rules

Every quarantine/delete action must have a direct rollback command.

For quarantined files:

`cp -a runtime/archive/system-cleanup/<batch>/<path> <original-path>`

For committed cleanup:

`git revert <commit>`

Rollback must be tested when production risk is medium or high.

## Naming and Archive Rules

Use timestamped archive names:

`runtime/archive/system-cleanup/YYYYMMDD-HHMMSS/`

Manifest file:

`MANIFEST.md`

Each manifest row must include:

- original path,
- category,
- usage evidence,
- production risk,
- action taken,
- rollback command.

## Preventing Future Duplicates

Before adding a new route, connector, tool, button, or doc:

1. Query Bridge Mode capability/button contracts.
2. Search for existing route or connector.
3. Prefer extension over parallel implementation.
4. Keep read-only and execution paths separate.
5. Use HTTP 423 for protected execution.
6. Update button contracts.
7. Update the canonical docs.
8. Add or update a check script.

## Current Canonical Paths

- Button contract truth: `GET /api/bridge/button-contracts`
- Bridge capability truth: `GET /api/bridge/capability-matrix`
- Connector readiness truth: `GET /api/bridge/connector-readiness`
- Bridge preflight truth: `GET/POST /api/bridge/preflight`
- Approval readiness truth: `GET /api/bridge/approval-readiness`
- Protected approval queue stub: `GET/POST /api/bridge/approval-requests`
- Zapier read-only inventory: `GET /api/zapier/tools`
- Zapier write approval path: `POST /api/zapier/request-write-approval`
- Skill install request path: `POST /api/skills/finder/request-install`
- Proposed migration: `docs/migrations/proposed-bridge-approval-audit-20260429.sql`
- Old migration draft: `docs/migrations/draft-bridge-approval-audit-20260429.sql` is reference-only.

## Non-Destructive First Pass

The first cleanup pass must only:

1. inventory candidates,
2. classify risk,
3. mark canonical vs stale,
4. add reference-only headers where safe,
5. prepare quarantine plan,
6. avoid deletion.
