# Designer Handoff Agent Hub Production Visibility Report

Generated: 2026-05-08

## Objective

Explain why the latest designer changes were not visible in Mission Control, apply the accepted design handoff to the live Gateway / Agent Hub production UI, restart the production process, and prove that the production page now serves the updated Agent Hub control-center experience.

Final result for this slice: **GO for designer handoff visibility in production**.

Overall ecosystem remains: **PARTIAL GO**, not 100%, because Hermes, Firecrawl, YouTube, Paperclip, Pi runtime, delivery connectors, owner-authenticated visual proof, and OpenClaw+ doctor items still have separate blockers.

## Root Cause

The designer files were available in the owner-provided handoff location, but the production React component had not been updated to render the designer control-center structure. A prior deployment had routed Gateway entrypoints to Agent Hub and wired production truth data, but the visible web interface was still mostly the older registry-style page.

This was **not** caused by missing owner paths. It was caused by a production implementation/deployment gap: the handoff assets existed outside the live application, and the live UI needed to be explicitly ported, wired to real Gateway data, tested, restarted, and smoked.

## Design Assets Applied

The accepted handoff assets are now present under `design/gateway` for traceability:

- Agent Hub v2 Browser Automation handoff
- Browser Automation shared data file
- Gateway shared data file
- node card styling
- token styling
- Paperclip v1 final handoff
- Paperclip v1 README
- Paperclip v1 sprint index
- Paperclip v1 developer handoff
- Paperclip v1 shared assets

Owner-facing architecture naming was corrected to **OpenClaw+**. The literal legacy service name `opencloud-docs-farmer.service` remains only where it refers to the existing systemd unit.

## Source Path Reconciliation

Two owner-provided handoff folders were checked from the already-mounted Personal-Drive location without mounting SMB:

| Handoff | Result |
|---|---|
| `handoff 2` | Agent Hub Playwright MCP v2 assets copied and reconciled. |
| `handoff` | Paperclip v1 final assets copied and reconciled. |

The first Paperclip handoff contained two archive files that were not in the first production commit for this slice: `README.md` and `index.html`. Those files have now been added under the Paperclip design archive. The sprint index had legacy runtime labels in the designer package, so those labels were corrected to OpenClaw+ before committing.

## Files Changed

- `design/gateway/**`
- `src/components/gateway-agent-hub/AgentHubControlCenter.tsx`
- `src/lib/gateway-agent-hub.ts`
- `src/lib/gateway-agent-hub.test.ts`
- `src/app/api/gateway/agent-hub/status/route.ts`
- `src/app/api/gateway/space-agent/browser/status/route.ts`
- `runtime/designer-handoff-agenthub-production-visibility-report.md`
- `runtime/designer-handoff-agenthub-production-visibility-report.pdf`

## UI Changes Now in Production

The live Gateway / Agent Hub page now includes:

- Designer-inspired Agent Hub / Control Center layout.
- Top readiness summary.
- Control-center tabs for Agent Zero, Hermes, Pi-mono, SpaceAgent, and Paperclip.
- Operating Chain canvas:
  Owner -> Gateway / Nucleus -> Agent Zero / Pi / Hermes -> Paperclip -> OpenClaw+ -> mini-agents / tools / reports.
- Owner Actions panel with real, gated, or blocked actions only.
- Policy / guardrail panel.
- Design Handoff panel showing the handoff assets are present and mock data is not used.
- Agent cards with read/write/execute truth flags.
- SpaceAgent Browser Automation section showing Playwright MCP, Firecrawl, and YouTube Research from current production truth.

## Current Production Truth Reflected

| System | Status Displayed | Production Truth |
|---|---:|---|
| Agent Zero | partial_go | Commander. Authenticated test-chat has proven `agent_zero_called:true`; downstream routes still prevent full GO. |
| Hermes | gated | Lieutenant / workflow builder. Live adapter still requires `hermes_called:true`. |
| Pi | pending | Dispatcher / Route Optimizer Candidate. Advisory/shadow only. Execution and writes disabled. Blocker: `pi_runtime_session_not_proven`. |
| SpaceAgent | read_only | Research specialist. Playwright MCP is local-only connected; Firecrawl and YouTube remain blocked/limited. |
| Playwright MCP | connected_local_only | Local-only read-only browser automation. Endpoint stays localhost-only. |
| Firecrawl | blocked | Blocker: `firecrawl_credential_required`. |
| YouTube Research | limited_pending | Blocker: `youtube_transcript_connector_not_proven`. |
| Paperclip | pending / degraded | Workforce Control Plane before OpenClaw+. Owner login/service/task queue proof still pending. |
| OpenClaw+ | partial | Runtime / skills / agents / mini-agent execution layer. Doctor health remains a separate phase. |

