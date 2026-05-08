# NEXT-6 — Validation and Push

## Objective
Validate the NEXT implementation batch and ship isolated commits without `.env` changes, secret leaks, fake completion claims, or auth weakening.

## Result
PASS with explicit live blockers still open.

## Validation Commands
1. `git diff --check` — PASS
2. `pnpm run typecheck` — PASS (after rebuild regenerated `.next/types`)
3. `pnpm run build` — PASS
4. `pnpm test -- src/lib/paperclip-bridge.test.ts` — PASS
5. `pnpm test -- src/lib/__tests__/scan-credentials.test.ts` — PASS (`138 files / 1251 tests`)
6. `node scripts/check-button-contract-routes.mjs` — PASS
7. `node scripts/check-protected-file-invariants.mjs` — PASS
8. `.env diff check` (`git diff -- .env .env.local .env.production`) — clean

## Route Smoke
- Added artifact: `runtime/next-route-smoke-auth-unauth.json`
- Production page protection check:
  - `/gateway`, `/gateway/agent-hub`, `/agent-network`, `/agents` returned `/login` redirects when unauthenticated.
- API smoke with locally read API key against Tailnet runtime returned `401` for both authenticated and unauthenticated checks.
- Exact blocker: `mission_control_api_key_not_seeded` (local runtime DB key does not match active production runtime key context).

## Commits
1. `ce943fb` — `feat(bridge): update capability matrix and delivery status contracts`
2. `f3cfac5` — `fix(gateway): keep exits visible and remove agent-hub scroll trap`
3. `cd81578` — `fix(paperclip): add tailnet fallback candidate for bridge health`

## Push
- Branch: `to-knowledge-mc`
- Remote push: PASS (`9f95d09..cd81578`)

## Rollback
1. `git revert cd81578`
2. `git revert f3cfac5`
3. `git revert ce943fb`
4. `git push origin to-knowledge-mc`

## Safety Confirmations
- No `.env` edits.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No fake send/upload claims.
- No fake GO/Done claims.

## Current Honest Blockers
- `owner_approval_pending`
- `active_bridge_session_required`
- `paperclip_owner_session_required`
- `mission_control_api_key_not_seeded`
- `firecrawl_credential_required`
- `firecrawl_backend_adapter_not_configured`
- `youtube_transcript_connector_not_proven`
- `google_drive_upload_connector_not_configured`
- `onedrive_upload_connector_not_configured`

## Next Step
Owner approval/session lane: approve one scoped Bridge action, then rerun live execution proof and Telegram/Paperclip delivery proofs against the now-shipped code.
