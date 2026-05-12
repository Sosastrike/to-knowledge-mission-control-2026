# Day 85 — Mission Control Movement

## Phase 0-20 Inventory

- Branch: `to-knowledge-mc`
- Latest commit at start: `2fd9a36`
- `.env` changes: none requested, none made
- Secret risk: no secrets inspected or emitted
- Scope: Mission Control/Gateway movement and scroll ownership only

## Findings

- The approved Gateway mock pages are served raw from `/design/gateway/*.html`.
- `GatewayShell.jsx` mounted those raw pages in an iframe, but the shell and iframe were both pinned to `100vh`.
- That made Gateway sub-tabs feel static/trapped because iframe height owned movement instead of the Mission Control main surface.
- The Day 85 fix must stay outside the approved mock HTML/CSS/class names.

## Planned Fix

- Keep the designer mock pages raw and unchanged.
- Auto-size the same-origin iframe from its rendered document height.
- Disable iframe scrollbars and let Mission Control's `.main-solo` surface own page movement.
- Reset the Mission Control scroll position when switching Gateway sub-tabs.
- Add tests and runtime proof for iframe sizing and scroll ownership.

## Implemented

- Updated `public/designer-mission-control/src/gateway/GatewayShell.jsx` only.
- Did not modify approved mock HTML, CSS, or class names.
- Replaced the fixed `height: 100%; min-height: 100vh` shell/frame trap with shell-level iframe auto-sizing.
- The iframe now:
  - loads the same raw `/design/gateway/*.html` assets,
  - uses `scrolling="no"`,
  - sizes to stable designer content,
  - keeps the Gateway sub-rail sticky,
  - lets Mission Control `.main-solo` own movement.
- Added a regression test in `src/lib/mission-control-shell.test.ts` that rejects the old `100vh` trap and verifies the shell owns iframe sizing.

## Runtime Proof

- Local proof server: `http://127.0.0.1:3339` on loopback only; stopped after proof.
- Browser proof: `runtime/day-85-mission-control-movement/proof.json`
- Screenshot: `runtime/day-85-mission-control-movement/gateway-agent-hub-movement.png`
- Result:
  - page status: `200`
  - iframe source: `/design/gateway/Agent Hub.html`
  - iframe title: `Gateway · Agent Hub`
  - iframe `scrolling`: `no`
  - stable content height: `1813`
  - iframe client height: `1813`
  - Mission Control `.main-solo` scroll height/client height: `1915 / 713`
  - scroll proof: `.main-solo.scrollTop` changed from `0` to `520`
  - raw mock rendered: `true`
  - frame fits stable content: `true`

## Route/Smoke Proof

- Protected route smoke: `runtime/day-85-mission-control-movement/protected-route-smoke.json`
  - `ok: true`
  - routes checked: `44`
  - failures: `[]`
- Authenticated route smoke harness: `runtime/day-85-mission-control-movement/authenticated-route-smoke.json`
  - `ok: true`
  - blocker class: `OWNER_GATED`
  - owner visual proof claimed: `false`
  - blocker: `owner_authenticated_browser_session_required`

## Closure Ledger

- Lane: Mission Control movement
- Status: developer-side movement fix complete; owner-auth production visual retest remains gated
- Blocker class: `OWNER_GATED`
- Files changed:
  - `public/designer-mission-control/src/gateway/GatewayShell.jsx`
  - `src/lib/mission-control-shell.test.ts`
  - `runtime/day-85-mission-control-movement.md`
  - `runtime/day-85-mission-control-movement/proof.json`
  - `runtime/day-85-mission-control-movement/protected-route-smoke.json`
  - `runtime/day-85-mission-control-movement/authenticated-route-smoke.json`
  - `runtime/day-85-mission-control-movement/gateway-agent-hub-movement.png`
- Routes/endpoints changed: none
- UI behavior: Gateway mock remains raw/unchanged; Mission Control owns page movement; Gateway iframe no longer traps vertical scroll.
- Service/runtime behavior: no service behavior changed; proof server started on loopback and stopped.
- Deploy/restart result: no production restart performed in this lane.
- Proof artifact: `runtime/day-85-mission-control-movement/proof.json`
- Remaining blocker: owner-authenticated production visual retest requires an owner browser session.
- Exact blocker classification: `OWNER_GATED`

## Rollback

```bash
git revert <day-85-commit>
```

## Next

- Automatically begin Day 86 after commit/push: Back / Home / Exit acceptance.
