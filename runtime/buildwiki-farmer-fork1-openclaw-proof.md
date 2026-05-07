# Build-Wiki / Farmer Fork 1 OpenClaw+ Proof

Generated: 2026-05-07T22:18:47.160Z

## Executive Result

Build-Wiki / Farmer is **PARTIAL GO** as a scoped worker/docs sync service under OpenClaw+.

The existing literal systemd units still use the legacy service name opencloud-docs-farmer.timer and opencloud-docs-farmer.service. Owner-facing architecture should treat them as Build-Wiki / Farmer under OpenClaw+, not as an OpenCloud architecture layer.

## Production Truth

| Check | Result |
| --- | --- |
| Build-Wiki status route | 200 authenticated |
| Build-Wiki status unauthenticated | 401 |
| Run Now read route | 200 authenticated |
| Run Now mode | telegram_run_now_read_only |
| Run Now target service | opencloud-docs-farmer.service |
| Run Now execution enabled | false |
| Farmer timer | active / waiting |
| Farmer one-shot service | inactive / success |
| SMB/Fork 2 mount | not mounted |
| Run Now POST executed in this phase | no |
| Farmer executed in this phase | no |

## Fork Scope

| Fork | Status | Notes |
| --- | --- | --- |
| Fork 1 local Build-Wiki/Farmer | available | scoped to the existing one-shot service only |
| Fork 2 SMB | blocked | SMB is not mounted and was not attempted |
| External farmers | blocked | no Gmail, Slack, YouTube, web, or SMB farmer was run |
| Broad connector execution | blocked | no Zapier, HeyGen, Drive, OneDrive, or AgentMail write was run |

## Bridge Session / Approval Behavior

Run Now remains approval-gated. The read route can show the latest approval/run state, but it does not execute. Owner approval through the approved channel is required before the exact one-shot service can be started.

Allowed execution target, when approved: opencloud-docs-farmer.service.

No other service, SMB mount, external farmer, or broad connector action is in scope.

## OpenClaw+ Placement

Build-Wiki / Farmer sits under OpenClaw+ as a worker/docs sync capability. Agent Zero decides what should happen, Hermes can design related skills/workflows, Gateway enforces routing/policy/audit, and OpenClaw+ remains the runtime and governance layer.

## Remaining Blockers

| Blocker | Impact | Exact Next Step |
| --- | --- | --- |
| Bridge Session / owner approval required | Run Now cannot execute directly from read-only proof. | Open a scoped Bridge Session and approve buildwiki.run_now before starting the one-shot service. |
| SMB/Fork 2 not mounted | Fork 2 remains unavailable. | Keep blocked until SMB prerequisites are separately approved and proven. |
| External farmers not authorized | No external source sync can run. | Add each external farmer only through its own approved phase. |

## Security Confirmation

- No farmer execution occurred.
- No Run Now POST was sent.
- No SMB mount occurred.
- No external farmers ran.
- No Zapier writes or HeyGen generation occurred.
- No .env changes were made.
- No secrets were printed or committed.
- OpenClaw+ was retained as runtime layer.

## Completion Estimate

| Component | Percent | Status |
| --- | ---: | --- |
| Fork 1 status visibility | 90% | route and service status proven |
| Run Now read/approval state | 85% | read route works, execution disabled |
| Timer/service health | 85% | timer active, service inactive/success |
| Fork 2 SMB | 0% | blocked/not mounted |
| Approved Run Now execution proof | 0% | not run in this phase |
| Build-Wiki / Farmer overall | 68% | PARTIAL GO |

## Final Decision

Build-Wiki / Farmer Fork 1: **PARTIAL GO**.

The safe local path is visible and scoped. Execution remains correctly blocked without Bridge Session and owner approval.