# Day 86 — Back / Home / Exit Acceptance

## Phase 0-20 Inventory

- Branch: `to-knowledge-mc`
- Latest commit at start: `8557ff6`
- `.env` changes: none requested, none made
- Secret risk: no secrets inspected or emitted
- Scope: Mission Control / Gateway browser Back, workspace Home, Gateway Overview, Agent Hub, and Paperclip exit behavior
- Design constraint: approved Gateway mock HTML/CSS/class names remain untouched

## Findings

- Gateway sub-tab changes updated the URL with `history.replaceState`, so browser Back could not replay `Overview -> Agent Hub -> Paperclip`.
- The workspace rail hard-reloaded `/gateway` for the Gateway entry instead of using the active Mission Control shell state.
- Workspace page changes updated React state but did not always create browser history entries, which made app Back/Home behavior fragile inside the designer shell.
- CloudCode route metadata still treated `/` as Mission Control Home even though the concrete Mission Control route is `/tkmc`.

## Implemented

- `GatewayShell.jsx` now uses `history.pushState` for real Gateway tab history and ignores same-tab clicks.
- `WorkspaceRail.jsx` now calls the Mission Control shell navigator for every rail item instead of hard-reloading Gateway.
- `app.jsx` now keeps workspace page changes in URL query state, removes stale `tab` values when leaving Gateway, handles `popstate`, and resets the Mission Control scroll surface on page changes.
- Settings/search page changes now use the same workspace navigator.
- CloudCode route metadata now includes `/tkmc` as the canonical Mission Control home and returns `/tkmc` for owner-facing home targets.
- API/navigation/status tests were updated to assert the `/tkmc` home target and Gateway/Paperclip safe-back behavior.

## Runtime Proof

- Local proof server: `http://127.0.0.1:3340` on loopback only; stopped after proof.
- Browser proof: `runtime/day-86-back-home-exit-acceptance/proof.json`
- Screenshot: `runtime/day-86-back-home-exit-acceptance/gateway-back-home-exit.png`
- Result:
  - Gateway Overview loaded in the Mission Control Gateway shell.
  - Agent Hub click loaded `/design/gateway/Agent Hub.html`.
  - Paperclip click loaded `/design/gateway/Paperclip.html`.
  - Browser Back returned from Paperclip to Agent Hub.
  - Browser Back returned from Agent Hub to Gateway Overview.
  - Mission Control rail click switched to `?page=mission`.
  - Gateway rail click switched back to `?page=gateway`.
  - Browser Back returned from Gateway to Mission Control.
  - Direct raw static check for `/design/gateway/Agent Hub.html` returned `200` and rendered the designer canvas/breadcrumbs/Agent Zero content.

## Route/Smoke Proof

- Protected route smoke: `runtime/day-86-back-home-exit-acceptance/protected-route-smoke.json`
  - `ok: true`
  - routes checked: `44`
  - failures: `[]`
- Authenticated route smoke harness: `runtime/day-86-back-home-exit-acceptance/authenticated-route-smoke.json`
  - `ok: true`
  - blocker class: `OWNER_GATED`
  - owner visual proof claimed: `false`
  - blocker: `owner_authenticated_browser_session_required`

## Validation

- `git diff --check` — PASS
- `.env` diff check — PASS, no output
- `pnpm run build` — PASS; regenerated stale Next type surface and copied static assets to standalone output
- `pnpm run typecheck` — PASS after build regenerated stale `.next/types`
- `pnpm test` — PASS, 202 files / 1500 tests
- `npm test` in `backend-support/` — PASS, 9 files / 106 tests
- `node scripts/check-protected-file-invariants.mjs` — PASS
- `node scripts/secret-scan-contract.mjs` — PASS
- `node scripts/raw-exposure-scan-contract.mjs` — PASS
- Unsupported command recorded: direct root Vitest filter for `backend-support/src/__tests__/route-metadata.test.ts` exits with no files by root config; backend package `npm test` covers it.

## Closure Ledger

- Lane: Back / Home / Exit acceptance
- Status: developer-side navigation/history proof complete; owner-auth production visual retest remains gated
- Blocker class: `OWNER_GATED`
- Files changed:
  - `public/designer-mission-control/src/app.jsx`
  - `public/designer-mission-control/src/gateway/GatewayShell.jsx`
  - `public/designer-mission-control/src/replicas/WorkspaceRail.jsx`
  - `backend-support/src/route-metadata.ts`
  - `backend-support/src/__tests__/route-metadata.test.ts`
  - `src/lib/gateway-cloudcode-integration.ts`
  - `src/lib/gateway-cloudcode-integration.test.ts`
  - `src/app/api/gateway/navigation/route.test.ts`
  - `src/app/api/gateway/status/route.test.ts`
  - `src/lib/mission-control-shell.test.ts`
  - `runtime/day-86-back-home-exit-acceptance.md`
  - `runtime/day-86-back-home-exit-acceptance/proof.json`
  - `runtime/day-86-back-home-exit-acceptance/protected-route-smoke.json`
  - `runtime/day-86-back-home-exit-acceptance/authenticated-route-smoke.json`
  - `runtime/day-86-back-home-exit-acceptance/gateway-back-home-exit.png`
- Routes/endpoints changed: no new Next route; `/api/gateway/navigation` and `/api/gateway/status` route metadata now report `/tkmc` as Mission Control Home.
- UI behavior: Gateway/Agent Hub/Paperclip remain raw approved designer files; shell history now supports browser Back, Mission Control Home exit, Gateway re-entry, and Paperclip/Agent Hub tab Back.
- Service/runtime behavior: no service behavior changed; local proof server started on loopback and stopped.
- Deploy/restart result: production restart not performed in this lane; build proof completed locally.
- Proof artifact: `runtime/day-86-back-home-exit-acceptance/proof.json`
- Remaining blocker: owner-authenticated production visual retest requires an owner browser session.
- Exact blocker classification: `OWNER_GATED`

## Rollback

```bash
git revert <day-86-commit>
```

## Next

- Automatically begin Day 87 after commit/push: Responsive Design.
