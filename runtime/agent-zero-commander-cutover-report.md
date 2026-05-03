# Agent Zero Commander Cutover Report

Generated: 2026-05-03 21:02:04 UTC

## Decision

Status: **PARTIAL GO**.

Agent Zero can now live-query Mission Control through a container-side bridge tool using a scoped Mission Control API key stored outside git. Production Mission Control still needs an admin-authorized `mission-control.service` restart before the newest commander UI/routes are live. Until that restart, production routes still expose stale Tony-active registry data, and Agent Zero correctly reports that as blocked/stale instead of treating it as truth.

## What changed

- Created a scoped Mission Control API key for Agent Zero in the Mission Control database.
- Stored the raw key only in safe secret paths outside git:
  - host secret: `/home/tony/.config/mission-control/secrets/agent-zero-mission-control-api-key`
  - Agent Zero container secret: `/a0/secrets/mission-control-api-key`
- Renamed/promoted the Mission Control DB agent record from `Agent 0` to `Agent Zero` with role `commander`.
- Marked the Mission Control DB `Tony` row hidden/offline as `legacy-tony`.
- Added Agent Zero container tool: `/a0/agents/agent0/tools/mission_control_bridge.py`.
- Updated Agent Zero container prompts so he identifies as Agent Zero commander, treats Tony as retired, uses live Mission Control routes, and reports stale production state as blocked.
- Updated Mission Control source so owner-facing commander surfaces show Agent Zero and treat Tony as `Tony Legacy`/retired.
- Updated approval/report/Brain/Build-Wiki copy away from active Tony wording.
- Updated new report ownership defaults to Agent Zero / Tony Legacy where appropriate.

## Live validation

Agent Zero container bridge tool successfully queried production Mission Control routes:

- `providers`: HTTP 200, `live_query: true`, 9 providers visible.
- `mcp_list`: HTTP 200, live MCP summary visible.
- `status`: HTTP 200, live Agent Zero status route visible.

Agent Zero direct chat/API validation:

- Direct Agent Zero chat endpoint is reachable and accepts the external API key.
- Current result: HTTP 500 from the Agent Zero model backend: `Codex/ChatGPT account access token not found`.
- Meaning: the container-side live bridge tool works, but Agent Zero cannot yet act as the conversational commander through its LLM runtime until that model/account credential is configured.
- Raw local path leak: none detected in the failed response.
- Secret/key exposure: none detected.

Latest build local route smoke after source updates:

- `/api/bridge/agent-zero/status`: Agent Zero role `ecosystem commander`.
- `/api/bridge/providers`: `agent_zero=active`, `tony_legacy=retired`.
- `/api/bridge/capability-matrix`: Agent Zero active commander; Tony Legacy disabled.
- `/api/bridge/brain-context`: default `agent_id=agent_zero`.

## Production blocker

`mission-control.service` restart is blocked by admin authorization:

- `sudo -n systemctl restart mission-control.service` -> password required.
- `systemctl restart mission-control.service` -> interactive authentication required.

Because production was not restarted, the public production service still serves an older bundle. Agent Zero can live-query that production service, but some routes are stale until the service is restarted.

## Services

- `mission-control.service`: active, but still on older in-memory bundle until admin restart.
- `claudeclaw.service`: active at baseline.
- `opencloud-docs-farmer.timer`: active at baseline.
- `agent-zero` container: running, health endpoint returns HTTP 200, version M v1.12.

## Tests

Passed:

- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test` — 94 files, 993 tests passed.
- Agent Zero full ecosystem gauntlet — 10,000 scenarios, 0 failures.
- Container tool live route smoke.
- Latest-build local Mission Control route smoke.

Skipped/blockers:

- Production reload validation skipped because admin restart is blocked.
- Full owner UI live cutover skipped until production service loads the new bundle.
- No OpenCloud destruction; dependency replacement is not proven enough for decommission.

## Secrets

No secrets were printed in logs or written to git. Status reports only expose boolean/configured state and never key values.

## Read-only vs execution

Agent Zero currently has live read/query capability through the container bridge tool. Conversational execution is blocked by the Agent Zero model backend credential. Bridge Session execution exists in source, but production still needs restart and owner session approval before Agent Zero is considered execution-active. No Zapier writes, HeyGen generation, SMB mount, external farmer run, Docker socket access, raw shell execution, or OpenCloud destruction occurred.

## Go/No-Go

- Agent Zero live-query through container: **GO**.
- Agent Zero conversational commander through API: **BLOCKED**, because Agent Zero's model backend reports `Codex/ChatGPT account access token not found`.
- Agent Zero full commander in production: **PARTIAL GO**, blocked by admin restart and the Agent Zero chat backend credential.
- Tony fully removed from live production owner surfaces: **not yet**, because production still serves stale bundle.
- OpenCloud safe destruction: **NO-GO** until replacement/dependency proof is complete and owner approves decommission.

## Next actions

1. Admin-authorize restart of `mission-control.service`.
2. Re-run production `/api/bridge/agent-zero/status`, `/api/bridge/providers`, `/api/bridge/capability-matrix`, `/api/bridge/agent-zero/ecosystem`.
3. Re-run Agent Zero owner UI tests.
4. Open an Agent Zero Bridge Session only after production reload is confirmed.
5. Keep Tony/ClaudeClaw code archived for rollback until dependency mapping is complete.
