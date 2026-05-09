# Day 17 - Gateway Overview 100% Closure

Date: 2026-05-09
Branch: to-knowledge-mc
Lane: Gateway Overview
Status: DEVELOPER-SIDE CLOSED
Blocker class: OWNER_GATED for authenticated owner visual confirmation of live-hydrated overview
Code commit: 2fab081
Code rollback: git revert 2fab081

## Scope

Day 17 closes the developer-side Gateway Overview lane by wiring the accepted FULL v3 designer Overview page to real Gateway status data without redesigning the mock.

The visual contract remains the designer file:

- public/designer-mission-control/design/gateway/Gateway Overview.html
- public/designer-mission-control/design/gateway/shared/tokens.css
- public/designer-mission-control/design/gateway/shared/render.js
- public/designer-mission-control/design/gateway/shared/gateway-data.js

No layout vocabulary, class names, tokens, or rendering structure were changed. The implementation only updates the shared data source so the Overview page can hydrate truthful production states when the authenticated Mission Control runtime can reach the same-origin Gateway APIs.

## Inventory Findings

Before Day 17, the mounted Gateway Overview used the designer data file in pure mock mode:

- `window.GATEWAY.NODES` was static.
- The file explicitly described itself as no-backend pure literal data.
- Blocked or gated systems could still render as green/connected on the Overview map when the live runtime said otherwise.
- The mounted page itself was correct, but the Overview data source could drift from Mission Control truth.

Canonical runtime sources available:

- `/api/gateway/nodes`
- `/api/gateway/status`

These routes are protected and require authenticated Mission Control context or the local route-smoke API key in proof harnesses.

## Implementation

Files changed:

- public/designer-mission-control/design/gateway/shared/gateway-data.js
- src/lib/gateway-overview-live-hydration.test.ts

The designer data file now:

- keeps the same global `window.GATEWAY` contract;
- keeps the same node IDs, names, roles, and designer rendering shape;
- attempts same-origin hydration from `/api/gateway/nodes` and `/api/gateway/status`;
- maps live runtime statuses into the locked FULL v3 grammar:
  - green
  - yellow
  - blue
  - red
  - gray
- preserves the designer fallback when live APIs are unavailable;
- avoids fake live claims by applying blocker text and capability state from the protected runtime response.

The new guardrail test verifies:

- the designer data still renders without live APIs;
- live API hydration updates statuses and blockers;
- designer labels are not replaced or restyled by runtime data.

## Route And API Behavior

No new routes were added.

Routes used by the hydrated Overview:

- `GET /api/gateway/nodes`
- `GET /api/gateway/status`

The page remains mounted at:

- `/gateway`

Compatibility and related Gateway routes remain unchanged:

- `/gateway/routes`
- `/gateway/registry`
- `/gateway/agent-hub`
- `/agents`
- `/agent-network`

## UI Behavior

The Gateway Overview still mounts the FULL v3 designer page directly.

When authenticated API context is present, the Overview map hydrates live states for systems including:

- Gateway Core
- Agent Zero
- Hermes
- Obsidian
- Build-Wiki
- Firecrawl
- AgentMail
- Google Drive
- OneDrive
- Zapier
- OpenRouter

Truthful examples observed in local proof:

- Hermes: yellow with `hermes_degraded_or_pending_live_proof`
- Obsidian: blue with `obsidian_write_adapter_disabled`
- Build-Wiki: yellow with `Owner approval required for buildwiki.run_now.`
- Firecrawl: red with `credential_required`
- AgentMail: red with `email_provider_not_visible_or_configured`
- Google Drive: red with `google_drive_not_visible_or_configured`
- OneDrive: red with `onedrive_not_visible_or_configured`
- Zapier: red with MCP server missing blocker
- OpenRouter: red with provider registry/config blocker

Build-Wiki Run Now remains scoped only to `buildwiki.run_now` and the literal service target `opencloud-docs-farmer.service`. It does not execute from the Overview lane.

## Tests Run

Fresh validation for the Day 17 code change:

