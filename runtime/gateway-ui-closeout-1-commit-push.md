# Gateway UI Closeout 1 — Commit & Push
Date: 2026-05-08
Status: PASS

## Scope
- Fixed the Gateway FULL v3 scroll/navigation trap in:
  - `src/components/gateway/DesignerGatewayMockFrame.tsx`

## Root Cause Confirmed
- Prior mount behavior used fixed viewport clipping and iframe viewport lock patterns that caused trapped/static page behavior.
- This closeout patch converts the frame mount to:
  - same-origin iframe auto-height sync (document height-driven),
  - explicit top-level exits (`Mission Control Home`, `Gateway Overview`, `Agent Hub`),
  - no designer token/class rewrite.

## Verification Gates Run
1. `git diff --check` -> pass
2. `pnpm run typecheck` -> pass
3. `pnpm run build` -> pass
4. `pnpm test` -> pass (`138 files / 1251 tests`)
5. secret scan:
   - `node scripts/check-protected-file-invariants.mjs` -> pass
   - static token-pattern grep found only expected test fixtures in `src/lib/__tests__/scan-credentials.test.ts`
6. `.env diff check` -> clean (`git status --porcelain -- .env*` returned no changes)

## Safety Confirmation
- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.

## Commit / Push
- Commit: `fb7a480`
- Branch: `to-knowledge-mc`
- Remote: `origin/to-knowledge-mc`
- Push: completed (`origin/to-knowledge-mc` fast-forwarded to include `fb7a480` and follow-up docs record `8ab2df7`).

## Rollback
- `git revert fb7a480`
