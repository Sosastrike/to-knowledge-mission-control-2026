# AgentMail Inbox Provisioning Approval + Apply Report

Generated: 2026-06-07T20:57:00Z
Runtime: /home/tony/mission-control
Service: mission-control.service
Branch: codex/agentmail-hosted-connect-20260606

## Scope

This hop was inbox provisioning/sync only. No email send, scoped credential creation, auto-send enablement, Zapier write, HeyGen write, broad connector execution, SMB mount, external farmer, `.env` edit, or `.env.local` edit was performed.

## Live AgentMail Proof

- Bootstrap credential visibility: resolved through Mission Control Provider Vault reference.
- Raw key in env: no.
- Safe inbox-list probe: HTTP 200.
- AgentMail endpoint used: `https://api.agentmail.to/v0/inboxes`.
- Auth header proof: present for server-side probe; value not printed or stored in this report.
- Credential exposure flags: `credential_values_exposed:false`, `tokens_exposed:false`, `env_values_exposed:false`, `raw_secret_values_exposed:false`.

## Live Inbox Count

- Before this provisioning hop: 2 live AgentMail inboxes visible.
- After first approved apply: 3 live AgentMail inboxes visible.
- Current live inboxes visible to Mission Control:
  - `gateway@agentmail.to` / display `Gateway` / client id `mission-gateway-inbox-v1`.
  - `itt@agentmail.to` / display `ITT_AGENT` / existing live inbox, not modified.
  - `tony-88@agentmail.to` / display `Chief-Tony88` / existing live inbox, not modified.

## Approval + Apply Result

Owner approval flow was exercised for approval type `agentmail_inbox_provisioning`.

- Approval request created: yes.
- Approval applied before provisioning mutation: yes.
- Automatic provisioning before approval: no.
- Duplicate creation check: enabled by email, client id, metadata agent id, and inbox id.

## Inboxes Matched / Reused

- Reused/synced: `gateway@agentmail.to`.
- Registry row updated: `gateway` -> `gateway@agentmail.to`, provision state `assigned`.

## Inboxes Created

- Created during first approved apply: `gateway@agentmail.to`.
- Created during final retry: none.

## Inboxes Skipped / Blocked

The remaining target inboxes could not be created because AgentMail returned HTTP 403 with sanitized upstream message `Inbox limit exceeded`.

- Pi: `pi@agentmail.to` -> `agentmail_inbox_limit_exceeded`.
- Agent Zero: `agent-zero@agentmail.to` -> `agentmail_inbox_limit_exceeded`.
- Bridge Unit: `bridge-unit@agentmail.to` -> `agentmail_inbox_limit_exceeded`.
- Mission Control Monitor: `agentmail-monitor@agentmail.to` -> `agentmail_inbox_limit_exceeded`.
- Audit Archive: `agentmail-audit@agentmail.to` -> `agentmail_inbox_limit_exceeded`.

No existing live AgentMail inbox was renamed or deleted.

## Final Registry State

- `gateway`: `gateway@agentmail.to`, state `assigned`.
- `pi`: no inbox address, state `not_provisioned`.
- `agent_zero`: no inbox address, state `not_provisioned`.
- `bridge_unit`: no inbox address, state `not_provisioned`.
- `agentmail_monitor`: no inbox address, state `not_provisioned`.
- `agentmail_audit`: no inbox address, state `not_provisioned`.

## Current Blockers

Current primary blocker from send-access surface:

- `agentmail_inbox_assignment_missing`.

Full blocker list observed after partial provisioning:

- `agentmail_inbox_assignment_missing`.
- `agentmail_inbox_not_provisioned`.
- `agentmail_inbox_address_missing`.
- `agentmail_inbox_credential_required`.
- `message_send_permission_missing`.
- `owner_approval_required`.
- `action_bridge_session_inactive`.

AgentMail connect/status also reports `status: inbox_sync_complete` and `current_blocker: action_bridge_session_inactive` because at least one inbox is synced and send remains approval/Bridge gated. The send-access readiness surface is more specific for the remaining agent registry gap and reports missing inbox assignment for Pi, Agent Zero, Bridge Unit, Monitor, and Audit.

## No Scoped Credentials Created

- `agentmail_scoped_credentials` row count: 0.
- No per-agent send credential was created.
- No scoped credential was printed, returned to browser, logged, or written to `.env`.

## No Email Sent

- `agentmail_send_requests` rows with state `dispatched` or `sent`: 0.
- No AgentMail send adapter dispatch was called for a real email send in this hop.

## Audit Events Created

Sanitized audit events observed include:

