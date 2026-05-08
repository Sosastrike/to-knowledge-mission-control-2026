# Gateway FULL v3 Visibility — Route and Alias Smoke

## Goal
Verify Gateway FULL v3 routes and legacy aliases resolve safely under production protection behavior, and confirm alias contract coverage for authenticated flow.

## Result
PASS (protection behavior confirmed on production; alias contract verified by test).

## Unauthenticated Production Smoke
Base: `https://tkmc.knowledge-vs-ai.com`

Evidence file:
- `runtime/gateway-v3-visibility-route-alias-smoke.json`

Checked routes:
- `/gateway`
- `/gateway/routes`
- `/gateway/registry`
- `/gateway/policies`
- `/gateway/health`
- `/gateway/dispatcher`
- `/gateway/token-governor`
- `/gateway/agent-hub`
- `/agent-network`
- `/agents`
- `/gateway-parent`
- `/gateways`
- `/gateway-config`

Observed behavior:
- All routes returned `307` to `/login` for unauthenticated access.
- This matches expected protected-page policy (no public unauthenticated access).

## Alias Mapping Contract (Authenticated/Route-Logic Proof)
Because auth middleware redirects unauthenticated traffic before panel redirect logic runs, alias destination verification was proven via route contract tests:

- `pnpm vitest run src/app/gateway-route-alias.test.ts`
- Result: `6 passed`

Covered expectations:
- `gateway-parent` -> `/gateway/agent-hub`
- `gateways` -> `/gateway`
- `gateway-config` -> `/gateway/policies`
- `/agent-network` and `/agents` compatibility alias -> `/gateway/agent-hub`

Route implementation source confirms same mapping in `src/app/[[...panel]]/route.ts`.

## Safety Confirmation
- No `.env` changes
- No secret output
- No auth weakening
- No fake live claim

## Blockers
None for route-protection and alias-contract smoke.

## Next Step
Owner-authenticated visual confirmation of the Gateway FULL v3 interface remains required before marking owner visual proof GO.
