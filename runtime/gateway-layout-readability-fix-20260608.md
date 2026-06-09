# Gateway Layout Readability Fix - 2026-06-08

## Summary
- Active runtime: `/home/tony/mission-control`
- Branch/source baseline before this fix: `304dc7f`
- Service: `mission-control.service`
- Issue: Gateway overview cards were visually stacking/overlapping and the owner could not scroll the board to inspect top/bottom content.
- Scope: static Gateway layout/UI only. No provider, connector, credential, Zapier, AgentMail, model, or execution logic was changed.

## Root Cause
- Cards are mounted into inner containers such as `#lane-brain`, `#lane-models`, `#lane-inputs`, and `#lane-integrations`.
- The surrounding lane sections had the intended grid/flex styling, but the actual mount containers were plain block elements.
- In the Nucleus layout, the outer canvas wrapper also used `overflow: hidden`, so content that spilled past the viewport could not be reached by scrolling.

## Files Changed
- `public/design/gateway/Gateway Overview.html`
- `gateway-dropin/public/design/gateway/Gateway Overview.html`
- `src/lib/gateway-graph-edge-ui.test.ts`

## Fix
- Restored canvas scrollability with `overflow: auto`.
- Added explicit grid/flex layout to the actual lane mount containers:
  - `.lane.brain #lane-brain`
  - `.lane.models #lane-models`
  - `.lane.inputs #lane-inputs`
  - `.lane.integrations #lane-integrations`
- Added Nucleus canvas `min-height: 1040px` so top, center, and bottom rows have enough room.
- Kept input/integration lanes internally scrollable instead of allowing cards to spill into the center/model rows.
- Added dark scrollbar styling so the scroll affordances fit the Gateway UI.

## Browser Geometry Proof
- Before fix:
  - `.gw-canvas-wrap` used `overflow: hidden`
  - card count: 41
  - measured overlap count: 25
  - hidden canvas content could not be reached from the UI
- After fix:
  - `.gw-canvas-wrap` uses `overflow-x:auto` and `overflow-y:auto`
  - card count: 41
  - `#lane-brain` display: `grid`
  - `#lane-models` display: `grid`
  - `#lane-inputs` display: `flex`
  - `#lane-integrations` display: `flex`
  - canvas height: `1040`
  - wrapper scroll height: `1040`
  - wrapper scroll width: `1614`

## Active Runtime Verification
- Targeted UI test: passed
  - `pnpm exec vitest run src/lib/gateway-graph-edge-ui.test.ts`
- Typecheck: passed
  - `pnpm run typecheck`
- Production build: passed
  - `pnpm run build`
- Restart: passed
  - `sudo systemctl restart mission-control.service`
- Service status: `active`
- Runtime cwd: `/home/tony/mission-control/.next/standalone`

## Route Smoke
- `/login`: `200`
- `/gateway`: `307` unauthenticated redirect/protection
- `/api/gateway/graph/node-readiness`: `401` unauthenticated
- `/api/gateway/graph/edge-readiness`: `401` unauthenticated

## Static Deployment Proof
- Layout fix is present in:
  - `/home/tony/mission-control/public/design/gateway/Gateway Overview.html`
  - `/home/tony/mission-control/.next/standalone/public/design/gateway/Gateway Overview.html`
  - `/home/tony/mission-control/gateway-dropin/public/design/gateway/Gateway Overview.html`
- Stale phrase check on touched Gateway overview assets:
  - `Bridge Session required to send mail`: not present

## Security / Safety
- No credentials printed.
- No provider keys touched.
- No `.env` or `.env.local` changes.
- Touched-file secret scan: no findings.
- No external writes executed.
- No Zapier, HeyGen, AgentMail, browser automation write, webhook write, SMB mount, or external farmer action was enabled.

## Rollback
Revert the layout-only commit that follows this report, rebuild, and restart only `mission-control.service`:

```bash
cd /home/tony/mission-control
git revert <layout-fix-commit-sha>
pnpm run build
sudo systemctl restart mission-control.service
```
