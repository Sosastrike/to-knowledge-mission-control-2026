# Tony Delete Phase 3 - Telegram Routing Removal

## Objective
Ensure owner Telegram routing is Agent Zero only and Tony is not an active route target.

## Status
PARTIAL PASS.

## Actions Executed
- Verified active Telegram bridge routes are under Agent Zero namespace:
  - `/api/bridge/agent-zero/telegram/status`
  - `/api/bridge/agent-zero/telegram/upload-report`
- Confirmed no Tony route handlers were added in this execution batch.
- Preserved Bridge Session gating and no-fake-send policy.

## Files Inspected
- `src/app/api/bridge/agent-zero/telegram/status/route.ts`
- `src/app/api/bridge/agent-zero/telegram/upload-report/route.ts`
- `src/app/api/bridge/providers/route.ts` (Tony provider suppression)

## Proof
- Telegram API route ownership is Agent Zero.
- No Tony active route target returned from modified provider/capability runtime outputs.

## Blockers
- Live owner-channel Telegram send proof remains gated:
  - `active_bridge_session_required`
  - `owner_approval_pending`
- Bot display-name rename remains owner-side if still branded:
  - `owner_BotFather_rename_required`

## Tests
- Existing Telegram adapter tests remain green in full run.

## Services / Commits / Rollback
- No service restart in this phase.
- Commit pending final phase.

## No-Secrets Confirmation
- No bot token printed.
- No auth files printed.
- No `.env` changes.

## Updated Percentage
- Tony deletion lane: 55% -> 62%.

## Exact Next Step
- Complete voice/runtime identity removal and controller renaming.
