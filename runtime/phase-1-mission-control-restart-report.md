# Phase 1 — Mission Control Admin Restart Report

Generated: 2026-05-07T23:05:44Z

## Result

**Status:** BLOCKED / NOT RESTARTED

**Exact blocker:** `mission_control_admin_restart_required`

Production Mission Control is active, but it did not restart. The host requires interactive admin authentication for `systemctl restart mission-control.service`, and non-interactive sudo is not available. I did not weaken service policy, bypass auth, or edit system configuration.

## Restart Attempt Proof

| Check | Result |
| --- | --- |
| Branch | `to-knowledge-mc` |
| Repo HEAD | `ded9d1c` |
| Pre-restart service status | active |
| Pre-restart MainPID | `2121865` |
| Pre-restart ActiveEnterTimestamp | `Thu 2026-05-07 18:15:50 EDT` |
| `systemctl restart mission-control.service` | failed: interactive authentication required |
| `sudo -n systemctl restart mission-control.service` | failed: password required |
| Post-attempt service status | active |
| Post-attempt MainPID | `2121865` |
| Post-attempt ActiveEnterTimestamp | `Thu 2026-05-07 18:15:50 EDT` |
| PID changed | no |
| Timestamp changed | no |
| Latest pushed code loaded by production process | not proven |

## Authenticated Route Smoke Against Current Process

| Route | Result |
| --- | --- |
| `GET /api/gateway/status` | HTTP 200, `ok:true`, mode `gateway_status_read_only`, status `degraded` |
| `GET /api/gateway/agent-hub/status` | HTTP 200, `ok:true`, mock data not used |
| `GET /api/gateway/agent-hub/agents` | HTTP 200, `ok:true`, agent count 5 |
| `GET /api/gateway/space-agent/browser/status` | HTTP 200, `ok:true`, mode `space_agent_browser_automation_truth` |

## SpaceAgent Browser Automation Truth

| Card | Status | UI truth |
| --- | --- | --- |
| Playwright MCP | `connected_local_only` / green | Local-only read-only browser automation is connected. |
| Firecrawl | `blocked` / red | `firecrawl_credential_required` |
| YouTube Research | `limited_pending` / yellow | `youtube_transcript_connector_not_proven` |

## Unauthenticated Route Protection

| Route | Result |
| --- | --- |
| `GET /api/gateway/status` | HTTP 401 |
| `GET /api/gateway/agent-hub/status` | HTTP 401 |
| `GET /api/gateway/agent-hub/agents` | HTTP 401 |
| `GET /api/gateway/space-agent/browser/status` | HTTP 401 |

## Security / Governance Confirmation

- No secrets, tokens, auth files, or `.env` values were printed.
- No `.env` file was modified.
- No auth policy was weakened.
- No external write was executed.
- No Zapier write, HeyGen generation, SMB/Fork 2, Farmer execution, email send, Drive upload, OneDrive upload, or Telegram attachment send occurred.
- OpenClaw+ naming remains the runtime / skills / agents / mini-agent execution layer. The literal `opencloud-docs-farmer.service` name is not used here except for legacy systemd references.

## Required Action

An admin/operator with interactive authorization must restart Mission Control:

```bash
systemctl restart mission-control.service
systemctl is-active mission-control.service
systemctl show mission-control.service -p MainPID -p ActiveEnterTimestamp --no-pager
```

After a successful restart, the new PID/timestamp must be captured and Gateway / Agent Hub route smoke must be rerun before claiming latest pushed code is loaded.

## Phase 1 Decision

Phase 1 is **BLOCKED** by `mission_control_admin_restart_required`. Production is active and protected, but still running the same process.
