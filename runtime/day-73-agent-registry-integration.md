# Day 73 - Agent Registry Integration

Status: DEVELOPER-SIDE CLOSED
Blocker class: NONE
Checked at: 2026-05-12T00:54:52Z
Branch: to-knowledge-mc
Base commit: ea6ed99

## Lane

Day 73 implemented one canonical agent registry for the Mission Control / Gateway agent ecosystem. The canonical roster is:

- Agent Zero
- Hermes
- Pi-mono
- SpaceAgent
- Paperclip
- OpenClaw+

Tony is not present as an active commander. Agent Zero is the commander. Pi remains advisory only. Paperclip stays before OpenClaw+ in the Agent Hub order.

## Implemented

- Added `src/lib/canonical-agent-registry.ts` as the single developer-side registry for the six core agents.
- Rewired Agent Hub payloads to use the canonical registry instead of a separate local hardcoded roster.
- Added canonical registry truth to Gateway status through the CloudCode backend-support integration layer.
- Added canonical registry truth to Pi dispatcher status.
- Added canonical registry truth to `/api/reports`.
- Fixed `/api/gateway/agent-hub/agents/[id]/health` so CloudCode health selects the requested agent row. The Pi route now selects `pi`, not the first row (`agent_zero`).

## Files Changed

- `src/lib/canonical-agent-registry.ts`
- `src/lib/canonical-agent-registry.test.ts`
- `src/lib/gateway-agent-hub.ts`
- `src/lib/gateway-agent-hub.test.ts`
- `src/lib/gateway-cloudcode-integration.ts`
- `src/lib/gateway-cloudcode-integration.test.ts`
- `src/lib/gateway-pi-dispatcher.ts`
- `src/lib/gateway-pi-dispatcher.test.ts`
- `src/app/api/gateway/agent-hub/agents/[id]/health/route.ts`
- `src/app/api/gateway/agent-hub/agents/[id]/health/route.test.ts`
- `src/app/api/reports/route.ts`

## Routes Changed

- `/api/gateway/status`
- `/api/gateway/agent-hub/status`
- `/api/gateway/agent-hub/registry`
- `/api/gateway/agent-hub/agents`
- `/api/gateway/agent-hub/agents/[id]/health`
- `/api/bridge/pi/status`
- `/api/reports`

## UI Behavior

No designer mock HTML, CSS, class names, or visual assets were changed. This work only changes the backend truth consumed by Mission Control / Gateway / Agent Hub surfaces.

Owner-facing impact:

- Agent Hub and Gateway status can render the same canonical agent roster.
- Agent Zero is consistently marked as commander.
- Pi is consistently marked as advisory-only, with execution and writes disabled.
- Paperclip remains ordered before OpenClaw+.
- The Pi health detail route no longer accidentally displays Agent Zero's CloudCode health row.
- No fake LIVE state was introduced.

## CloudCode Package

CloudCode backend-support was consumed through the existing backend support wrapper and `buildAgentHealth`.

Added Day 73 selector glue:

- `selectCloudCodeAgentHealthRows(agentHubAgentId, health)`
- `selectCloudCodeAgentHealth(agentHubAgentId, health)`

Reason: CloudCode returns health rows by backend health id. Agent Hub uses canonical ids such as `pi-mono`, so the route needs a canonical mapping layer.

## Runtime Proof

Local proof runtime:

- Base URL: `http://127.0.0.1:3337`
- Bind: `127.0.0.1`
- Restarted local standalone Mission Control for proof only.
- New PID: `92602`
- No public exposure added.
- No `.env` file was modified.
- No secrets were printed.

Sanitized authenticated API proof:

- `/api/gateway/status`: 200, canonical authority order present, Agent Zero commander, Tony absent.
- `/api/gateway/agent-hub/status`: 200, canonical Agent Hub order present.
- `/api/gateway/agent-hub/agents/pi-mono/health`: 200, CloudCode health id `pi`, not `agent_zero`; execution and writes disabled.
- `/api/bridge/pi/status`: 200, Pi advisory-only; execution and writes disabled.
- `/api/reports?limit=1`: 200, canonical registry present, Agent Zero commander, Tony absent.

Unauthenticated protected route smoke:

- Result: passed.
- Routes checked: 41.
- Protected pages checked: 20.
- Protected APIs checked: 17.
- Public routes checked: 4.

## Tests

Focused tests:

```text
pnpm exec vitest run src/lib/canonical-agent-registry.test.ts src/lib/gateway-cloudcode-integration.test.ts src/lib/gateway-agent-hub.test.ts src/lib/gateway-pi-dispatcher.test.ts 'src/app/api/gateway/agent-hub/agents/[id]/health/route.test.ts' --pool=threads --poolOptions.threads.singleThread=true --reporter=default
```

Result: 5 files / 24 tests passed.

Full validation:

```text
git diff --check
pnpm run typecheck
pnpm run build
pnpm test
```

Result: passed. Full test suite: 193 files / 1462 tests passed.

Security and safety:

```text
node scripts/check-protected-file-invariants.mjs
node scripts/secret-scan-contract.mjs
node scripts/raw-exposure-scan-contract.mjs
git status --short -- .env '.env*'
git diff -- .env '.env*'
```

Result: passed / clean.

## Blockers

No developer-side Day 73 blocker remains.

Owner visual confirmation is not claimed here because Day 73 is backend truth integration only. Gateway FULL v3 visual fidelity remains governed by the designer mock contract and owner retest lanes.

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No external writes.
- No Zapier writes.
- No SMB / Fork 2.
- No designer mock mutation.
- No fake GO / fake Done / fake 100%.

## Rollback

After commit:

```text
git revert <day_73_commit_sha>
```

## Next

Day 74 has automatically started: Agent Zero + Dispatcher Integration.