- `pnpm test src/lib/gateway-overview-live-hydration.test.ts`
  - passed
  - 1 file
  - 2 tests
- `git diff --check`
  - passed
- `pnpm run typecheck`
  - passed
- `pnpm run build`
  - passed
  - included `sync-static-to-standalone`
- `pnpm test`
  - passed
  - 148 files
  - 1298 tests
- `node scripts/check-protected-file-invariants.mjs`
  - ok: true
- staged secret scan for code/test files
  - ok: true
- `.env` diff check
  - clean

## Runtime Proof

Deployment/restart command:

`PORT=3337 MC_HOSTNAME=127.0.0.1 VERIFY_HOST=127.0.0.1 LOG_PATH=/tmp/mc-day17-gateway-overview.log BRANCH=to-knowledge-mc bash scripts/deploy-standalone.sh`

Deploy script result:

- Old PID stopped: 47252
- Deployed commit reported by script: 2fab081
- Temporary script PID reported: 59507
- Port: 3337
- Static asset probe: `/_next/static/css/0f8dc0fb86554783.css`

Known runtime note:

- The standalone child exited immediately after readiness, matching the known local proof-process behavior observed in earlier Gateway closeout work.
- The log showed readiness and migrations without an explicit runtime error.
- A stable local-only proof runtime was restored with a screen-backed process.

Current proof runtime:

- Bind: 127.0.0.1:3337
- PID: 63786
- Screen session: mc-day17-gateway-overview
- Runtime commit under proof: 2fab081
- Public exposure: none added

Route smoke:

- `/login`: 200
- `/gateway`: 307 to `/login` when unauthenticated
- `/gateway/routes`: 307 to `/login` when unauthenticated
- `/gateway/registry`: 307 to `/login` when unauthenticated
- `/gateway/agent-hub`: 307 to `/login` when unauthenticated
- `/agents`: 307 to `/login` when unauthenticated
- `/agent-network`: 307 to `/login` when unauthenticated

Protected action lock:

- `node scripts/check-protected-actions-locked.mjs http://127.0.0.1:3337`
- ok: true
- checked: 11
- protected write/execution actions remain locked or approval-gated.

Gateway node API proof:

- `/api/gateway/nodes` returned ok: true
- count: 43
- Firecrawl: blocked
- AgentMail: blocked
- Build-Wiki: read_only

Hydration proof:

- Local browser proof required the same authenticated API context used by route smoke.
- With that context, the mounted `/gateway` iframe hydrated from live Gateway APIs and displayed runtime blockers instead of stale mock-connected states.
- With proof cookie only, the local iframe could not authenticate API hydration and safely fell back to designer data. This is a proof-harness limitation, not a production data claim.

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No fake GO.
- No fake Done.
- No fake buttons added.
- No raw local paths exposed to owner-facing UI.
- No designer token or class changes.
- No custom React redesign.
- No SMB/Fork 2.
- No Zapier writes.
- No HeyGen generation.
- No external farmers.
- No parked artifacts staged.

## Remaining Blocker

Blocker: owner_authenticated_gateway_overview_retest_required

Classification: OWNER_GATED

Owner retest needed:

- Log in to Mission Control.
- Open `/gateway`.
- Confirm the FULL v3 Overview still matches the designer mock.
- Confirm Gateway Overview scroll/navigation still behaves naturally.
- Confirm statuses are truthful and do not show blocked systems as live.
- Confirm no fake buttons, raw paths, secrets, or OpenCloud architecture label appear.

## Closeout Ledger

- Day number and lane: Day 17 - Gateway Overview
- Status: DEVELOPER-SIDE CLOSED
- Blocker classification: OWNER_GATED
- Code commit hash: 2fab081
- Push result: pushed to origin/to-knowledge-mc
- Deployed/proof commit: 2fab081
- Runtime proof: local-only standalone proof on 127.0.0.1:3337
- Current proof PID: 63786
- Rollback command: git revert 2fab081
- Next day automatically started: Day 18 - Agent Hub UI 100% Closure