## Routes and Commands Used

Commands were run without printing secrets or auth files.

- Typecheck: `pnpm run typecheck`
- Test suite: focused Gateway/SpaceAgent tests, resulting in full Vitest pass
- Build: `pnpm run build`
- Production restart fallback: standalone Next production process on localhost-only bind
- Authenticated smoke:
  - `GET /gateway/agent-hub`
  - `GET /api/gateway/agent-hub/status`
  - `GET /api/gateway/space-agent/browser/status`
- Unauthenticated smoke:
  - `GET /api/gateway/agent-hub/status`

## Production Restart Proof

Production Mission Control was restarted with the controlled standalone fallback.

| Proof Item | Result |
|---|---|
| Previous PID | 3192525 |
| New PID | 3205313 |
| New start timestamp | 2026-05-08 07:46:23 |
| Production bind | localhost-only |
| Tailnet proxy | existing proxy remains in front |
| `.env` changed | no |
| secrets printed | no |

Note: `mission-control.service` is not currently installed as an active user unit on the production host, so this slice used the established standalone fallback rather than claiming a systemd restart.

## Smoke Evidence

Authenticated smoke returned:

| Check | Result |
|---|---|
| `/gateway/agent-hub` HTTP | 200 |
| `/api/gateway/agent-hub/status` HTTP | 200 |
| `/api/gateway/space-agent/browser/status` HTTP | 200 |
| unauthenticated protected API | 401 |
| Operating Chain visible | yes |
| Owner Actions visible | yes |
| Agent Zero visible | yes |
| Hermes visible | yes |
| Pi-mono visible | yes |
| SpaceAgent visible | yes |
| Paperclip visible | yes |
| SpaceAgent Browser Automation visible | yes |
| Playwright MCP visible | yes |
| Firecrawl visible | yes |
| YouTube Research visible | yes |
| Design Handoff visible | yes |
| OpenClaw+ visible | yes |
| Legacy runtime architecture label visible | no |

## Tests

| Test | Result |
|---|---|
| `pnpm run typecheck` | PASS |
| Vitest suite | PASS, 134 files / 1241 tests |
| `pnpm run build` | PASS |
| Authenticated route smoke | PASS |
| Unauthenticated route smoke | PASS, 401 |

## Security Confirmation

- No secrets printed.
- No auth files printed.
- No token values printed.
- No `.env` changes.
- No public Playwright MCP exposure.
- No owner browser profile used.
- No SMB mount.
- No Fork 2.
- No Zapier writes.
- No HeyGen generation.
- No external farmers.
- No fake Done status.
- No fake live status.
- No fake buttons added.

## Remaining Blockers Outside This Slice

These blockers still prevent overall 100% GO:

- `owner_authenticated_browser_session_required` for owner visual proof from the owner's active browser session.
- `hermes_safe_live_chat_adapter_not_configured` until Hermes returns `hermes_called:true`.
- `pi_runtime_session_not_proven` until Pi runtime/shadow session is proven.
- `firecrawl_credential_required` until Firecrawl credential/backend proof exists.
- `youtube_transcript_connector_not_proven` until a transcript connector is proven.
- Paperclip service/login/task queue proof is still pending.
- OpenClaw+ doctor health still needs completion.
- Delivery connectors remain gated or blocked unless Bridge Session and connector proof pass.

## Rollback

Rollback should revert the production commit for this slice and restart Mission Control through the same controlled restart path. Do not delete designer source handoff files from the original owner storage location.

## Updated Percentages

| Workstream | Before | After This Slice | Decision |
|---|---:|---:|---|
| Gateway / Agent Hub UI visibility | 74-88% | 90% | PARTIAL GO, production UI now includes designer handoff, owner session proof still pending |
| SpaceAgent Browser Automation UI | 66-82% | 86% | PARTIAL GO, Playwright MCP visible and truthful, Firecrawl/YouTube still blocked/limited |
| Playwright MCP | 90% | 90% | GO for local-only read-only browser automation |
| Pi Dispatcher UI | 35% | 42% | DESIGN / PENDING / SHADOW, visible and truthful, runtime not proven |
| Paperclip UI surface | 45-55% | 60% | PARTIAL / DEGRADED, visible as workforce layer, live service proof pending |
| Overall ecosystem | 86-87% | 87-88% | PARTIAL GO, not 100% |

## Exact Next Step

Use an owner-authenticated browser session to visually confirm the updated production Agent Hub page, then continue with Hermes live adapter proof and Pi runtime proof.
