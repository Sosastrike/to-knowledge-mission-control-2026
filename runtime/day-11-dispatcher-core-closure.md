# Day 11 - Dispatcher Core 100% Closure

Date: 2026-05-10
Lane: Dispatcher Core / Canonical Agent Hub Truth
Status: DEVELOPER-SIDE CLOSED
Blocker classification: OWNER_GATED / CREDENTIAL_GATED / SERVICE_DOWN lanes remain truthful; Day 11 core dispatcher work has no developer-side blocker.

## Objective

Make Mission Control / Gateway / Agent Hub use one owner-safe dispatcher truth source for the core agents:

- Agent Zero
- Hermes
- Pi
- Paperclip
- SpaceAgent
- OpenClaw+

Day 11 specifically fixes stale Agent Hub truth that made some blocked lanes look READY or partially live.

## What Changed

The Agent Hub status payload no longer reports stale production truth:

- Agent Zero is now `CREDENTIAL_GATED` until the approved Agent Zero external API key is available.
- Hermes is now service-down for standalone runtime, while preserving the earlier safe adapter proof.
- Paperclip is now service-down until the sandbox/local or Tailnet-only runtime is running.
- SpaceAgent is split honestly:
  - Playwright MCP: `SERVICE_DOWN`
  - YouTube research: `READ_ONLY`
  - Firecrawl: `CREDENTIAL_GATED`
- Pi remains `READ_ONLY` advisory dispatcher / route optimizer candidate.
- OpenClaw+ remains `SERVICE_DOWN` until the CLI/runtime doctor is reachable.

The CloudCode backend-support agent-health helper now consumes the SpaceAgent browser automation card truth instead of copying one aggregate SpaceAgent blocker across Playwright, YouTube, and Firecrawl.

## Files Changed

- `src/app/api/gateway/agent-hub/status/route.ts`
- `src/lib/gateway-agent-hub.ts`
- `src/lib/gateway-agent-hub.test.ts`
- `src/lib/gateway-cloudcode-integration.ts`
- `src/lib/gateway-cloudcode-integration.test.ts`
- `runtime/day-11-dispatcher-core-closure.md`
- `runtime/day-11-dispatcher-core-closure.pdf`

## Routes Changed

- `GET /api/gateway/agent-hub/status`

The route now includes live SpaceAgent browser automation inputs:

- Playwright MCP status from the local MCP status probe.
- Firecrawl credential presence yes/no only.
- YouTube transcript connector proof status.

## UI Behavior

Agent Hub and downstream detail/status consumers now receive owner-facing truth that avoids fake LIVE or fake READY states.

Current owner-facing status summary from the restarted runtime:

| Status | Count |
| --- | ---: |
| LIVE | 0 |
| READY | 1 |
| OWNER_GATED | 0 |
| CREDENTIAL_GATED | 2 |
| SERVICE_DOWN | 3 |
| BLOCKED | 0 |
| DISABLED | 0 |

Agent card truth:

| Agent | Status | Owner status | Blocker |
| --- | --- | --- | --- |
| Agent Zero | blocked | CREDENTIAL_GATED | `agent_zero_external_api_key_missing` |
| Hermes | blocked | SERVICE_DOWN | `hermes_not_installed` |
| Pi | read_only | READY | none |
| Paperclip | blocked | SERVICE_DOWN | `paperclip_sandbox_service_not_running` |
| SpaceAgent | pending | CREDENTIAL_GATED | `playwright_mcp_service_unreachable` plus Firecrawl credential gate |
| OpenClaw+ | blocked | SERVICE_DOWN | `openclaw_doctor_runtime_not_reachable` |

SpaceAgent component truth:

| Component | Status | Blocker |
| --- | --- | --- |
| Playwright MCP | SERVICE_DOWN | `playwright_mcp_service_unreachable` |
| YouTube Research | READ_ONLY | none |
| Firecrawl | CREDENTIAL_GATED | `firecrawl_credential_required` |

## Service / Runtime Proof

Mission Control was rebuilt and restarted locally on the production standalone bundle.

- Bind: `127.0.0.1:3337`
- PID after final restart: `71076`
- `/login`: HTTP 200
- Public exposure check: only `127.0.0.1:3337` was listening.
- No `.env` change.
- No secrets printed.
- No auth weakening.

Authenticated runtime probe:

- `GET /api/gateway/agent-hub/status`: HTTP 200 with corrected production truth.
- `GET /api/gateway/space-agent/youtube/status`: `READY`, `transcript_connector_proven=true`.

## Tests And Checks

Passed:

- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`
  - 171 test files passed.
  - 1359 tests passed.
- `node scripts/check-protected-file-invariants.mjs`
- `node scripts/check-mission-control-route-rendering.mjs http://127.0.0.1:3337`
  - 46 routes checked.
  - 8 designer pages checked.
  - 0 failures.
- `.env` diff check: `0` bytes.

Targeted regression:

- `src/lib/gateway-agent-hub.test.ts`
- `src/lib/gateway-cloudcode-integration.test.ts`

These tests now fail if stale Agent Zero/Hermes/Paperclip/SpaceAgent fake-ready status returns.

## Proof Artifact

This report and PDF are the Day 11 proof artifact:

- `runtime/day-11-dispatcher-core-closure.md`
- `runtime/day-11-dispatcher-core-closure.pdf`

## Remaining Blockers

These are not Day 11 developer blockers; they are truthful downstream lane states:

| Blocker | Class | Lane |
| --- | --- | --- |
| `agent_zero_external_api_key_missing` | CREDENTIAL_GATED | Agent Zero |
| `hermes_not_installed` | SERVICE_DOWN | Hermes runtime |
| `paperclip_sandbox_service_not_running` | SERVICE_DOWN | Paperclip |
| `playwright_mcp_service_unreachable` | SERVICE_DOWN | SpaceAgent Playwright |
| `firecrawl_credential_required` | CREDENTIAL_GATED | SpaceAgent Firecrawl |
| `openclaw_doctor_runtime_not_reachable` | SERVICE_DOWN | OpenClaw+ |

## Rollback

Rollback command after commit:

```bash
git revert <day11_dispatcher_core_commit_sha>
```

## Commit / Push

Commit hash: pending until this report commit is created.
Push result: pending until this report commit is pushed.

## Next Day Started

Day 12 - Token Governor begins next. The next lane is canonical token/budget/model enforcement with owner-safe UI state, tests, and proof.
