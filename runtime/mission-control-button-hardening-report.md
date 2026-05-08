# Mission Control Button Hardening Report

Generated: 2026-05-08

## Objective

Begin the button-by-button hardening pass for Mission Control so visible actions are not fake, stale, or misleading.

Rule applied:

- A button may be live only when it maps to a real route.
- A read-only button may only call a read-only route.
- A protected action must be Bridge Session-gated or owner-approval-gated.
- A missing backend, missing credential, or unavailable integration must render as blocked/disabled with an exact blocker.
- No fake Done, fake live status, fake upload, fake send, or fake execution state is allowed.

## Scope Completed In This Slice

This slice focused on the newly updated Gateway / Agent Hub / SpaceAgent Browser Automation surface and the central Mission Control button contract registry.

## Changes Made

| File | Change |
|---|---|
| `src/app/gateway/status/page.tsx` | Added a real read-only Gateway Status page so the Agent Hub header button no longer points at a loose route target. |
| `src/lib/button-contracts-route.test.ts` | Added a route-contract test that fails if any LIVE or READ_ONLY button contract points at a missing API route. |

## Button Contract Status

The existing `GET /api/bridge/button-contracts` contract already classifies Mission Control actions into allowed states:

- `LIVE`
- `READ_ONLY`
- `BACKEND_REQUIRED`
- `CREDENTIAL_REQUIRED`
- `OWNER_APPROVAL_REQUIRED`
- `DISABLED`

The new test verifies:

- all `LIVE` and `READ_ONLY` API endpoints physically exist in the Next.js route tree;
- blocked, credential-required, owner-approval-required, or disabled actions are not executable;
- `fake_success_allowed` is false for every contract.

## Concrete Issue Found

| Issue | Fix |
|---|---|
| The Agent Hub header had a `Gateway status` button targeting `/gateway/status`, but no dedicated page existed at that route. | Added `/gateway/status` as a real read-only production status page. |

## Gateway Status Page Behavior

The new `/gateway/status` page shows:

- Gateway status summary.
- Agent Zero status and blockers.
- Hermes status and blockers.
- Bridge / MCP status.
- OpenClaw+ / Build-Wiki / Farmer status.
- Button hardening rule.
- Safety confirmation.

It does not trigger writes, uploads, sends, Zapier, HeyGen, SMB, farmer execution, or connector execution.

## Validation

| Check | Result |
|---|---|
| Direct TypeScript check with local binary | PASS |
| Focused Vitest suite | PASS, 4 files / 10 tests |
| Production build with Next.js | PASS |
| `.env` changes | none |
| Secrets printed | no |
| Raw auth files printed | no |
| Fake buttons added | no |

Focused tests run:

- `src/lib/button-contracts-route.test.ts`
- `src/lib/gateway-agent-hub.test.ts`
- `src/lib/space-agent-browser-automation.test.ts`
- `src/app/gateway-route-alias.test.ts`

## Current Blocker

Production SSH currently requires a fresh Tailscale authorization check. Because of that, this slice can be pushed to the remote branch, but the live production host cannot be pulled/restarted/smoked by Codex until that authorization is restored.

Exact blocker:

`tailscale_ssh_reauthorization_required_for_production_restart_and_smoke`

## What I Need From Owner If You Want This Live Immediately

Approve/complete the Tailscale SSH authorization prompt for the production host, then I can:

1. pull the pushed commit on production;
2. rebuild if needed;
3. restart Mission Control;
4. run authenticated route smoke;
5. run unauthenticated 401/403 smoke;
6. verify `/gateway/status`, `/gateway/agent-hub`, and the button contract route from production.

## No-Secrets Confirmation

- No tokens printed.
- No API keys printed.
- No auth files printed.
- No `.env` changes made.
- No SMB mount.
- No Fork 2.
- No Zapier writes.
- No HeyGen generation.
- No external farmers.
- No public local service exposure added.

## Updated Decision

Gateway / Agent Hub button hardening: **PARTIAL GO**.

Reason: code-level route contract and local build/test proof passed, but live production restart/smoke is blocked by Tailscale SSH re-authorization.

## Exact Next Step

After production SSH authorization is restored, deploy this button-hardening patch to the live host and run production smoke.
