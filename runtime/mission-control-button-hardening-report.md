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

## Local Validation

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

## Production Deployment

The production host was one commit behind the pushed branch. That is why the latest button hardening and `/gateway/status` page were not visible in Mission Control before this deployment.

| Item | Result |
|---|---|
| Production branch before deployment | `7e79944` |
| Production branch after deployment | `7d021b6` |
| Deployment mode | fast-forward pull from `sosastrike/to-knowledge-mc` |
| Production validation | PASS |
| Production restart | PASS |
| Old PID | `3205313` |
| Old start timestamp | `Fri May 8 07:46:23 2026` |
| New PID | `3228883` |
| New start timestamp | `Fri May 8 08:11:30 2026` |
| Standalone app bind | `127.0.0.1:3337` |
| Public local service exposure added | no |
| Playwright MCP bind | `127.0.0.1:8931` |

Production validation on the live host:

| Check | Result |
|---|---|
| `git diff --check` | PASS |
| `pnpm run typecheck` | PASS |
| `pnpm test` | PASS, 135 files / 1243 tests |
| `pnpm run build` | PASS |
| `GET /login` after restart | PASS |

## Production Route Smoke

Authenticated API smoke used the existing production API-key auth path. No key value was printed.

| Route | Authenticated result | Unauthenticated result |
|---|---:|---:|
| `GET /api/gateway/status` | 200 | 401 |
| `GET /api/gateway/registry` | 200 | not rerun unauth in this slice |
| `GET /api/gateway/agent-hub/status` | 200 | 401 |
| `GET /api/bridge/button-contracts` | 200 | 401 |
| `GET /api/bridge/agent-zero/status` | 200 | not rerun unauth in this slice |
| `GET /api/bridge/hermes/status` | 200 | not rerun unauth in this slice |
| `GET /api/gateway/nodes/pi` | 200 | not rerun unauth in this slice |
| `GET /api/bridge/pi/status` | 200 | 401 |
| `GET /api/bridge/playwright-mcp/status` | 200 | not rerun unauth in this slice |
| `GET /api/gateway/nodes/playwright-mcp` | 200 | not rerun unauth in this slice |
| `GET /api/gateway/space-agent/browser/status` | 200 | not rerun unauth in this slice |
| `GET /api/bridge/paperclip/status` | 200 | 401 |

Page smoke used a temporary internal admin session created for HTTP verification and deleted after the check. This proves the deployed UI renders, but it is not claimed as owner-authenticated browser visual proof.

| Page | Result | Proof |
|---|---:|---|
| `GET /gateway/status` | 200 | renders Gateway Status and Button Contracts |
| `GET /gateway/agent-hub` | 200 | renders Agent Zero, Hermes, Pi, SpaceAgent, Paperclip, OpenClaw+, Playwright MCP, Firecrawl, and YouTube |
| unauthenticated `GET /gateway/status` | 307 | redirects instead of exposing the protected page |

Action smoke:

| Action | Result |
|---|---|
| `GET /api/bridge/button-contracts` validation | PASS, 0 missing live routes and 0 invalid states |
| `POST /api/bridge/agent-zero/test-chat` | PASS, 200 with `agent_zero_called` present |
| `POST /api/bridge/playwright-mcp/smoke` | PASS, 200 with `ok:true`; local-only endpoint confirmed |
| `POST /api/bridge/hermes/test-chat` | BLOCKED, 503 with blocker `hermes_safe_live_chat_adapter_not_configured` |

## Remaining Honest Blockers

| Blocker | Status |
|---|---|
| Owner-authenticated browser visual proof | still requires the owner's actual browser/session; temporary admin smoke is not a substitute |
| Hermes live adapter | still blocked until `hermes_called:true` is proven |
| Firecrawl | still blocked until credential/backend is configured |
| YouTube Research | still limited until transcript connector is proven |
| Paperclip owner session bridge | still partial/degraded until owner login/session flow is proven |

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

Gateway / Agent Hub button hardening: **GO for the deployed button-contract slice**.

Reason: the designer handoff UI is built and live on production, `/gateway/status` now exists, all live/read-only button contracts have route proof, unauthenticated protected API routes reject access, and the safe Playwright MCP smoke passes.

Overall Gateway / Agent Hub remains **PARTIAL GO** until owner-authenticated visual proof is completed in the owner's actual browser.

## Exact Next Step

Use the owner's authenticated browser session to visually confirm the production Agent Hub cards and action states. No code blocker remains for this slice.
