# Agent Hub Production Deployment Report

Generated: 2026-05-07

## Executive Summary

Agent Hub / Control Center has been wired as a real Gateway registry-backed surface. It does not import mock design data. The production checkout does not currently contain the accepted design files (`Agent Hub.html`, `Paperclip.html`, or `shared/agent-data.js`), so visual implementation follows the accepted requirements and existing Mission Control Gateway styling while marking the design handoff as unavailable.

Production restart remains blocked by interactive admin authentication. The code is committed and pushed, and build/tests pass, but the currently running Mission Control process must be restarted by an approved admin path before the new routes are visible in production.

## Phase Status

| Phase | Status | Notes |
| --- | --- | --- |
| 1 Baseline | Complete | Branch `to-knowledge-mc`, HEAD `ed68044` before this follow-up; tracked tree was clean. Mission Control, ClaudeClaw, Hermes gateway, and Build-Wiki timer were active. |
| 2 Import design safely | Blocked | Design files were not present in the production checkout. No mock data was imported. |
| 3 Add route shell | Complete | `/gateway/agent-hub` and `/gateway/agent-hub/paperclip` exist in the build route table. |
| 4 Add API shell | Complete | Read-only Agent Hub status, registry, roster, detail, health, routes, and audit APIs were added. |
| 5 Real agent registry | Complete | Agent Hub maps Paperclip, Agent Zero, Hermes, SpaceAgent, and Pi-mono from Gateway registry objects. |
| 6 Localhost/Tailnet fields | Complete | Each agent includes `local_ui_url`, `tailnet_url`, `ui_mode`, `iframe_allowed`, and `auth_required`. Unknown URLs are null, not guessed. |
| 7 Agent Zero panel | Complete | Agent Zero is shown as Commander and partial GO until live proof is complete. |
| 8 Hermes panel | Complete | Hermes is yellow/gated until `hermes_called:true` is proven. |
| 9 Pi panel | Complete | Pi-mono is shown as candidate/pending until installed and live. |
| 10 SpaceAgent panel | Complete | SpaceAgent is shown as pending research specialist until installed and live. |
| 11 Paperclip panel | Complete | Paperclip is shown as pending until sandbox localhost/Tailnet UI proof exists. |
| 12 Gateway lane | Complete | Route/audit data is sourced from the Gateway registry and flow model where available. |
| 13 Bridge Session modal | Deferred | Read-only policy state is represented; live execution/modal behavior remains future work. |
| 14 Security/auth | Complete | Tests cover unauthenticated 401/403 behavior for Agent Hub routes. |
| 15 Tests | Complete | Typecheck, build, full test suite, and staged no-secrets scan passed. |
| 16 Production restart | Blocked | Restart requires interactive admin authentication. No bypass attempted. |
| 17 Browser smoke | Blocked | Browser smoke requires production restart to load the new route bundle. |
| 18 Report | Complete | This report records routes, status, blockers, and screenshot status. |

## Routes

Owner-facing pages:
- `/gateway/agent-hub`
- `/gateway/agent-hub/paperclip`

Read-only APIs:
- `GET /api/gateway/agent-hub/status`
- `GET /api/gateway/agent-hub/registry`
- `GET /api/gateway/agent-hub/agents`
- `GET /api/gateway/agent-hub/agents/:id`
- `GET /api/gateway/agent-hub/agents/:id/health`
- `GET /api/gateway/agent-hub/agents/:id/routes`
- `GET /api/gateway/agent-hub/agents/:id/audit`

## Agent Status

| Agent | Role | Status Shown | Live Interface | Blocker |
| --- | --- | --- | --- | --- |
| Paperclip | Workforce Control Plane | Pending | Not proven | Paperclip localhost/Tailnet UI not proven; production install remains gated. |
| Agent Zero | Commander | Partial GO | Mission Control bridge surface known | Full GO requires live authenticated `agent_zero_called:true` proof. |
| Hermes | Lieutenant / Skill + Workflow Builder | Gated | Status visible; live chat not proven | `hermes_called:true` not proven. |
| SpaceAgent | Browser / Firecrawl / YouTube Research Specialist | Pending | Not proven | Runtime adapter and install proof pending. |
| Pi-mono | Dispatcher / Route Optimizer Candidate | Pending | Not proven | Candidate only; not installed/live. |

## Interface Fields

Every Agent Hub agent now exposes:
- `local_ui_url`: null unless proven
- `tailnet_url`: null unless proven
- `ui_mode`: explicit mode such as `mission_control_proxy`, `service_gated`, or `not_installed`
- `iframe_allowed`: false
- `auth_required`: true
- `public_exposure`: false

## Supporting Runtime Systems

Agent Hub lists supporting systems from the Gateway registry:
- Gateway
- OpenClaw+ Runtime / Skills Engine
- OpenCloud worker/runtime engine
- Build-Wiki / Farmer
- Brain systems
- Bridge/MCP
- Models, tools, skills, integrations

OpenCloud is retained. Fork 2 / SMB remains blocked. Build-Wiki Run Now remains scoped only to `opencloud-docs-farmer.service` and requires Bridge Session / owner approval.

## Screenshot Status

Screenshots were not captured in this phase because production restart is blocked by interactive admin authentication. Capturing screenshots before the new bundle is loaded would be misleading. Browser smoke should run after the approved restart.

## Validation

Passed:
- `git diff --check`
- `pnpm run typecheck`
- `pnpm run build`
- `pnpm test`
- focused Agent Hub/auth tests
- staged no-secrets scan

Security confirmations:
- No secrets printed.
- No `.env` changes.
- No auth weakening.
- No public UI exposure.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No broad connector execution.
- No OpenCloud deletion.
- No fake live status.
- No raw local paths added to owner UI.

## Remaining Blockers

1. Production Mission Control restart requires approved admin authentication.
2. Browser smoke for `/gateway/agent-hub` and `/gateway/agent-hub/paperclip` must run after restart.
3. Design files are missing from the production checkout, so exact accepted HTML handoff import could not be verified.
4. Paperclip localhost/Tailnet UI proof is pending.
5. Hermes live `hermes_called:true` proof is pending.
6. Pi-mono and SpaceAgent live installs are pending.

## Rollback

Rollback this phase with:

```bash
git revert HEAD
```

Then restart Mission Control through the approved admin path.
