# Tony Delete Phase 4 - Voice Routing Removal

## Objective
Remove Tony as default runtime/voice identity and enforce Agent Zero as active runtime identity.

## Status
PASS (code-level runtime identity migration complete).

## Actions Executed
- Updated runtime service identity fallback mapping:
  - `claudeclaw.service` now resolves to `agent_zero` (not `tony`).
- Updated process-scan fallback name from `tony` to `agent_zero`.
- Updated service unit reverse mapping for fallback status rendering.

## Files Changed
- `src/lib/claudeclaw-runtime-status.ts`

## Proof
- Runtime identity normalization no longer assigns `tony` as default active unit identity.
- Active fallback identity is now Agent Zero.

## Blockers
- External provider display metadata may still require owner-side rename:
  - `owner_BotFather_rename_required` (if applicable to UI branding)

## Tests
- Full suite passed after change (`138` files / `1250` tests).

## Services / Commits / Rollback
- Service restart deferred to deploy phase.
- Commit pending final phase.

## No-Secrets Confirmation
- No provider keys printed.
- No `.env` changes.
- No auth weakening.

## Updated Percentage
- Tony deletion lane: 62% -> 70%.

## Exact Next Step
- Migrate remaining Tony-branded controller/report contracts to Agent Zero/Gateway-neutral naming.
