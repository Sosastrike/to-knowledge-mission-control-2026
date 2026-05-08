# Tony Delete Phase 1 - Active Inventory

## Objective
Inventory every active Tony reference and classify each as delete, migrate, rename, or historical-only.

## Status
PASS (inventory complete).

## Actions Executed
- Searched runtime/UI/API/controller/test surfaces for `tony`, `tony_legacy`, `tony_v2`.
- Split findings into:
  - active runtime reference,
  - owner-facing label,
  - compatibility/historical-only,
  - test fixture.

## Active References Identified (actioned in next phases)
| Area | Example Locations | Classification | Required Action |
|---|---|---|---|
| Gateway role matrix and nodes | `src/lib/gateway-model.ts` | active runtime + owner-facing | delete active Tony node |
| Agent Hub owner text | `src/components/gateway-agent-hub/AgentHubControlCenter.tsx` | owner-facing label | remove Tony text |
| Legacy provider projection | `src/app/api/bridge/providers/route.ts` | active route logic | remove Tony provider output |
| Capability matrix retired agent section | `src/app/api/bridge/capability-matrix/route.ts` | owner-facing status surface | remove Tony from current-state payload |
| Agent Zero/Hermes response contracts | `src/lib/agent-zero-bridge.ts`, `src/lib/hermes-bridge.ts` | owner-facing controller language | migrate wording to "not part of active system" |
| Report contract naming/aliases | `src/lib/executive-reports.ts`, `src/app/api/reports/route.ts` | active report pipeline | migrate to neutral naming |
| Runtime identity fallback | `src/lib/claudeclaw-runtime-status.ts` | active runtime identity | switch default runtime identity to Agent Zero |

## Historical/Non-Active References
- Legacy historical records remain in older runtime artifacts and test prompts.
- These are not active route targets after this deletion batch.

## Commands
- `rg -n "tony|Tony|tony_legacy|tony_v2" src/app src/lib src/components`
- `rg -n "tony|Tony|tony_legacy|tony_v2" public/designer-mission-control/src public/designer-mission-control/design/gateway`

## Proof
- Inventory mapped to concrete edit targets completed.

## Blockers
- None for inventory.

## Tests
- Not applicable in this phase.

## Services / Commits / Rollback
- No service changes in this phase.
- Commit pending later phases.

## No-Secrets Confirmation
- No secret values printed.
- No auth files printed.
- No `.env` changes.

## Updated Percentage
- Tony deletion lane: 20% -> 35% (inventory complete, implementation started).

## Exact Next Step
- Execute active runtime removal from Gateway/Mission Control surfaces.
