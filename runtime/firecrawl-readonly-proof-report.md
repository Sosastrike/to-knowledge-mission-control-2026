# Firecrawl Read-Only Proof Report

Generated: 2026-05-08 09:24 ET

## Objective

Move Firecrawl from BLOCKED to connected/read-only only if an approved credential and safe backend adapter are actually available.

Final result: **BLOCKED**.

Firecrawl is still blocked for Mission Control. The production routes and Gateway node exist, and SpaceAgent can return a Firecrawl-aware ResearchPacket, but Mission Control does not have a Firecrawl credential in its service environment and the Firecrawl SDK/backend runner is not installed. No live Firecrawl scrape/crawl was executed.

## Status Decision

| System | Previous % | Updated % | Decision | Exact blocker |
| --- | ---: | ---: | --- | --- |
| Firecrawl | 35% | 35% | BLOCKED | `firecrawl_credential_required` |
| SpaceAgent Firecrawl path | 68-76% overall SpaceAgent | unchanged | PARTIAL / packet-only | Firecrawl packet can be prepared, but live Firecrawl call is blocked |
| Gateway Firecrawl node | present | present | BLOCKED | `credential_required` |

Do not mark Firecrawl GO. A live read-only smoke did not pass because the credential/backend prerequisites are missing from Mission Control.

## Commands And Routes Used

Commands were run in a way that printed booleans and status only. No credential values, auth files, API keys, or token values were printed.

Production proof routes:

| Route | Authenticated result | Unauthenticated result | Meaning |
| --- | --- | --- | --- |
| `GET /api/firecrawl/status` | 200 | 401 | Firecrawl status route exists and is protected |
| `GET /api/firecrawl/jobs` | 200 | 401 | Jobs route exists and is protected |
| `POST /api/firecrawl/jobs` | 503 | not run unauthenticated | Live job creation blocked by missing credential |
| `GET /api/bridge/connector-readiness` | 200 | 401 | Connector readiness route exists and is protected |
| `GET /api/gateway/nodes/firecrawl` | 404 authenticated | 401 unauthenticated | Direct node alias is not registered |
| `GET /api/gateway/nodes/integration_firecrawl` | 200 | 401 | Gateway node exists under `integration_firecrawl` |
| `POST /api/gateway/space-agent/research` | 200 packet-only | not run unauthenticated | SpaceAgent can prepare a Firecrawl-aware ResearchPacket, but does not execute Firecrawl |

Safe public-page smoke target: `https://example.com/`.

No broad crawl, private page, login, external write, upload, memory write, or connector execution was run.

## Credential Proof

Credential checks were boolean-only.

| Check | Result |
| --- | --- |
| Mission Control process has `FIRECRAWL_API_KEY` | no |
| Mission Control configured env source has `FIRECRAWL_API_KEY` by name | no |
| Related ClaudeClaw env source has `FIRECRAWL_API_KEY` by name | yes, value not inspected |
| Related OpenClaw+ env source has `FIRECRAWL_API_KEY` by name | yes, value not inspected |
| Mission Control Firecrawl SDK loaded | no |
| `.env` diff clean | yes |

Conclusion: an approved credential may exist in related OpenClaw+ runtime sources by name, but Mission Control does not currently have an approved credential in its own service environment. I did not copy, print, or read the secret value.

Required owner/admin next step: approve a secure credential sync path into Mission Control's protected service environment, then approve/wire the read-only Firecrawl backend adapter before rerunning smoke.

## Backend Adapter Proof

Mission Control has a Firecrawl API surface:

- `GET /api/firecrawl/status`
- `GET /api/firecrawl/jobs`
- `POST /api/firecrawl/jobs`
- `GET /api/bridge/connector-readiness`
- `GET /api/gateway/nodes/integration_firecrawl`

However, the production job route intentionally blocks execution:

| Probe | Result |
| --- | --- |
| `POST /api/firecrawl/jobs` with `type=scrape` and public URL | HTTP 503 |
| Returned operation | no job created |
| Missing credential behavior | blocked safely |
| Firecrawl SDK/backend runner | not installed/wired |

If the credential becomes available before the backend runner is installed, the next blocker will be `firecrawl_backend_adapter_not_configured`.

## Gateway And Agent Hub Status

Gateway exposes Firecrawl under node id `integration_firecrawl`.

| Field | Production result |
| --- | --- |
| Node id | `integration_firecrawl` |
| Label | Firecrawl |
| Status | blocked |
| Read enabled | false |
| Write enabled | false |
| Execution enabled | false |
| Requires Bridge Session | true |
| Blocked reason | `credential_required` |

This is honest and safe. Gateway is not claiming live Firecrawl access.

## SpaceAgent ResearchPacket Proof

SpaceAgent was asked to prepare a Firecrawl-oriented packet for a public page. It did not execute Firecrawl.

| Field | Result |
| --- | --- |
| HTTP status | 200 |
| `ok` | true |
| Packet status | ready |
| Firecrawl status in packet | blocked missing credential |
| Blocked reason | `firecrawl_missing_credential_research_packet_can_still_use_browser_or_web_fallback_if_available` |
| Research performed | false |
| Evidence count | 0 |
| Web source count | 0 |
| External writes | none |

Interpretation: SpaceAgent can model and return the route/packet, but Firecrawl itself remains blocked. This is not Firecrawl GO.

## Files Changed

| File | Purpose |
| --- | --- |
| `runtime/firecrawl-readonly-proof-report.md` | Required Firecrawl proof report |
| `runtime/firecrawl-readonly-proof-report.pdf` | Required PDF report |

No application code, `.env` file, auth file, or credential file was changed.

## Tests

| Check | Result |
| --- | --- |
| `git diff --check` | PASS |
| Focused Firecrawl/Gateway/SpaceAgent tests | PASS: 4 files, 35 tests |
| `.env` diff check | PASS: clean |
| Production authenticated route smoke | PASS for Firecrawl status, jobs, connector readiness, Gateway node, SpaceAgent research |
| Production unauthenticated route smoke | PASS: protected routes returned 401 |

Focused tests run:

- `src/lib/space-agent-routes.test.ts`
- `src/lib/gateway-pi-dispatcher.test.ts`
- `src/lib/gateway-route-planner.test.ts`
- `src/lib/gateway-model.test.ts`

## Blockers

| Blocker | Status | Required next action |
| --- | --- | --- |
| `firecrawl_credential_required` | active | Owner/admin approves secure credential sync into Mission Control service environment |
| `firecrawl_backend_adapter_not_configured` | pending after credential | Install and wire the Firecrawl SDK/read-only runner and job persistence safely |
| Live read-only smoke | not run | Rerun only after credential and backend adapter are present |

## Rollback

No runtime or application behavior was changed. Rollback is report-only:

1. Revert the report commit if this report is committed.
2. No service restart is required for this report-only change.

## No-Secrets Confirmation

- No Firecrawl credential value was printed.
- No auth file was printed.
- No API key or token value was printed.
- No `.env` file was modified.
- No external write was performed.
- No Firecrawl scrape/crawl/extract/map job was executed.
- No public local service exposure was added.
- No fake Firecrawl connected status was set.

## Exact Next Step

Keep Firecrawl at **35% BLOCKED** with `firecrawl_credential_required` until an owner-approved credential sync path and backend adapter are both present. Then rerun exactly one read-only public-page smoke and update Gateway / Agent Hub only if that live smoke passes.
