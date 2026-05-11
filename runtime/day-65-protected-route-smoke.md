# Day 65 - Protected Route Smoke

Date: 2026-05-11
Lane: Runtime / deployment / security
Status: developer-side PASS
Blocker class: NONE for unauthenticated protected-route proof

## Objective

Prove that protected Mission Control, Gateway, Agent Hub, Bridge, runtime health, and connector routes do not render owner-facing production surfaces to unauthenticated requests.

## Scope

Added a reusable unauthenticated protected-route smoke contract and fixed Gateway compatibility route handling so it runs after session/proxy auth protection instead of using Next config redirects before the auth proxy.

## Root Cause

Gateway compatibility redirects in `next.config.js` ran before the auth proxy:

- `/gateway/agent-hub` redirected to `/gateway?tab=agent-hub`
- `/gateway/agent-hub/paperclip` redirected to `/gateway?tab=paperclip`
- `/gateway/bridge-session` redirected to `/gateway?tab=bridge`
- `/gateway/dispatcher` redirected to `/gateway?tab=dispatcher`
- `/gateway/token-governor` redirected to `/gateway?tab=governor`

Unauthenticated requests still ended at a protected Gateway surface, but the first hop was not the login gate. Day 65 treats that as a protection defect because owner-facing compatibility routes must not route internally before authentication.

## Files Changed

- `next.config.js`
- `src/proxy.ts`
- `src/proxy.test.ts`
- `src/lib/gateway-native-frame-decision.test.ts`
- `src/lib/protected-route-smoke-contract.test.ts`
- `scripts/protected-route-smoke-contract.mjs`
- `runtime/day-65-protected-route-smoke.json`
- `runtime/day-65-protected-route-smoke.md`
- `runtime/day-65-protected-route-smoke.pdf`

## Routes Changed

Gateway leaf compatibility redirects were moved from `next.config.js` into the auth proxy after session/proxy auth is accepted:

- `/gateway/routes` -> `/gateway?tab=routes`
- `/gateway/registry` -> `/gateway?tab=registry`
- `/gateway/policies` -> `/gateway?tab=policies`
- `/gateway/health` -> `/gateway?tab=health`
- `/gateway/dispatcher` -> `/gateway?tab=dispatcher`
- `/gateway/token-governor` -> `/gateway?tab=governor`
- `/gateway/agent-hub` -> `/gateway?tab=agent-hub`
- `/gateway/agent-hub/paperclip` -> `/gateway?tab=paperclip`
- `/gateway/agent-hub/*` -> `/gateway?tab=agent-hub`
- `/gateway/bridge-session` -> `/gateway?tab=bridge`
- `/gateway/node-detail` -> `/gateway?tab=node-detail`
- `/gateway/mobile-tablet` -> `/gateway?tab=mobile`

Unauthenticated requests to these routes now redirect to `/login` before any internal Gateway tab redirect.

## UI Behavior

No designer mock HTML, CSS, or class names were modified.

Authenticated Gateway compatibility routes still route into the single accepted Gateway shell and raw designer iframe assets. Unauthenticated owners/users get the login gate first.

## Live Smoke Proof

Command:

```bash
node scripts/protected-route-smoke-contract.mjs http://127.0.0.1:3337 > runtime/day-65-protected-route-smoke.json
```

Result summary:

- `ok: true`
- Routes checked: `40`
- Protected pages checked: `20`
- Protected APIs checked: `16`
- Public routes checked: `4`
- Failures: `0`

The smoke sends:

- no auth headers
- no cookies
- no API key
- no response bodies to the report artifact

## Tests / Checks

Fresh validation required before commit:

- `git diff --check`
- `pnpm test src/lib/protected-route-smoke-contract.test.ts src/proxy.test.ts src/lib/gateway-native-frame-decision.test.ts`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`
- `node scripts/check-protected-file-invariants.mjs`
- staged secret scan
- `.env` diff check

## Deploy / Restart / Smoke

Mission Control standalone was rebuilt and restarted locally on `127.0.0.1:3337`.

Runtime proof PID:

- Listener PID: `86339`

## Rollback

Use:

```bash
git revert <day-65-protected-route-smoke-commit-sha>
MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh
```

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No external writes.
- No fake route protection claim.
- No designer mock rewrites.

## Next Day

Day 66 starts automatically after commit and push: Authenticated Route Smoke 100% Closure.
