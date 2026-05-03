# Agent Zero Hierarchy Cutover Report

Generated: 2026-05-03 21:25:44 UTC

## Decision

Status: **PARTIAL GO**.

The Mission Control source and freshly built standalone bundle now agree on the new hierarchy: Agent Zero is commander, Hermes is lieutenant/read-only pending full proof, and Tony is removed from default active provider and capability surfaces. Production `mission-control.service` is still running the older in-memory bundle until an admin-authorized restart is performed, so production UI parity remains blocked by restart authorization.

## Agent Network Before / After

Before:
- Tony appeared as an active commander in the designer Agent Network seed data.
- Agent Zero was shown beside or under Tony as supervisor/reviewer.
- Hermes was shown as a specialist/sandbox node.
- Some active labels still referenced old Tony approval and owner-routing text.

After in source and fresh standalone build:
- Agent Zero is injected as the canonical Commander row.
- Hermes is injected as the Lieutenant row with skill/workflow specialist role.
- Tony Legacy is hidden from default active provider output and retained only as archived rollback/audit metadata.
- Provider registry defaults no longer include Tony/Tony Legacy unless `include_legacy=1` is explicitly requested.
- Capability matrix active agents now list Agent Zero, Hermes, and OpenClaw Gateway; Tony Legacy moved to `retired_agents` with `visible_by_default: false`.

## Brain Sync Before / After

Before:
- Brain Sync centered Tony as the primary hub.
- Agent 0/Agent Zero was described as subordinate to Tony.
- Brain Sync read-only banners referenced Tony to Telegram approvals.

After in source/static bundle:
- Agent Zero is the central brain nucleus and primary operator.
- Hermes is the secondary lieutenant hub.
- Brain Sync is a knowledge-system hub for Obsidian, MemPalace, Graphify, and Build-Wiki.
- Approval language now points to Agent Zero Bridge Session approval.
- The live Brain Sync status route uses `agent_id=agent_zero` for shared brain context.

## Hermes Discovery

Observed:
- `/home/tony/sandbox/hermes-agent-20260428` exists.
- `/home/tony/sandbox/hermes-home-20260428` exists.
- `hermes-gateway.service` is active under the user service manager.
- Hermes process is running from the Hermes virtualenv.

Status:
- Hermes is now modeled as Agent Zero's lieutenant.
- Hermes is **not** marked production-execution active.
- Mission Control route `/api/bridge/hermes/status` reports read-only lieutenant behavior and Bridge Session requirement.
- The route now checks both the legacy PID method and `systemctl --user is-active hermes-gateway.service` so a running systemd Hermes gateway is not misreported as false.

## Agent Zero Live Query

- Agent Zero container-side bridge tool can live-query Mission Control production routes.
- Current production bundle remains stale until service restart.
- Agent Zero conversational chat remains blocked by the Agent Zero model backend credential: `Codex/ChatGPT account access token not found`.
- No full commander claim is made until production restart and live owner tests pass.

## Files Changed

Key source areas:
- `src/components/agent-network/AgentNetworkClient.tsx`
- `src/app/api/bridge/providers/route.ts`
- `src/app/api/bridge/capability-matrix/route.ts`
- `src/app/api/bridge/hermes/status/route.ts`
- `src/app/api/bridge/brain-sync/status/route.ts`
- `src/lib/agent-zero-bridge.ts`
- `src/lib/agent-zero-ecosystem-context.ts`
- `src/lib/migrations.ts`
- `public/designer-mission-control/src/agent-network/*`
- `public/designer-mission-control/src/replicas/BrainSyncPage.jsx`
- `public/designer-mission-control/src/replicas/ExecutiveReportsPage.jsx`
- `public/designer-mission-control/src/ui.jsx`
- supporting designer settings/governance/credentials/ops labels

## Validation

Passed before report generation:
- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`: 94 test files, 993 tests passed
- Agent Zero full ecosystem gauntlet: 10,000 deterministic scenarios, 0 failures
- Fresh standalone route smoke on temporary port:
  - `/api/bridge/providers?agent_zero_chat=0`: no Tony provider by default; Agent Zero active, Hermes sandbox/read-only.
  - `/api/bridge/providers?agent_zero_chat=0&include_legacy=1`: archived Tony Legacy available only when explicitly requested.
  - `/api/bridge/capability-matrix`: Agent Zero active commander, Hermes lieutenant, Tony Legacy only in `retired_agents`.
  - `/api/bridge/hermes/status`: Hermes lieutenant/read-only route responds.
  - `/api/bridge/brain-sync/status`: `agent_zero_brain` source uses `agent_id=agent_zero`.
  - unauthenticated `/api/bridge/providers`: HTTP 401.

## Service Status

- `mission-control.service`: active, but production bundle still needs admin restart to load this commit.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.
- `agent-zero` Docker container: running.
- `hermes-gateway.service`: active.

## Secrets

No `.env` file was modified. No secrets or API keys were printed, committed, or exposed in UI/report content. Legacy environment variable names may still exist internally where required for backward-compatible credential detection, but no secret values are exposed.

## Remaining Blockers

- Admin-authorized restart of `mission-control.service` is still required before production UI reflects the new hierarchy.
- Agent Zero conversational command path is blocked by the Agent Zero model backend credential.
- Hermes live chat/API and production Bridge Session execution are not proven yet, so Hermes remains lieutenant/read-only/degraded rather than active execution.
- OpenCloud must not be destroyed; replacement/dependency proof is not complete.

## Rollback

After commit, rollback with:

```bash
git revert <commit_hash>
git push
```

If production is restarted after this commit and rollback is needed, restart `mission-control.service` again after reverting so the service reloads the reverted bundle.