- `agentmail_live_inbox_preview_started`.
- `agentmail_live_inbox_preview_completed`.
- `agentmail_inbox_deduplication_completed`.
- `agentmail_inbox_provisioning_requested`.
- `agentmail_inbox_provisioning_approved`.
- `agentmail_inbox_provisioning_started`.
- `agentmail_inbox_reused`.
- `agentmail_inbox_created`.
- `agentmail_inbox_registry_synced`.
- `agentmail_inbox_provisioning_completed`.
- `agentmail_inbox_provisioning_failed`.
- `agentmail_scoped_credentials_required`.
- `agentmail_action_bridge_session_required`.

No audit detail intentionally contains AgentMail API keys, OAuth tokens, Google credentials, cookies, authorization headers, Provider Vault material, webhook secrets, raw secret paths, or browser sessions.

## Verification

Targeted tests:

- `pnpm exec vitest run src/lib/agentmail-inbox-provisioning.test.ts src/lib/agentmail-api-routes.test.ts src/lib/agentmail-credential-resolver.test.ts src/lib/agentmail-local-control.test.ts`
- Result: 4 files passed, 58 tests passed.

Typecheck:

- `pnpm run typecheck`
- Result: passed.

Build:

- `pnpm run build`
- Result: passed. `.next/static` and `public` synced into `.next/standalone`.

Route smoke after restart:

- `mission-control.service`: active.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.
- `GET /login`: 200.
- `GET /agentmail` unauthenticated: 307 login redirect.
- `POST /api/agentmail/connect/provision-preview` unauthenticated: 401.
- `POST /api/agentmail/connect/provision-apply` unauthenticated: 401.
- Authenticated API smoke: `/api/agentmail/connect/status`, `/api/agentmail/connect/provision-preview`, and `/api/agentmail/send-access/status` return 200 using server-side auth internally; key value not printed.

Secret safety scans:

- Touched source files: no raw AgentMail key-like values, no AgentMail bearer-token patterns, no AgentMail env assignments. Two test files reference the Mission Control secrets master-key env var name as a test fixture only.
- Client bundle: no AgentMail bearer-token patterns, no AgentMail env assignments, no Provider Vault material. Two 16-character UI identifier-like strings matched `am_...` regex (`prefix=am_a`, `suffix=nect`); these are not AgentMail credentials.
- `.env` and `.env.local` tracked diff: no changes.
- `git diff --check`: passed for touched files.

## Files Changed

- `src/lib/agentmail-credential-resolver.ts`
- `src/lib/agentmail-inbox-provisioning.ts`
- `src/lib/agentmail-inbox-provisioning.test.ts`
- `src/lib/agentmail-api-routes.test.ts`
- `src/lib/agentmail-local-control.ts`
- `src/lib/agentmail-local-control.test.ts`
- `src/app/agentmail/AgentMailConnectActions.tsx`
- `src/app/api/agentmail/connect/provision-preview/route.ts`
- `src/app/api/agentmail/connect/provision-request/route.ts`
- `src/app/api/agentmail/connect/provision-approve/route.ts`
- `src/app/api/agentmail/connect/provision-apply/route.ts`
- `runtime/agentmail-inbox-provisioning-20260607.md`

## Next Required Owner Action

AgentMail account capacity must be adjusted before the remaining Mission Control inboxes can be provisioned. The exact blocker is `agentmail_inbox_limit_exceeded` from AgentMail for five target inboxes.

Safe options:

1. Increase AgentMail inbox quota/capacity for the organization.
2. Remove unrelated AgentMail inboxes from AgentMail directly if they are no longer needed.
3. Explicitly approve reusing existing live inboxes for specific Mission Control agents if those inboxes are intended for that purpose.

After capacity is available, rerun inbox provisioning apply. Scoped credentials remain a separate later hop.

## Rollback

Code rollback after commit:

```bash
git revert <agentmail-inbox-provisioning-commit>
sudo systemctl restart mission-control.service
```

Registry rollback for the synced Gateway row only, if owner wants the Mission Control registry returned to pre-hop state:

```bash
sqlite3 /home/tony/mission-control/.data/mission-control.db "UPDATE agentmail_inboxes SET inbox_address=NULL, provision_state='not_provisioned', agentmail_inbox_id=NULL, agentmail_pod_id=NULL, agentmail_organization_id=NULL, agentmail_metadata_json=NULL, agentmail_synced_at=NULL WHERE agent_id='gateway';"
sudo systemctl restart mission-control.service
```

Hosted AgentMail inbox deletion was not performed and should not be performed without explicit owner approval.
