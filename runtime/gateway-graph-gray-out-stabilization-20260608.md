# Gateway Graph Gray-Out Stabilization - 2026-06-08

## Summary
- Active runtime: `/home/tony/mission-control`
- Service: `mission-control.service`
- Runtime cwd after restart: `/home/tony/mission-control/.next/standalone`
- Local branch: `codex/agentmail-hosted-connect-20260606`
- Base commit before this patch: `41b1710`
- External writes executed: false
- Credentials exposed: false
- `.env` / `.env.local` changed: false

## Root Cause
The Gateway graph was not proving every visible edge. The `/api/gateway/graph/edge-readiness` payload covered browser/report/webhook/event/connector edges, but it did not include the visible model-provider edges. The static Gateway fallback also lacked model edge readiness reasons and still represented Zapier as a write-approval edge instead of a read-only discovery edge.

Result: when the UI could not map a visible edge to a readiness record, the line fell back to gray without explaining why. This made healthy providers look inactive.

## Changes
- Added model-provider edge readiness records for OpenRouter, OpenAI/Codex, Claude, Ollama, NVIDIA, Gemini, Groq, and xAI Grok.
- Added `graph_health` metadata to the edge-readiness payload.
- Added static fallback version `gateway-edge-readiness-v2`.
- Added explicit UI states:
  - `graph_readiness_unavailable`
  - `edge_status_missing`
  - `edge_mapping_mismatch`
- Added Gateway Graph Health panel.
- Added fallback behavior that keeps last-known-good readiness if the live feed fails.
- Updated Zapier edge to `read_only` / cyan with reason `zapier_discovery_ready_writes_guarded`.

## Current Edge Status Highlights
- HTML: standby/read-only diagnostic with `html_surface_registered_no_runtime_bridge`.
- Firefox: standby with `firefox_runtime_not_connected`.
- Reports: read-only with `report_preview_ready_delivery_not_enabled`.
- Webhooks: standby with `webhook_receiver_ready_no_recent_events`.
- Events: standby with `event_bus_ready_no_recent_events`.
- OpenRouter/Gemini/Groq/NVIDIA/Ollama/OpenAI/Codex/Claude: model runtime-ready edges represented in readiness payload.
- xAI Grok: red/blocked with `xai_grok_permission_or_billing_required`.
- Zapier: cyan/read-only, writes guarded by approval policy.
- AgentMail: ready, approval-gated sending.

## Verification
- Focused server tests passed:
  - `src/lib/gateway-graph-edge-readiness.test.ts`
  - `src/lib/gateway-graph-edge-readiness-route.test.ts`
  - `src/lib/gateway-graph-edge-ui.test.ts`
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `mission-control.service`: active after restart.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.

## Route Smoke
- `/login`: 200
- `/gateway`: 307 unauthenticated redirect
- `/api/gateway/graph/edge-readiness`: 401 unauthenticated
- `/api/gateway/models`: 401 unauthenticated
- `/api/gateway/bridge-runtime/status`: 401 unauthenticated
- `/api/bridge/agentmail-readiness`: 401 unauthenticated
- `/api/agentmail/status`: 401 unauthenticated
- `/api/bridge/zapier/status`: 401 unauthenticated
- `/api/bridge/zapier/approved-actions`: 401 unauthenticated

## Static Runtime Proof
The deployed standalone static assets contain:
- `Gateway Graph Health`
- `graph_readiness_unavailable`
- `edge_status_missing`
- `edge_mapping_mismatch`
- `openrouter_model_runtime_ready`
- `nvidia_model_runtime_ready`
- `zapier_discovery_ready_writes_guarded`
- `gateway-edge-readiness-v2`

## Secret Safety
- Touched source/static files key-shaped scan: clean.
- Gateway static/client bundle key-shaped scan: clean.
- A broad bundle scan contains generic library auth-header literals, but no key-shaped Mission Control provider secrets were found.
- `.env` and `.env.local` were not modified.
- No secrets, tokens, cookies, Provider Vault material, or authorization headers were printed into this report.

## Files Changed
- `src/lib/gateway-graph-edge-readiness.ts`
- `src/lib/gateway-graph-edge-readiness.test.ts`
- `src/lib/gateway-graph-edge-readiness-route.test.ts`
- `src/lib/gateway-graph-edge-ui.test.ts`
- `public/design/gateway/Gateway Overview.html`
- `public/design/gateway/shared/gateway-data.js`
- `design/gateway/shared/gateway-data.js`
- `runtime/gateway-graph-gray-out-stabilization-20260608.md`

## Safety Confirmation
- Zapier writes enabled: false
- Broad connector execution enabled: false
- Browser automation writes enabled: false
- Webhook writes enabled: false
- Report delivery writes enabled: false
- External farmers run: false
- SMB mounted: false
- Second vault created: false

## Rollback
Revert the stabilization commit, rebuild, and restart only `mission-control.service`:

```bash
cd /home/tony/mission-control
git revert <stabilization_commit_sha>
pnpm run build
sudo systemctl restart mission-control.service
```
