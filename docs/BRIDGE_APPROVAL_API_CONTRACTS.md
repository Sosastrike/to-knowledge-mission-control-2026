# Bridge Approval API Contracts

Status: read-only contract document.

This document defines the next API surface for approval/audit persistence. It does not enable connector execution and does not apply a database migration.

## Shared Response States

All protected actions must return one of these states:

- `READ_ONLY`
- `BACKEND_REQUIRED`
- `CREDENTIAL_REQUIRED`
- `OWNER_APPROVAL_REQUIRED`
- `DISABLED`
- `LIVE`

Protected writes default to `OWNER_APPROVAL_REQUIRED`.

## Mission Control Agent Execution Cycle Context

Approval requests are created only after the agent completes:

1. owner goal intake,
2. Bridge Mode preflight,
3. roadmap,
4. 10-check validation,
5. executive report/PDF.

The approval request must reference the preflight decision, roadmap, validation result, and report/PDF link once persistence is available.

## Protected Action Without Approval

Any protected action without a valid scoped approval must return HTTP `423 Locked`.

Example:

```json
{
  "ok": false,
  "owner_approval_required": true,
  "approval_state": "required",
  "error": "approval_required",
  "connector": "zapier",
  "action": "tool.invoke",
  "target": "gmail.send_email",
  "risk_level": "high",
  "protected_category": "external_automation",
  "audit_required": true,
  "rollback_required": true,
  "approval_request_template": {
    "connector": "zapier",
    "action": "tool.invoke",
    "target": "gmail.send_email",
    "reason": "Send a scoped email through Zapier",
    "ttl_minutes": 30
  }
}
```

Rules:

- Do not execute the action.
- Do not claim success.
- Write blocked audit event once persistence exists.
- Never include credentials or secret payload values.

## Create Approval Request

Endpoint:

- `POST /api/bridge/approval-requests`

Required role:

- `operator` or stronger.

Request:

```json
{
  "preflight_id": "pf_...",
  "roadmap_id": "roadmap_...",
  "connector": "zapier",
  "action": "tool.invoke",
  "target": "gmail.send_email",
  "risk_level": "high",
  "protected_category": "external_automation",
  "reason": "Owner requested a scoped Zapier send action.",
  "plain_language_summary": "Allow one scoped Zapier email send action.",
  "executive_report_url": "/reports/approval/apr_...",
  "executive_report_pdf_url": "/reports/approval/apr_....pdf",
  "approval_scope": {
    "tool": "gmail.send_email",
    "allowed_recipient_domain": "example.com"
  },
  "ttl_minutes": 30,
  "idempotency_key": "optional-client-generated-key"
}
```

Response:

```json
{
  "ok": true,
  "approval_request": {
    "id": "apr_...",
    "connector": "zapier",
    "action": "tool.invoke",
    "target": "gmail.send_email",
    "risk_level": "high",
    "approval_state": "pending",
    "audit_required": true,
    "rollback_available": false,
    "expires_at": "2026-04-29T21:30:00.000Z",
    "created_at": "2026-04-29T21:00:00.000Z"
  }
}
```

Rules:

- Create request only.
- Do not create execution run.
- Do not unlock action.
- Include plain-language summary and report/PDF link when Telegram approval is wired.
- Create audit event `approval_requested` once persistence exists.

## Telegram One-Click Approval

Telegram approval is the owner-facing approval channel once wired.

Required Telegram approval payload:

- plain-language summary,
- approve button,
- deny button,
- approval request id,
- risk level,
- TTL/expiration,
- report link or PDF attachment,
- statement that approval is logged,
- statement that execution remains inside the approved scope.

Telegram approval must not bypass database approval state once persistence exists. The Telegram decision should update the approval record and append an audit event.

## Execution Run Record

Approval alone must not execute a protected action.

Protected execution requires a separate execution run record containing:

