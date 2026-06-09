# Gateway Operator Acceptance Sweep - 2026-06-09

## Summary
- Active runtime: `/home/tony/mission-control`
- Branch: `codex/agentmail-hosted-connect-20260606`
- Change type: owner-facing acceptance sweep plus preview-only standing-scope calibration.
- External writes executed: no
- Arbitrary Zapier writes enabled: no
- Broad connector execution enabled: no
- Credentials exposed: no
- `.env` / `.env.local` changed: no

## Owner Acceptance Sweep
Browser sweep was run against the Gateway overview static asset using Playwright/Chrome.

- Highways visible in Operator Mode: yes
- Visible Operator paths: 58
- Highway trunks: 18
- Branches: 40
- Card overlaps: 0 across 40 visible cards
- Edge card cutouts/masks: 41
- Diagnostics drawer inside viewport: yes
- Drawer internal scroll: auto
- Side drawers collapsible/reopenable: yes
- Screenshot proof: `runtime/gateway-acceptance-sweep-20260609.png`

Toolbar results:
- Fit: changed viewport transform
- Reset: changed viewport transform back
- Center Dispatcher: changed viewport transform
- Center Selected: changed viewport after selecting Zapier
- Edit Layout: enabled layout editing
- Save Layout: persisted safe UI-only node offsets
- Reset Layout: cleared saved node offsets
- Operator: selected and showed bundled routes
- Trace: selected and showed focused routes
- Diagnostics: selected and showed diagnostic routes
- Quiet: selected and reduced route noise

## Card Semantics
- GBrain: visible, read-only active, `GBrain · tool invocation guarded`
- xAI Grok: live/green in static Gateway and live Provider Vault trace
- AgentMail: `AgentMail ready · approval-gated sending`
- Zapier: `Zapier discovery ready · writes guarded`
- Obsidian Vault: `Obsidian Vault · writes guarded`
- Palacio / MemPalace: `Palacio / MemPalace · writes guarded`
- Graphify / Graffiti: `Graphify / Graffiti · writes guarded`
- Brain Sync: `Brain Sync · write scope needed`
- Build-Wiki: `Build-Wiki · run guarded`
- Reports: `Preview ready · delivery guarded`
- Webhooks: `Receiver ready · waiting for events`
- Events: `Event bus ready · no recent events`

Stale Gateway wording removed from deployed assets:
- `Bridge Session required to send mail`
- `Owner pre-approval required per execution scope`
- `Owner pre-approval per execution`

## Standing-Scope Proposals
Added preview-only standing-scope proposals to the protected Approval Center payload and static Gateway mirror:

1. `scope.knowledge.read.preview`
2. `scope.knowledge.write.preview`
3. `scope.buildwiki.run_now.preview`
4. `zapier.scope.discovery_and_status` (already-active read-only discovery/status)
5. `scope.zapier.exact_action.preview`
6. `scope.reports.delivery.preview`
7. `scope.drive.upload.preview`
8. `scope.gbrain.invocation.preview`

Activation status:
- Preview-only proposals: 7
- Already-active read-only proposal: 1
- Write scope activation enabled: false
- Execute scope activation enabled: false
- External writes enabled: false
- Broad connector execution enabled: false

## Live Runtime Verification
Server-side targeted tests:
- `src/lib/gateway-graph-node-readiness.test.ts`
- `src/lib/gateway-graph-edge-readiness.test.ts`
- `src/lib/gateway-approval-center.test.ts`
- `src/lib/gateway-approval-center-route.test.ts`
- `src/lib/gateway-graph-edge-ui.test.ts`
- `src/lib/zapier-standing-scopes.test.ts`
- `src/lib/zapier-approved-action-library.test.ts`

Result: 7 test files passed, 33 tests passed.

Build/typecheck:
- Server `pnpm run build`: passed
- Server `pnpm run typecheck`: passed
- Local `pnpm run typecheck` / `pnpm run build`: blocked by the local worktree missing runtime-only modules already present on the active server (`mission-control-contracts`, `provider-vault`, `jarvis-*`). This was not introduced by this patch.

Service:
- Restarted: yes
- `mission-control.service`: active
- Runtime cwd: `/home/tony/mission-control/.next/standalone`

Route smoke from service port:
- `/login`: 200
- `/gateway`: 307 auth redirect
- `/api/gateway/graph/node-readiness`: 401 unauthenticated
- `/api/gateway/graph/edge-readiness`: 401 unauthenticated
- `/api/gateway/approvals/center`: 401 unauthenticated
- `/api/bridge/zapier/status`: 401 unauthenticated
- `/api/agentmail/status`: 401 unauthenticated

## xAI Grok
Safe trace result:
- Provider: `xai_grok`
- Provider Vault present: true
- HTTP status: 200
- Validation status: ok
- Model count: 9
- Exact blocker: null
- Credential exposure flags: false

## Safety Verification
- No external writes ran.
- No Zapier writes were enabled.
- No broad connector execution was enabled.
- No HeyGen/browser/webhook/report delivery writes were enabled.
- No GBrain invocation was enabled.
- No SMB mount or external farmers were run.
- `.env` hash unchanged: `e450af945084880dceada9b50b6527ff30d602dfb6b19eede0fde629c580a682`
- `.env.local` hash unchanged: `e2ffdde0a2ad9cd20d58d54f8ff704f0b7b442b88b03c56c965f73077448b8aa`
- Secret scan found no credential values in touched/deployed files. The only matches were test redaction regex literals.

## Files Changed
- `src/lib/gateway-approval-center.ts`
- `src/lib/gateway-approval-center.test.ts`
- `src/lib/gateway-approval-center-route.test.ts`
- `public/design/gateway/Gateway Overview.html`
- `public/design/gateway/Mission Control + Gateway.html`
- `public/design/gateway/shared/gateway-data.js`
- `runtime/gateway-operator-acceptance-sweep-20260609.md`

## Rollback
Code rollback:
```bash
cd /home/tony/mission-control
git revert <commit_sha>
pnpm run build
sudo systemctl restart mission-control.service
```

Runtime-only fallback if server worktree remains dirty:
```bash
cd /home/tony/mission-control
git checkout -- src/lib/gateway-approval-center.ts src/lib/gateway-approval-center.test.ts src/lib/gateway-approval-center-route.test.ts public/design/gateway/Gateway\\ Overview.html public/design/gateway/Mission\\ Control\\ +\\ Gateway.html public/design/gateway/shared/gateway-data.js
pnpm run build
sudo systemctl restart mission-control.service
```
