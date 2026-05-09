# Day 11 - Dispatcher Core 100% Closure

Date: 2026-05-09
Branch: to-knowledge-mc
Code commit: da4e212
Status: DEVELOPER-SIDE CLOSED
Blocker class: NONE for dispatcher core

## Lane

Day 11 closes the Dispatcher Core work package for canonical read-only routing/status truth across Agent Zero, Hermes, Pi, SpaceAgent, Paperclip, and OpenClaw+.

This does not mark every downstream agent GO. It proves the dispatcher/status surface reports current runtime truth consistently and keeps protected execution disabled unless Bridge Session scope exists.

## Implemented

- Added OpenClaw+ to the canonical Agent Hub agent roster.
- Kept Paperclip before OpenClaw+ in the owner-facing roster and route proof.
- Preserved Agent Zero as commander.
- Preserved Pi as Dispatcher / Route Optimizer Candidate in advisory shadow mode only.
- Preserved SpaceAgent as browser/web/YouTube/Firecrawl research specialist.
- Preserved Paperclip as Workforce Control Plane before OpenClaw+.
- Preserved OpenClaw+ as runtime / skills / mini-agent execution layer, with exact blocker:
  - openclaw_doctor_runtime_not_reachable
- Kept execution and writes disabled on Agent Hub and Pi dispatcher responses.
- Kept no fake live status: OpenClaw+ is visible but blocked until the doctor runtime is reachable.

## Files Changed

- src/lib/gateway-agent-hub.ts
- src/lib/gateway-agent-hub.test.ts

## Routes / Endpoints Affected

- GET /api/gateway/agent-hub/status
- GET /api/gateway/agent-hub/agents
- GET /api/gateway/agent-hub/agents/openclaw-plus
- GET /api/gateway/agent-hub/agents/OpenClaw+/health
- GET /api/bridge/pi/status
- POST /api/bridge/pi/status

No write or execution endpoint was enabled.

## UI Behavior

The Agent Hub status payload now has six active owner-facing agents:

1. Paperclip
2. Agent Zero
3. Hermes
4. SpaceAgent
5. Pi-mono
6. OpenClaw+

OpenClaw+ appears as blocked/service-down with the exact runtime doctor blocker. The UI can render the card honestly without pretending OpenClaw+ doctor execution is live.

## Service / Runtime Behavior

Controlled loopback proof was run against the built standalone app on 127.0.0.1:3337.

Authenticated smoke results:

- /api/gateway/agent-hub/status returned 200.
- agents_total returned 6.
- agent ids included paperclip, agent-zero, hermes, spaceagent, pi-mono, openclaw-plus.
- /api/gateway/agent-hub/agents/openclaw-plus returned 200.
- OpenClaw+ status returned blocked.
- OpenClaw+ blocked_reason returned openclaw_doctor_runtime_not_reachable.
- /api/bridge/pi/status returned 200.
- Pi runtime/skill recommendation selected openclaw_plus.
- Pi blocker returned openclaw_runtime_execution_requires_bridge_session.
- execution_enabled=false.
- writes_enabled=false.

Unauthenticated smoke:

- /api/gateway/agent-hub/status returned 401.

Deployment/restart:

- pnpm run deploy:standalone rebuilt commit da4e212.
- Deployed commit reported by script: da4e212.
- First detached child exited after startup, so the runtime was re-started using a detached local screen session on loopback only.
- Listener was confirmed on 127.0.0.1:3337.
- Runtime PID recorded in .next/standalone/server.pid: 29827.
- /login returned 200 after restart.
- No public bind was added.

## Tests Run

- pnpm test src/lib/gateway-agent-hub.test.ts src/lib/gateway-pi-dispatcher.test.ts
  - 2 files passed
  - 12 tests passed
- git diff --check
- pnpm run typecheck
- pnpm run build
- pnpm test
  - 142 files passed
  - 1272 tests passed
- node scripts/check-protected-file-invariants.mjs
  - ok: true
- node scripts/check-protected-actions-locked.mjs http://127.0.0.1:3337
  - ok: true
  - 11 probes checked

## Security / Safety

- No .env changes.
- No secret values printed.
- No auth weakening.
- No public local exposure.
- No raw local paths exposed in new payloads.
- No fake Done.
- No fake GO.
- No fake buttons added.
- No external writes enabled.
- No SMB/Fork 2.
- No Zapier writes.
- No HeyGen generation.
- No external farmers.

## Current Phase Matrix

| Day | Lane | Status | Blocker class | Code commit |
| --- | --- | --- | --- | --- |
| 1 | Agent Zero | Developer-side closed | CREDENTIAL_GATED | 0dd1eb8 |
| 2 | Hermes | Developer-side closed | SERVICE_DOWN | 5f04bd2 |
| 3 | Pi | Developer-side closed | NONE | ca84d50 |
| 4 | Paperclip | Developer-side closed | SERVICE_DOWN | bc1f9c1 |
| 5 | OpenClaw+ | Developer-side closed | SERVICE_DOWN | 61c5eda |
| 6 | SpaceAgent Playwright | Developer-side closed | SERVICE_DOWN | 576646c |
| 7 | SpaceAgent YouTube | Developer-side closed | SERVICE_DOWN | 9b6f321 |
| 8 | SpaceAgent Firecrawl | Developer-side closed | CREDENTIAL_GATED | 70b3bb1 |
| 9 | Telegram owner command | Developer-side closed | CREDENTIAL_GATED / OWNER_GATED | 77fd39a |
| 10 | Bridge approvals | Developer-side closed | SERVICE_DOWN for host systemctl dispatch | 3cd524e |
| 11 | Dispatcher Core | Developer-side closed | NONE | da4e212 |

## Remaining Downstream Blockers Carried Forward

- OpenClaw+ doctor runtime is not reachable until an approved CLI/runtime binary is installed or exposed to the Mission Control runtime service user.
- Paperclip sandbox service is still not proven running.
- Firecrawl remains credential/backend gated.
- YouTube transcript connector remains service/backend gated.
- Bridge live approved execution remains gated by owner approval/session and host service availability.
- Owner visual confirmation for Gateway FULL v3 remains separate and not marked GO by this report.

## Rollback

Rollback command:

```bash
git revert da4e212
```

If the loopback standalone runtime needs to be stopped:

```bash
screen -S mc-day11-dispatcher -X quit
```

## Push Result

Pushed to origin/to-knowledge-mc:

- da4e212 feat(dispatcher): expose openclaw in agent hub truth

## Next Day Started

Day 12 - Token Governor 100% Closure is now the active next work package.