- approval request id,
- action lock id,
- preflight id,
- connector,
- action,
- target,
- scope hash,
- idempotency key,
- request payload hash,
- rollback pointer,
- started_at,
- finished_at,
- run state,
- result summary,
- audit event ids.

Execution run records are blocked until the owner approves the production approval/audit migration and protected execution gate.

## Approval Queue

Endpoint:

- `GET /api/bridge/approval-requests`

Required role:

- `viewer` or stronger.

Query parameters:

- `state=pending|approved|denied|expired|revoked`
- `connector=zapier|n8n|firecrawl|mcp|skills|brain_sync|harness|models|system`
- `limit=50`

Response:

```json
{
  "ok": true,
  "approval_requests": [],
  "summary": {
    "pending": 0,
    "approved": 0,
    "denied": 0,
    "expired": 0,
    "revoked": 0
  }
}
```

## Approval Detail

Endpoint:

- `GET /api/bridge/approval-requests/:id`

Required role:

- `viewer` or stronger.

Response:

```json
{
  "ok": true,
  "approval_request": {
    "id": "apr_...",
    "approval_state": "pending"
  },
  "audit_events": []
}
```

## Approve Request

Endpoint:

- `POST /api/bridge/approval-requests/:id/approve`

Required role:

- `admin` / owner.

Request:

```json
{
  "ttl_minutes": 30,
  "resolution_reason": "Approved by owner for this scoped action."
}
```

Response:

```json
{
  "ok": true,
  "approval_request": {
    "id": "apr_...",
    "approval_state": "approved"
  },
  "action_lock": {
    "id": "lock_...",
    "connector": "zapier",
    "action": "tool.invoke",
    "target": "gmail.send_email",
    "lock_state": "unlocked",
    "expires_at": "2026-04-29T21:30:00.000Z"
  }
}
```

Rules:

- Approving creates a scoped temporary lock.
- Approval does not execute the connector action by itself.
- Audit event `approved` is required once persistence exists.

## Deny Request

Endpoint:

- `POST /api/bridge/approval-requests/:id/deny`

Required role:

- `admin` / owner.

Request:

```json
{
  "resolution_reason": "Denied by owner."
}
```

Response:

```json
{
  "ok": true,
  "approval_request": {
    "id": "apr_...",
    "approval_state": "denied"
  }
}
```

Rules:

- Do not create an action lock.
- Do not execute anything.
- Audit event `denied` is required once persistence exists.

## Approval Audit Trail

Endpoint:

- `GET /api/bridge/audit`

Required role:

- `viewer` or stronger.

Query parameters:

- `connector`
- `action`
- `target`
- `approval_request_id`
- `outcome`
- `limit=100`

Response:

```json
{
  "ok": true,
  "audit_events": [],
  "summary": {
    "blocked": 0,
    "approval_requested": 0,
    "approved": 0,
    "denied": 0,
    "allowed": 0,
    "completed": 0,
    "failed": 0
  }
}
```

Rules:

- Audit event payloads contain hashes and references, not raw secrets.
- High-risk actions include rollback pointer metadata when available.

## Connector Execution Gate

Future execution endpoints must call a shared approval gate before execution:

```ts
const gate = requireBridgeApproval({
  connector,
  action,
  target,
  riskLevel,
  protectedCategory,
  payload,
})

if (!gate.allowed) return gate.response // HTTP 423
```

Gate responsibilities:

- Check current approval contract.
- Compute normalized scope hash.
- Check valid non-expired scoped lock.
- Write blocked/allowed audit event.
- Never execute if approval is absent, expired, denied, or scope mismatched.

## Execution Still Disabled

Until owner separately approves execution backends:

- Zapier writes remain locked.
- n8n workflow execution remains locked.
- FireCrawl memory ingest remains locked.
- MCP tool invocation remains backend-required.
- Skill install/enable/disable remains locked.
- Brain Sync memory writes remain locked.
- Harness production handoff remains locked.
