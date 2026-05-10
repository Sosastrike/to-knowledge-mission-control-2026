# Day 13 - Mission Control Shell 100% Closure

Date: 2026-05-10
Branch: to-knowledge-mc
Lane: Mission Control Shell
Status: DEVELOPER-SIDE CLOSED
Blocker class: OWNER_GATED for authenticated owner visual confirmation
Current verification HEAD: 9094ef7
Source shell commit in current lineage: 92c130b
Rollback for shell source: git revert 92c130b

## Scope

Day 13 closes the developer-side shell/layout defect that could trap or clip long routed pages. The goal is to make Mission Control stop forcing every page into a single fixed viewport and allow natural document scrolling for Gateway FULL v3 and other long surfaces.

This is not owner visual GO. Authenticated owner retest remains required before the Gateway/Mission Control visual lane can move beyond PARTIAL GO.

## Inventory Findings

The shell-level offender was:

- `src/app/layout.tsx`
  - prior bad pattern: `h-screen overflow-hidden bg-background text-foreground`
  - current pattern: `min-h-screen bg-background text-foreground`
  - impact: the root document now owns page height instead of clipping long pages.

Related surfaces verified:

- `src/components/gateway/DesignerGatewayMockFrame.tsx`
  - uses `min-h-screen`
  - iframe `scrolling='yes'`
  - does not reintroduce `h-screen w-full overflow-hidden`
- `public/designer-mission-control/Mission Control.html`
  - includes the approved Gateway shell script line:
    - `<script type="text/babel" src="src/gateway/GatewayShell.jsx"></script>`
- `public/designer-mission-control/src/shell.jsx`
  - keeps Gateway as an additive left-rail entry.
- `public/designer-mission-control/src/gateway/GatewayShell.jsx`
  - mounts the approved designer pages through the Gateway drop-in shell.
- `src/app/tkmc/page.tsx`
  - remains a concrete Mission Control home route, not a redirect stub.
- `src/app/[[...panel]]/route.ts`
  - still protects main app entrypoints and redirects unauthenticated users toward `/login`.

## What Was Implemented

Already present in current lineage:

- Replaced the root forced viewport wrapper with a natural document-height wrapper:
  - from: `h-screen overflow-hidden`
  - to: `min-h-screen`
- Added shell ownership guardrail tests in:
  - `src/lib/mission-control-shell.test.ts`

The guardrail now asserts:

- the root shell does not use the fixed/clipped viewport pattern
- the Gateway designer frame stays scrollable
- the accepted designer mock pages keep their own crumbs/links
- `/tkmc` remains a real Mission Control home route
- the approved static `GatewayShell.jsx` is loaded by the designer Mission Control shell
- the Gateway rail entry uses the existing shell shape and Network icon
- the Gateway shell mounts `Agent Hub.html` and `Paperclip.html` as designer pages

## Files Changed

Source files already present in current lineage:

- `src/app/layout.tsx`
- `src/lib/mission-control-shell.test.ts`

No source changes were required in this current refresh.

Report files refreshed:

- `runtime/day-13-mission-control-shell-100-closure.md`
- `runtime/day-13-mission-control-shell-100-closure.pdf`

No designer tokens, designer mock HTML, Gateway FULL v3 class names, or accepted visual contract files were changed.

## Routes / UI Behavior

Expected behavior after the shell fix:

- Long pages can use native document scroll instead of being clipped by the root shell.
- Gateway FULL v3 mounted mock pages are no longer fighting an outer `h-screen overflow-hidden` root.
- Mission Control top-level navigation is provided by the existing left rail.
- Inside Gateway, `GatewayShell.jsx` provides its internal Gateway subrail.
- No custom nav chrome was injected into the mock pages.
- No fake buttons were added.

## Runtime Proof

Proof runtime:

- Base URL: `http://127.0.0.1:3337`
- Runtime PID: 71076
- Listener: `127.0.0.1:3337`
- Public exposure: none observed in listener check
- Current verification HEAD: `9094ef7`

Unauthenticated route smoke:

- `/login`: 200
- `/tkmc`: 307 to `/login`
- `/gateway`: 307 to `/login`
- `/gateway/agent-hub`: 307 to `/login`
- `/gateway/token-governor`: 307 to `/login`
- `/agents`: 307 to `/login`
- `/agent-network`: 307 to `/login`

Route rendering smoke:

- `node scripts/check-mission-control-route-rendering.mjs http://127.0.0.1:3337`
- ok: true
- routes checked: 46
- designer pages checked: 8
- failures: 0

Authenticated visual shell proof:

- Not performed because this runtime does not include an owner browser session.
- Remaining blocker: `owner_authenticated_visual_shell_retest_required`

## Tests And Checks

Fresh checks run on 2026-05-10:

- `pnpm test src/lib/mission-control-shell.test.ts`
  - 1 file passed
  - 4 tests passed
- `git diff --check`
  - passed
- `pnpm run typecheck`
  - passed
- `pnpm run build`
  - passed
- `pnpm test`
  - 171 files passed
  - 1359 tests passed
- `node scripts/check-protected-file-invariants.mjs`
  - ok: true
- `node scripts/check-mission-control-route-rendering.mjs http://127.0.0.1:3337`
  - ok: true
- `.env` diff check
  - 0 bytes

Auxiliary harness note:

- Some button/protected-action live-status scripts still need a later route-smoke harness update to pass the local smoke session cookie when probing protected authenticated APIs. They return 401 in this standalone runtime when run with only API-key context. This does not change the Day 13 shell result.

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No fake owner visual proof.
- No fake GO.
- No fake buttons added.
- No designer mock redesign.
- No Gateway FULL v3 token/class changes.
- No parked artifacts staged.
- Final proof runtime bound to `127.0.0.1` only.

## Remaining Blocker

Blocker: `owner_authenticated_visual_shell_retest_required`

Classification: OWNER_GATED

Owner retest needed:

- Log in to Mission Control.
- Open `/tkmc`.
- Open `/gateway`.
- Open `/gateway/agent-hub`.
- Confirm pages scroll naturally and are not clipped by the Mission Control shell.
- Confirm owner can move via the Mission Control rail and Gateway subrail without browser-back dependency.

## Closeout Ledger

- Day number and lane: Day 13 - Mission Control Shell
- Status: DEVELOPER-SIDE CLOSED
- Blocker classification: OWNER_GATED
- Source commit hash: `92c130b`
- Current verification HEAD: `9094ef7`
- Report refresh commit: pending
- Push result for source implementation: already pushed in current branch lineage
- Runtime proof: local-only standalone proof on `127.0.0.1:3337`, pid 71076
- Rollback command: `git revert 92c130b`
- Next day automatically started: Day 14 - Mission Control Navigation / Back 100% Closure
