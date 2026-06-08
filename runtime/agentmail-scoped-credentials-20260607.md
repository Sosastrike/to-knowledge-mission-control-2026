# AgentMail Scoped Credentials Provisioning - 2026-06-07

## Scope

- Active runtime: `/home/tony/mission-control`
- Service: `mission-control.service`
- Branch: `codex/agentmail-hosted-connect-20260606`
- Hop: scoped per-agent AgentMail credential provisioning
- Email sent: false
- Auto-send enabled: false
- `.env` / `.env.local` modified: false

## Credential Provisioning Result

The owner-approved AgentMail scoped credential provisioning flow was implemented and applied.

- Preview result: six assigned/synced inboxes were eligible for scoped credential provisioning.
- Owner approval result: approved through the existing Mission Control approval path.
- Credentials created: 6
- Credentials stored in Provider Vault/runtime secret store: 6
- Credentials failed in final apply: 0
- Scoped credentials created: true
- Raw credential values exposed: false

## Credential Refs

Only masked previews are recorded here.

| Agent | Inbox | Credential ref | Status | Masked preview | Send posture |
| --- | --- | --- | --- | --- | --- |
| Pi | `pi-88@agentmail.to` | `AGENTMAIL_INBOX_KEY_PI` | scoped | `am_****55bc` | approval-gated send candidate |
| Agent Zero | `jarvis88@agentmail.to` | `AGENTMAIL_INBOX_KEY_AGENT_ZERO` | scoped | `am_****bd79` | approval-gated send candidate |
| Gateway | `gateway@agentmail.to` | `AGENTMAIL_INBOX_KEY_GATEWAY` | scoped | `am_****c5dd` | control-plane, no normal external send |
| Bridge Unit | `bridge-unit@agentmail.to` | `AGENTMAIL_INBOX_KEY_BRIDGE_UNIT` | scoped | `am_****927e` | dispatch/control-plane only |
| Mission Control Monitor | `tony-88@agentmail.to` | `AGENTMAIL_INBOX_KEY_MONITOR` | scoped | `am_****9aad` | no-send |
| Audit Archive | `audit-88@agentmail.to` | `AGENTMAIL_INBOX_KEY_AUDIT_ARCHIVE` | scoped | `am_****6ad9` | no-send |

## Permission Status

| Agent | inbox_read | thread_read | message_read | message_send | message_update | draft_read | draft_create | draft_update | draft_send |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Pi | true | true | true | true | true | true | true | true | true |
| Agent Zero | true | true | true | true | true | true | true | true | true |
| Gateway | true | true | true | false | true | false | false | false | false |
| Bridge Unit | true | true | true | false | true | false | false | false | false |
| Mission Control Monitor | true | true | true | false | false | false | false | false | false |
| Audit Archive | true | true | true | false | false | false | false | false | false |

## Readiness After Provisioning

- Pi readiness: credential present and send permissions verified; still blocked by `owner_approval_required` and `action_bridge_session_inactive`.
- Agent Zero readiness: credential present and send permissions verified; still blocked by `owner_approval_required` and `action_bridge_session_inactive`.
- Gateway verification: scoped credential present; normal external send disabled by missing `message_send`.
- Bridge Unit verification: scoped credential present; dispatch/control-plane only, no normal external send by default.
- Monitor verification: scoped credential present; no-send.
- Audit Archive verification: scoped credential present; no-send.

Current primary blocker: `owner_approval_required`

Full current blocker list:

- `owner_approval_required`
- `action_bridge_session_inactive`

The previous primary blocker `agentmail_inbox_credential_required` is cleared for the six assigned inboxes.

## No-Send Proof

- `agentmail_send_requests` count: 0
- AgentMail send dispatch audit events: 0
- AgentMail blocked/failed send audit events from this hop: 0
- No message send request was created.
- No message approval was created.
- No AgentMail Action Bridge Session was activated for dispatch.
- No email was sent.

## Audit Events

Sanitized AgentMail audit events were written for preview, provisioning request/approval, create, store, resolve, permission verification, and completion.

Observed final successful-event counts:

- `agentmail_scoped_credential_created`: 6
- `agentmail_scoped_credential_stored`: 6
- `agentmail_scoped_credential_resolved`: 6
- `agentmail_scoped_credential_permission_verified`: 6

Earlier failed attempts are retained as sanitized audit history; their invalid placeholder Provider Vault rows were deactivated and are not active.

## Verification

- Targeted AgentMail tests: passed, 5 files / 66 tests
- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- `mission-control.service`: active/running
- Runtime cwd: `/home/tony/mission-control/.next/standalone`
- Route smoke:
  - `/login`: 200
  - `/agentmail`: 401 unauthenticated
  - `/api/agentmail/send-access/status`: 401 unauthenticated
  - `/api/agentmail/credentials/provision-preview`: 401 unauthenticated
  - `/api/agentmail/credentials/provision-apply`: 401 unauthenticated

## Secret Safety

- Raw AgentMail bootstrap key exposed: false
- Raw scoped inbox keys exposed: false
- Browser/client bundle strict secret scan: clean
- Touched-file scan only matched synthetic test fixtures used to verify redaction.
- Provider Vault rows contain masked previews only in metadata.
- `.env` and `.env.local` were not modified by this hop.
- No credentials were passed as CLI arguments.
- No credentials were written to browser storage.

## Files Changed

- `src/lib/agentmail-credential-resolver.ts`
- `src/lib/agentmail-local-control.ts`
- `src/app/api/agentmail/credentials/provision-apply/route.ts`
- `src/lib/agentmail-credential-resolver.test.ts`
- `src/lib/agentmail-local-control.test.ts`
- `runtime/agentmail-scoped-credentials-20260607.md`

## Rollback

Runtime credential rollback, if the owner requests it:

```bash
cd /home/tony/mission-control
sqlite3 .data/mission-control.db "UPDATE provider_secrets SET active=0, rotated_at=unixepoch() WHERE provider_id='agentmail' AND env_var_name IN ('AGENTMAIL_INBOX_KEY_PI','AGENTMAIL_INBOX_KEY_AGENT_ZERO','AGENTMAIL_INBOX_KEY_GATEWAY','AGENTMAIL_INBOX_KEY_BRIDGE_UNIT','AGENTMAIL_INBOX_KEY_MONITOR','AGENTMAIL_INBOX_KEY_AUDIT_ARCHIVE') AND active=1; UPDATE agentmail_scoped_credentials SET active=0, status='invalid', exact_blocker='rolled_back_by_owner' WHERE active=1;"
sudo systemctl restart mission-control.service
```

Code rollback after commit:

```bash
cd /home/tony/mission-control
git revert <commit_sha>
sudo systemctl restart mission-control.service
```
