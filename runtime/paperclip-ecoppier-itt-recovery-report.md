# Paperclip eCoppier ITT Workspace Recovery Report

Generated: 2026-05-29

Status: CLOSED - OWNER CONFIRMED

## Scope

This report closes the Paperclip eCoppier ITT / E Copier ITT workspace recovery lane. It covers read-only route, company, workspace-truth, and owner-browser proof. No Paperclip company, issue, user, agent, project, org, task, or membership record was deleted or recreated.

## Root Cause

The owner-visible launcher and workspace-truth path needed a canonical three-company registry with route aliases. The original E Copier ITT company existed with Paperclip issue prefix `ECOA`, while the owner-facing route must be `/ITT/*`. Earlier UI behavior could fall back to E copier Solutions when `/ITT/dashboard` was not resolved by the selected workspace context.

Classification: `company_exists_under_different_slug` plus `workspace_truth_route_missing_company` / launcher context mismatch.

## Company Variants Searched

- eCoppier ITT
- eCopier ITT
- E Copier ITT
- E copier ITT
- e copier itt
- copier itt
- ITT
- ECOA

## Current Company Proof

Read-only Paperclip DB proof, redacted:

| Company | Company id | Issue prefix | Route prefix | State | Active user members | Agents | Issues |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| To Knowledge Gateway | `e6f9...10bd` | `TOK` | `TKG` | active | 3 | 10 | 0 |
| E copier Solutions | `6bcc...1ec5` | `ECO` | `ECO` | active | 2 | 7 | 38 |
| E copier ITT | `4ef8...faf4` | `ECOA` | `ITT` | active | 2 | 2 | 31 |

No duplicate E copier ITT company was created.

## Recovery Action

- Added read-only Paperclip workspace-truth payload covering loopback, Tailnet, and configured HTTPS origins.
- Added canonical owner workspace list: To Knowledge Gateway, E copier Solutions, E Copier ITT.
- Added route aliases: `TOK -> TKG`, `ECO -> ECO`, `ECOA -> ITT`.
- Added dashboard fallback probing when the Paperclip companies API is auth protected but the authenticated dashboard route exists.
- Preserved all Paperclip writes as Bridge-gated.
- Preserved existing Paperclip records; no DB mutation was performed.

## Before / After

Before:

- Owner observed `/ITT/dashboard` showing `Company not found` and `No company matches prefix "ITT"`.
- Sidebar could still show E copier Solutions, proving a selected-context fallback mismatch.

After:

- Owner confirmed E Copier ITT is visible and working in the browser.
- `/ECO/dashboard`, `/TKG/dashboard`, and `/ITT/dashboard` all return HTTP 200.
- `/ECO/agents`, `/TKG/agents`, `/ITT/agents`, `/ECO/issues`, `/TKG/issues`, and `/ITT/issues` all return HTTP 200.
- Mission Control Paperclip status and workspace-truth routes remain protected unauthenticated (`401`).

## Validation

- `pnpm vitest run src/lib/paperclip-bridge.test.ts src/lib/paperclip-live-status.test.ts --reporter=dot`: passed, 39 tests.
- `GET /login`: 200.
- `GET /api/bridge/paperclip/workspace-truth` unauthenticated: 401.
- `GET /api/bridge/paperclip/status` unauthenticated: 401.
- `GET /api/gateway/agent-hub/status` unauthenticated: 401.
- Tailnet route smoke for `/ECO`, `/TKG`, and `/ITT` dashboard/agents/issues: HTTP 200.

## Safety

- No secrets printed.
- No cookies printed.
- No tokens printed.
- No `.env` changes.
- No Paperclip writes.
- No Zapier, n8n, MCP, or connector writes.
- No company, membership, issue, agent, project, org, user, or task deletion.
- No duplicate company creation.

## Backup And Rollback

No Paperclip data backup was required for this closeout because no Paperclip data mutation was performed. Code rollback after commit: `git revert <paperclip-closeout-commit>`.
