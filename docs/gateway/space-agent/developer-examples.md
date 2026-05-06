# Space Agent Developer Examples

Last verified: 2026-05-06

## Registry Node

```json
{
  "id": "space_agent",
  "name": "Space Agent",
  "type": "specialist_agent",
  "status": "read_only",
  "connected": false,
  "configured": false,
  "read_enabled": true,
  "write_enabled": false,
  "execution_enabled": false,
  "requires_bridge_session": true,
  "blocked_reason": "space_agent_live_adapter_not_configured"
}
```

## Research Route

```json
{
  "source": "gateway",
  "target": "space_agent",
  "requested_action": "web_research",
  "selected_route": "space_agent_research",
  "policy_result": "allowed_read_only",
  "status": "planned"
}
```

## Blocked Delivery Route

```json
{
  "source": "space_agent",
  "target": "gateway_delivery_adapter",
  "requested_action": "send_email",
  "policy_result": "blocked",
  "status": "blocked",
  "blocked_reason": "space_agent_email_send_forbidden_handoff_to_gateway_delivery_adapter_required"
}
```

## Research Packet Skeleton

```json
{
  "job_id": "gateway-managed-id",
  "original_request": "Research the provided source.",
  "assigned_supervisor": "agent_zero",
  "sources": [],
  "findings": [],
  "confidence": "unknown",
  "evidence": [],
  "citations": [],
  "blockers": [],
  "recommended_next_agent": "agent_zero"
}
```

## Implementation Notes

- Do not expose local filesystem paths in API responses.
- Do not log secrets, auth files, cookies, tokens, or session headers.
- Do not wire public Space Agent UI exposure without auth review.
- Keep Space Agent status honest when live adapters are missing.
