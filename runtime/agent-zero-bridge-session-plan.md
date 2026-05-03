# Agent Zero Bridge Session Plan

Generated: 2026-05-03

## Purpose

Prepare future Agent Zero execution access without enabling it during the read-only onboarding mission.

## Bridge Session Shape

```json
{
  "session_id": "bs_<generated>",
  "owner_id": "tony",
  "agent_id": "agent_zero",
  "scope": "single approved mission",
  "duration_seconds": 3600,
  "allowed_tools": [],
  "allowed_integrations": [],
  "execution_enabled": false,
  "audit_required": true,
  "created_at": "<iso timestamp>",
  "expires_at": "<iso timestamp>"
}
```

## Phase A: Read-only Test

- Probe Agent Zero runtime health.
- Show Agent Zero in Mission Control as `read_only_test`.
- Proxy owner questions only after `X-API-KEY` is configured safely.
- Inject Mission Control/Bridge context as read-only JSON.
- Keep `execution_enabled=false` and `writes_enabled=false`.

## Phase B: Scoped Execution, Future Only

Requires a separate owner approval and persistent audit support before any execution is enabled.

Future fields:

- approved action list
- tool allowlist
- integration allowlist
- duration/TTL
- owner approval ID
- audit event IDs
- revocation reason

## Forbidden Until Owner Approval

- Protected action execution
- Docker/config changes
- Zapier or HeyGen writes
- SMB/Fork 2 access
- Farmer execution
- Systemctl execution
- Repo push/merge
- Mission Control auth changes

## Next Required Owner Action

Configure an Agent Zero external API key for Mission Control using a safe secret path, without printing the secret. Then rerun the read-only live tests.
