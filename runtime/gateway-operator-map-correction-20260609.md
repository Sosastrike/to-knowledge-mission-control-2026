# Gateway Operator Map Correction - 2026-06-09

## Scope
- Active runtime: `/home/tony/mission-control`
- Branch/worktree: `codex/agentmail-hosted-connect-20260606`
- Safety posture: no external writes, no Zapier writes, no HeyGen writes, no browser automation writes, no webhook/report delivery writes, no `.env` changes, no second vault, no SMB mount, no external farmers.

## Root Cause
- Pathlines disappeared because the routed-edge renderer dereferenced a null card box while building the card-boundary map. One tiny/missing element could abort the entire SVG route draw.
- The prior cleanup also made standby/quiet paths too easy to hide, so the map looked clean but disconnected.
- Several cards used raw `approval_required` language as a card-level failure instead of separating setup readiness from guarded write/execute policy.

## Implemented Changes
- Added visible domain highway routing with trunks and branches for model, input, knowledge, storage, integration, report, webhook/event, AgentMail, Zapier, and browser/runtime groups.
- Added SVG cutout masking for card and warning-chip bounds so pathlines do not visibly draw through cards/chips.
- Kept Operator Mode as the default, with Trace, Diagnostics, and Quiet modes wired to visible state changes.
- Restored button behavior for Fit, Reset, Center Dispatcher, Center Selected, Edit Layout, Save Layout, Reset Layout, Operator, Trace, Diagnostics, and Quiet.
- Moved diagnostics/settings drawers into fixed viewport-safe side drawers with internal scroll and collapsed/open states.
- Restored GBrain as a visible guarded/read-only node.
- Updated approval semantics for Obsidian Vault, MemPalace/Palacio, Graphify/Graffiti, Brain Sync, Build-Wiki, AgentMail, Zapier, Reports, Webhooks, and Events.
- Updated xAI Grok from stale red/403 UI state to live/green based on fresh runtime proof.

## Browser Geometry / Interaction Proof
- Local browser screenshot: `runtime/gateway-operator-map-correction-20260609.png`
- Visible cards checked: 40
- Card overlaps: 0
- Operator highways rendered: 18
- Operator branches rendered: 40
- SVG path masks applied: 58
- Card/chip cutout rects: 40
- Drawers inside viewport: yes
- Drawers scrollable/collapsible: yes
- Fit changed viewport transform: yes
- Center Dispatcher changed viewport transform: yes
- Center Selected produced non-blocking toast and centered selected node: yes
- Trace mode highlighted selected route and dimmed unrelated paths: yes
- Diagnostics mode exposed raw edge set: yes
- Quiet mode intentionally hid non-critical paths and displayed quiet-mode toast: yes

## Final Card Semantics
- AgentMail: `AgentMail ready · approval-gated sending`
- Zapier: `Zapier discovery ready · writes guarded`
- xAI Grok: live, Provider Vault validation ok, 9 models synced
- GBrain: `GBrain · tool invocation guarded`
- Obsidian Vault: read ready, writes guarded
- MemPalace / Palacio: memory ready, writes guarded
- Graphify / Graffiti: graph ready, writes guarded
- Brain Sync: sync ready, write scope needed
- Build-Wiki: build ready, run guarded
- Reports: preview ready, delivery guarded
- Webhooks: receiver ready, waiting for events
- Events: event bus ready, no recent events

## Runtime Verification
- Targeted tests on server: 4 files, 22 tests passed
- `pnpm run build` on server: passed
- `pnpm run typecheck` on server after build: passed
- Service restart: passed
- Service state: active
- Runtime process cwd: `/home/tony/mission-control/.next/standalone`
- Route smoke:
  - `/login`: 200
  - `/gateway`: 401 unauthenticated
  - `/api/gateway/graph/node-readiness`: 401 unauthenticated
  - `/api/gateway/graph/edge-readiness`: 401 unauthenticated
  - `/api/gateway/approvals/center`: 401 unauthenticated
  - `/api/bridge/zapier/status`: 401 unauthenticated
  - `/api/agentmail/status`: 401 unauthenticated

## xAI Grok Runtime Proof
- `pnpm run gateway:trace-provider -- --provider=xai_grok`
- Provider Vault present: true
- Safe model-list probe: HTTP 200
- Validation status: ok
- Exact blocker: null
- Model count: 9
- Credential values exposed: false
- Tokens exposed: false
- Env values exposed: false

## Secret Safety
- `.env` diff: empty
- `.env.local` diff: empty
- Raw secret scan on touched Gateway assets and standalone bundle: no provider keys/tokens found
- Broad client-bundle scan produced only a generic setup-page cookie-management false positive, not provider material
- No external writes were executed
- No arbitrary Zapier writes were enabled
- No broad connector execution was enabled

## Deployment Notes
- Server worktree was dirty before this hop. Deployment copied only the Gateway operator-map files into the existing active runtime tree; no hard reset was performed.
- Source commit: this commit, `Fix Gateway operator map readability`
- Push result: `codex/agentmail-hosted-connect-20260606` pushed to `origin`
- Build synced static assets to `.next/standalone/public/`.
- Stale text scan confirmed the deployed Gateway assets no longer include:
  - `Bridge Session required to send mail`
  - `Owner pre-approval required per execution scope`
  - `xai_grok_permission_or_billing_required`

## Rollback
To roll back only this operator-map pass:

```bash
cd /home/tony/mission-control
git restore -- \
  "public/design/gateway/Gateway Overview.html" \
  public/design/gateway/shared/gateway-data.js \
  public/design/gateway/shared/render.js \
  "gateway-dropin/public/design/gateway/Gateway Overview.html" \
  gateway-dropin/public/design/gateway/shared/gateway-data.js \
  gateway-dropin/public/design/gateway/shared/render.js \
  design/gateway/shared/gateway-data.js \
  src/lib/gateway-approval-center.ts \
  src/lib/gateway-graph-edge-readiness.ts \
  src/lib/gateway-graph-node-readiness.ts \
  src/lib/gateway-approval-center.test.ts \
  src/lib/gateway-graph-edge-readiness.test.ts \
  src/lib/gateway-graph-edge-ui.test.ts \
  src/lib/gateway-graph-node-readiness.test.ts
pnpm run build
sudo systemctl restart mission-control.service
```
