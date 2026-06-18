# Agent Platform Recovery Implementation Report - Batch 1

Generated: 2026-06-18T17:40:29.161237

## Scope Completed

- Added protected recovery diagnostics under `/api/platform/recovery/*`.
- Added provider error taxonomy for non-retryable Anthropic usage/billing HTTP 400 and OpenRouter invalid request HTTP 400.
- Added read-only model capability registry contract for configured providers and account-backed routes.
- Added durable job contract visibility and current task-table storage summary.
- Added context/checkpoint contract visibility for model portability and compaction prevention.
- Added regression tests proving the new contracts do not enable execution or leak secrets.

## Confirmed Live Baseline Before Changes

- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `openclaw-gateway.service`: active.
- `https://tkmc.knowledge-vs-ai.com/login`: HTTP 200.
- `https://gw.knowledge-vs-ai.com/`: HTTP 200.
- `http://100.116.35.95:50080/`: HTTP 200 for Agent Zero container.
- Mission Control dirty tree was large before this batch, so only files in this recovery batch were staged.

## New Endpoints

- `GET /api/platform/recovery/baseline`
- `GET /api/platform/recovery/model-capabilities`
- `GET /api/platform/recovery/jobs`
- `GET /api/platform/recovery/context`

All endpoints are viewer-protected and return `Cache-Control: no-store`.

## Safety Invariants

- `.env` was not modified.
- No secrets were printed or added to API responses.
- Provider execution remains disabled.
- Zapier writes remain disabled.
- Connector execution remains disabled.
- Build-Wiki scope remains `opencloud-docs-farmer.service`.
- No DB migration was applied.
- No Cloudflare, Caddy, firewall, Docker, Tony voice, Tony routing, Tony memory, or governance changes were made.

## Tests Run

- `pnpm exec vitest run src/lib/agent-platform-recovery.test.ts --reporter=dot`: passed, 5 tests.
- `pnpm exec tsc --noEmit --pretty false`: passed.
- `pnpm run build`: passed and generated the new `/api/platform/recovery/*` routes.
- `sudo -n systemctl restart mission-control.service`: completed; service active.
- Public login smoke: `https://tkmc.knowledge-vs-ai.com/login` returned HTTP 200 after restart.
- Unauthenticated recovery endpoints returned HTTP 401.
- Authenticated local recovery endpoint smoke returned HTTP 200 for baseline, model-capabilities, jobs, and context.

## Sofia / Agent Hub Routing Fix

- Registered Sofia in the canonical Agent Routing Lines registry as a direct, read-only/supporting deputy dispatcher line.
- Sofia remains subordinate to Ron Weasley and Agent Zero/Jarvis for production actions.
- `opencloud_allowed_role` and `openclaw_allowed_role` are both `supporting_tool_only`.
- Sofia route trace now resolves to `owner -> mission-control -> nuclear-gateway -> sofia` for direct-line proof.
- No production execution was enabled; Sofia production execution remains blocked by Ron + Jarvis concurrence.

## Final Verification Added

- `pnpm exec vitest run src/lib/sofia-deputy-dispatcher.test.ts --reporter=dot`: passed, 3 tests.
- `pnpm exec vitest run src/lib/agent-platform-recovery.test.ts src/lib/gateway-model-provider-probes.test.ts src/lib/gateway-agent-hub.test.ts src/lib/sofia-deputy-dispatcher.test.ts --reporter=dot`: passed, 19 tests.
- `pnpm exec tsc --noEmit --pretty false`: passed.
- `pnpm run build`: passed; standalone static sync completed.

## Activation And Smoke Verification

- `sudo -n systemctl restart mission-control.service`: completed; `mission-control.service` active.
- Local login smoke: `http://127.0.0.1:3337/login` returned HTTP 200.
- Public login smoke: `https://tkmc.knowledge-vs-ai.com/login` returned HTTP 200.
- Unauthenticated protected route smoke: Agent Hub and recovery baseline returned HTTP 401.
- Authenticated local smoke returned HTTP 200 for:
  - `/api/platform/recovery/baseline`
  - `/api/platform/recovery/model-capabilities`
  - `/api/platform/recovery/jobs`
  - `/api/platform/recovery/context`
  - `/api/gateway/agent-hub/status`
  - `/api/bridge/sofia/status`

## Remaining Work

- Wire recovery diagnostics into the Gateway operator UI.
- Add mocked provider adapter tests for each provider request mode.
- Add durable worker/job persistence before calling long-running tasks true background work.
- Add browser E2E for Agent Hub → Agent Zero → Open UI → Sofia status/session.
- Add live canaries only where existing credentials and cost policy allow.
