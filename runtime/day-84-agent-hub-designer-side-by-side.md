# Day 84 — Agent Hub Designer Side-by-Side Closure

## Phase 0-10 — Safety, Branch, Runtime
- Branch: `to-knowledge-mc`.
- Runtime proof used local loopback only: `http://127.0.0.1:3338`.
- No `.env` edits.
- No external writes, SMB, Fork 2, Zapier writes, HeyGen generation, or auth weakening.
- Designer mock HTML/CSS/class names were not edited. Day 84 only changed the approved data/script layer and GatewayShell tab hint.

## Phase 10-20 — Inventory
- Active production Gateway entry: `/gateway` redirects into the approved designer Mission Control shell.
- Active Agent Hub tab: `/gateway?tab=agent-hub`.
- Raw designer asset: `/design/gateway/Agent Hub.html` served from `public/designer-mission-control/design/gateway/Agent Hub.html`.
- Agent Hub live API: `/api/gateway/agent-hub/status` remains protected.
- Parked untracked duplicate wrapper routes remain unstaged and unused.

## Phase 20-45 — Backend/Data Behavior
- Updated `shared/agent-data.js` seed truth to match the canonical six-agent roster:
  - Paperclip: SERVICE_DOWN/red.
  - Agent Zero: CREDENTIAL_GATED/yellow, commander, no write/execute fake state.
  - Hermes: SERVICE_DOWN/red.
  - SpaceAgent: CREDENTIAL_GATED/yellow.
  - Pi-mono: READY/blue advisory-only.
  - OpenClaw+: SERVICE_DOWN/red.
- Added data-layer truth decoration for designer buttons:
  - approval-gated buttons carry `APPROVAL_GATED` and Bridge Session reason.
  - read-only buttons carry `READY_READ_ONLY`.
  - disabled controls carry `DISABLED_WITH_REASON`.
- Kept live hydration path as `/api/gateway/agent-hub/status`; local proof classified API hydration as owner-auth gated because it returned 401.

## Phase 45-65 — UI Behavior
- `/design/gateway/Agent Hub.html` renders the designer mock as the production UI.
- No HTML/CSS/class edits were made to the mock.
- Visible stale copy is corrected through data/script runtime replacement: `5 agents` -> `6 agents`.
- GatewayShell Agent Hub tab hint now says `6 agents`.
- No fake LIVE/green status appears in the seeded Agent Hub proof.

## Phase 65-80 — Tests And Checks
- Focused tests passed:
  - `pnpm exec vitest run src/lib/gateway-agent-hub-designer-data.test.ts src/app/design/gateway/route.test.ts src/lib/gateway-native-frame-decision.test.ts`
- Route smoke passed:
  - `node scripts/protected-route-smoke-contract.mjs http://127.0.0.1:3338`
  - `ok: true`, failures: `[]`.
- Full validation gate passed:
  - `git diff --check`
  - `pnpm run typecheck`
  - `pnpm run build`
  - `pnpm test` — 202 files, 1498 tests passed.
  - `node scripts/check-protected-file-invariants.mjs`
  - `node scripts/secret-scan-contract.mjs`
  - `node scripts/raw-exposure-scan-contract.mjs`
  - `.env` diff check

## Phase 80-95 — Runtime Proof
- Direct raw design route returned 200 with owner proof cookie.
- Unauthenticated route smoke proved protected pages and APIs redirect/401 without exposing content.
- Browser proof captured:
  - direct Agent Hub screenshot: `runtime/day-84-agent-hub-designer-side-by-side/direct-agent-hub-truth.png`
  - GatewayShell Agent Hub screenshot: `runtime/day-84-agent-hub-designer-side-by-side/gateway-shell-agent-hub-truth.png`
- Proof JSON:
  - `runtime/day-84-agent-hub-designer-side-by-side/proof.json`
  - direct agent IDs: `paperclip`, `agent-zero`, `hermes`, `space-agent`, `pi-mono`, `openclaw-plus`
  - green status count: `0`
  - visible six-agent text: `true`
  - stale five-agent text: `false`
  - decorated button samples: `12`

## Phase 95-100 — Closeout
- Status: developer-side closed; owner-auth API hydration retest remains gated.
- Blocker classification: `OWNER_GATED`.
- Remaining blocker: production owner session/API proof is required to verify live Agent Hub hydration through `/api/gateway/agent-hub/status`; local browser proof received API `401` without a real owner session.
- Deploy/restart: not performed. Local proof used bounded Next dev server and stopped it after proof. Production restart remains owner/runtime gated.
- CloudCode package: no new backend-support apply in Day 84; previously consumed backend truth APIs remained in place. Day 84 consumed the approved designer drop-in data surface only.
- Rollback command after commit: `git revert <day-84-commit>`.
- Before commit rollback:

```bash
git restore public/designer-mission-control/design/gateway/shared/agent-data.js public/designer-mission-control/src/gateway/GatewayShell.jsx src/lib/gateway-agent-hub-designer-data.test.ts
rm -rf runtime/day-84-agent-hub-designer-side-by-side
```

## Files Changed
- `public/designer-mission-control/design/gateway/shared/agent-data.js`
- `public/designer-mission-control/src/gateway/GatewayShell.jsx`
- `src/lib/gateway-agent-hub-designer-data.test.ts`
- `runtime/day-84-agent-hub-designer-side-by-side/*`

## Routes Changed
- No new route file.
- `/gateway?tab=agent-hub` now presents the Agent Hub tab with a truthful six-agent hint.
- `/design/gateway/Agent Hub.html` keeps serving the raw designer asset and uses truthful data-layer state.

## Next Day
Day 85 — Mission Control Movement has automatically started after this Day 84 developer-side closure.
