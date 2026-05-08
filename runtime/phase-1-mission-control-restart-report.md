# Phase 1 — Mission Control Admin Restart Report

Generated: 2026-05-08T00:14:40Z

## Result

**Status:** BLOCKED / NOT RESTARTED

Exact blocker: `mission_control_admin_restart_required`. Production Mission Control is active, but the process did not restart because systemd requires interactive admin authentication and non-interactive sudo is unavailable.

## Restart Proof

| Check | Result |
| --- | --- |
| Branch | `to-knowledge-mc` |
| Repo HEAD | `fc08603` |
| Pre-restart service status | `active` |
| Pre-restart MainPID | `2121865` |
| Pre-restart ActiveEnterTimestamp | `Thu 2026-05-07 18:15:50 EDT` |
| `systemctl restart mission-control.service` | failed: interactive authentication required |
| `sudo -n systemctl restart mission-control.service` | failed: password required |
| Post-attempt service status | `active` |
| Post-attempt MainPID | `2121865` |
| Post-attempt ActiveEnterTimestamp | `Thu 2026-05-07 18:15:50 EDT` |
| PID changed | `False` |
| Timestamp changed | `False` |
| Latest pushed code loaded by production process | `not_proven` |

## Route Smoke Against Current Process

| Route | Auth | HTTP | Key result |
| --- | --- | ---: | --- |
| `GET /api/gateway/status` | yes | 200 | ok=True, mode=gateway_status_read_only, status=degraded, execution_enabled=False, writes_enabled=False |
| `GET /api/gateway/status` | no | 401 | error=Unauthorized |
| `GET /api/gateway/agent-hub/status` | yes | 200 | ok=True, mode=gateway_agent_hub_status_read_only, execution_enabled=False, writes_enabled=False |
| `GET /api/gateway/agent-hub/status` | no | 401 | error=Unauthorized |
| `GET /api/gateway/agent-hub/agents` | yes | 200 | ok=True, mode=gateway_agent_hub_agents_read_only, execution_enabled=False, writes_enabled=False |
| `GET /api/gateway/agent-hub/agents` | no | 401 | error=Unauthorized |
| `GET /api/gateway/space-agent/browser/status` | yes | 200 | ok=True, mode=space_agent_browser_automation_truth, execution_enabled=False, writes_enabled=False |
| `GET /api/gateway/space-agent/browser/status` | no | 401 | error=Unauthorized |
| `GET /api/bridge/agent-zero/status` | yes | 200 | ok=True, mode=agent_zero_commander_status_bridge_session_execution |
| `GET /api/bridge/agent-zero/status` | no | 401 | error=Unauthorized |
| `POST /api/bridge/agent-zero/test-chat` | yes | 200 | ok=True, mode=agent_zero_read_only_test_chat, status=200, agent_zero_called=True, blocker=None, execution_enabled=False, writes_enabled=False, error=None |
| `POST /api/bridge/agent-zero/test-chat` | no | 401 | error=Unauthorized |

## Dirty Worktree Notes

Existing parked artifacts remain untracked and were not staged:
- `?? public/Voice-Biometrics-Executive-Report.pdf`
- `?? public/lu-ai-collab-v2.mp4`

## Security / Governance Confirmation

- No secrets, tokens, auth files, API keys, or .env values were printed.
- No .env file was modified.
- No auth policy was weakened or bypassed.
- No external writes, Zapier writes, HeyGen generation, SMB/Fork 2, Farmer execution, email send, Drive upload, OneDrive upload, or Telegram attachment send occurred.
- OpenClaw+ naming remains correct; opencloud-docs-farmer.service appears only as a literal legacy systemd service name when needed.

## Phase 1 Decision

Phase 1 remains **BLOCKED** until an admin/operator completes the interactive restart and the PID/timestamp change is proven.
