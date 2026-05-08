# NEXT-5 — Tony Active Deletion Progress

## Objective
Remove Tony from active system assumptions and active owner-facing/control surfaces.

## Result
PARTIAL (active-assumption removals started; full cross-surface cleanup still in progress).

## Inventory Snapshot (Active Code Surface)
Active Tony-linked references were found in:
1. Bridge live-check script assumptions (`scripts/check-bridge-capability-matrix-live.mjs`).
2. Bridge read-only MVP script assumptions (`scripts/check-bridge-readonly-mvp.mjs`).
3. Capability matrix owner-visible payload details in `src/app/api/bridge/capability-matrix/route.ts`.
4. Additional Tony mentions remain in tests and historical/runtime artifacts; these are being triaged by active runtime vs historical/test-only.

## Implementation Progress in This Phase
1. Removed active Tony requirement from Bridge live-check script.
2. Updated live-check required active agents to:
   - Agent Zero
   - Hermes
   - Pi
   - SpaceAgent
   - Paperclip
   - OpenClaw+ gateway layer
3. Removed Tony-specific preview assertion in Bridge read-only MVP script.
4. Expanded capability-matrix active agent payload to include Pi, SpaceAgent, and Paperclip explicitly.
5. Removed raw Tony home-path from Hermes provider-route display in capability matrix payload (`sandbox_home=hermes-sandbox`).

## Files Changed
- `scripts/check-bridge-capability-matrix-live.mjs`
- `scripts/check-bridge-readonly-mvp.mjs`
- `src/app/api/bridge/capability-matrix/route.ts`
- `runtime/next-tony-active-deletion-progress.md`
- `runtime/next-tony-active-deletion-progress.pdf`

## Remaining Work
1. Continue active runtime/controller cleanup for remaining Tony references in non-test code where still owner-visible or runtime-coupled.
2. Keep historical/audit records non-active and non-owner-loop.
3. Ensure current owner-facing active surfaces list only:
   - Agent Zero
   - Hermes
   - Pi
   - SpaceAgent
   - Paperclip
   - OpenClaw+

## Safety Confirmations
- No auth weakening.
- No `.env` changes.
- No secret printing.
- No unrelated data deletion.

## Next Step
Run focused validation for updated capability matrix + scripts, then continue phased Tony active-surface removal through remaining runtime paths.
