# OpenClaw+ Naming Correction Report

Generated: 2026-05-07T21:06:55+00:00

## Executive Summary

Owner correction accepted and applied: OpenClaw+ is the runtime / skills / adapters / reports / governance / agent execution layer. Paperclip remains the workforce / task / co-worker orchestration layer before OpenClaw+. Build-Wiki / Farmer is treated as a scoped worker/docs sync service under OpenClaw+.

The active Gateway model no longer creates an OpenCloud architecture node. Remaining `opencloud-docs-farmer.*` strings are legacy systemd unit names only and are preserved intentionally.

## What Changed

- Removed OpenCloud from the canonical Gateway hierarchy, Agent Hub runtime node list, Gateway role matrix, Gateway node kinds, docs coverage, mini-agent gauntlet policy, and Paperclip adapter naming.
- Promoted OpenClaw+ / ClaudeClaw to the runtime engine node type in Gateway.
- Replaced owner-facing runtime wording with OpenClaw+ / Build-Wiki / Farmer language.
- Preserved the literal legacy units `opencloud-docs-farmer.service` and `opencloud-docs-farmer.timer` for command/status reporting only.
- Updated Gateway registry status from `buildwiki_opencloud` to `buildwiki_openclaw`.
- Updated Paperclip adapter naming from OpenCloud worker adapter to OpenClaw+ runtime adapter.

## Files Updated

- `src/lib/agent-network-hierarchy.ts`
- `src/lib/gateway-model.ts`
- `src/lib/gateway-registry-api.ts`
- `src/lib/gateway-agent-hub.ts`
- `src/lib/gateway-data-layer.ts`
- `src/lib/gateway-docs.ts`
- `src/lib/gateway-mini-agent-os.ts`
- `src/lib/gateway-mini-agent-gauntlet.ts`
- `src/lib/hermes-visibility.ts`
- `src/lib/paperclip-bridge.ts`
- `src/lib/agent-zero-execution-gateway.ts`
- `public/designer-mission-control/src/replicas/BuildWikiFarmerSyncPanel.jsx`
- Related tests for Gateway, Agent Hub, Hermes, Paperclip, mini-agents, and operator contracts.

## Validation

- `pnpm run typecheck`: PASS
- Focused Vitest suite: PASS, 11 files, 98 tests
- No external writes executed
- No SMB/Fork 2 action
- No farmer execution
- No `.env` modification
- No secrets printed or added

## Remaining Legacy References

The only intentional legacy references are exact service/path names that currently exist in the running system, including `opencloud-docs-farmer.service`, `opencloud-docs-farmer.timer`, and the existing Build-Wiki storage subtree. These are not modeled as an OpenCloud architecture layer.

## Final Naming Rule

Owner-facing architecture, reports, UI labels, Gateway nodes, and future implementation plans must use OpenClaw+ / Build-Wiki / Farmer, not OpenCloud, unless a separate real OpenCloud product/service is later proven.
