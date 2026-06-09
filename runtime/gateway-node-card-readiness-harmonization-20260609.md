# Gateway Node Card Readiness Harmonization - 2026-06-09

## Summary
- Active runtime: `/home/tony/mission-control`
- Service: `mission-control.service`
- Runtime process cwd: `/home/tony/mission-control/.next/standalone`
- Goal: make Gateway node cards show runtime/policy truth instead of looking gray/offline when they are read-only active, approval-gated, or validated.
- External writes executed: `false`
- Zapier writes enabled: `false`
- Broad connector execution enabled: `false`
- `.env` changed: `false`
- `.env.local` changed: `false`
- Credential values exposed: `false`

## Root Cause
Gateway node readiness was already modeled, but the static Gateway status grammar and fallback wiring still treated gray as `Not configured` and forced non-agent/runtime nodes gray while waiting for `/api/gateway/state`. That made live/read-only/approval-gated nodes visually appear offline during fallback/hydration.

## Changes
- Updated gray grammar to `Standby`, meaning registered but idle, no recent heartbeat, or waiting for a runtime event.
- Updated yellow grammar to guarded policy wording: owner approval, governed execution, or RBAC challenge.
- Preserved semantic static node readiness before authenticated runtime hydration:
  - cyan/read-only cards remain cyan
  - yellow/guarded cards remain yellow
  - green/live-known cards remain green
  - gray remains only for true standby/no heartbeat
- Updated NVIDIA static engine row from gray/not configured to green/validated, matching the Provider Vault truth.
- Updated Gateway Health gray summary label from `Not configured` to `Standby`.
- Added regression tests for standby copy, semantic fallback readiness, guarded R/W/X badges, NVIDIA static engine truth, and stale bad-copy absence.

## Card Status Before/After
- Zapier: `Zapier discovery ready · writes guarded`; read-only cyan. Discovery/status standing scope is active. Writes remain blocked unless an exact owner-approved standing execution scope exists.
- AgentMail: `AgentMail ready · approval-gated sending`; not gray/offline and no global Bridge Session blocker.
- Models: validated providers remain green; xAI Grok remains red/blocked by provider permission/billing. NVIDIA NIM now matches validated green static runtime truth.
- Reports: `Preview ready · delivery guarded`; cyan/read-only.
- Webhooks: `Receiver ready · waiting for events`; gray standby because no recent event/heartbeat.
- Events: `Event bus ready · no recent events`; gray standby because no active event stream heartbeat.
- External APIs / MCP Servers / Tools Registry / Firecrawl: readable/discovery surfaces remain cyan or guarded, not disabled.

## R/W/X Behavior
- Lock icon means writes/execution guarded by Gateway policy and owner approval.
- Guarded write/execute badges render as guarded/yellow rather than off/disabled.
- No broad connector execution was enabled.

## Verification
- Targeted server tests: `pnpm exec vitest run src/lib/gateway-graph-edge-ui.test.ts src/lib/gateway-graph-node-readiness.test.ts src/lib/zapier-standing-scopes.test.ts src/lib/zapier-approved-action-library.test.ts` -> passed, `20/20`.
- Active server typecheck: `pnpm run typecheck` -> passed.
- Active server build: `pnpm run build` -> passed.
- Route smoke:
  - `/login` -> `200`
  - `/gateway` unauthenticated -> `307` login redirect
  - `/api/gateway/graph/node-readiness` unauthenticated -> `401`
  - `/api/gateway/graph/edge-readiness` unauthenticated -> `401`
  - `/api/bridge/zapier/status` unauthenticated -> `401`
  - `/api/agentmail/status` unauthenticated -> `401`
- Service restart: `mission-control.service` active.
- Runtime process cwd: `/home/tony/mission-control/.next/standalone`.
- Local isolated worktree note: local `pnpm run typecheck` and `pnpm run build` failed before deployment because the local worktree lacks several server-side files/modules that exist on the active server. Active runtime checks above passed.

## Secret Safety
- Touched-file and generated-log secret scan: passed.
- Client bundle/static public scan: passed.
- `.env` diff: empty.
- `.env.local` diff: empty.
- No credential, token, authorization header, Provider Vault material, or session value was printed.

## Files Changed
- `public/design/gateway/shared/gateway-data.js`
- `gateway-dropin/public/design/gateway/shared/gateway-data.js`
- `public/design/gateway/shared/tokens.css`
- `gateway-dropin/public/design/gateway/shared/tokens.css`
- `public/design/gateway/Gateway Health.html`
- `gateway-dropin/public/design/gateway/Gateway Health.html`
- `public/design/gateway/developer-handoff.md`
- `gateway-dropin/public/design/gateway/developer-handoff.md`
- `public/design/gateway/components.md`
- `gateway-dropin/public/design/gateway/components.md`
- `public/design/gateway/00-design-brief.md`
- `gateway-dropin/public/design/gateway/00-design-brief.md`
- `src/lib/gateway-graph-edge-ui.test.ts`

## Deployment Notes
- Server worktree was already dirty. A minimal runtime patch was applied to the active runtime files rather than hard-resetting or overwriting unrelated live work.
- Public runtime assets were copied into `.next/standalone/public/design/gateway`.
- Only `mission-control.service` was restarted.
- Source commit: `5b8d8af Harmonize Gateway node readiness cards`.
- Push result: `codex/agentmail-hosted-connect-20260606` pushed to GitHub.

## Rollback
Code/source rollback:
```bash
cd /home/tony/mission-control
git apply -R /tmp/gateway-node-card-readiness-runtime-20260609.patch
cp public/design/gateway/shared/gateway-data.js .next/standalone/public/design/gateway/shared/gateway-data.js
cp public/design/gateway/shared/tokens.css .next/standalone/public/design/gateway/shared/tokens.css
cp "public/design/gateway/Gateway Health.html" ".next/standalone/public/design/gateway/Gateway Health.html"
sudo systemctl restart mission-control.service
```

No credential rollback is required because no secrets, env files, connector permissions, Zapier writes, or broad execution settings changed.
