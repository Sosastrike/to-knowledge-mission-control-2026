# AgentMail Receive Path Stabilization - 2026-06-08

## Scope
- Active runtime: `/home/tony/mission-control`
- Service: `mission-control.service`
- Runtime cwd: `/home/tony/mission-control/.next/standalone`
- Hop type: read-only AgentMail receive/event-console stabilization
- Email sends allowed in this hop: none

## Baseline
- AgentMail runtime: active
- Gateway card: `AgentMail ready · approval-gated sending`
- Per-send state: `no_pending_send_request`
- Auto-send: disabled
- Bulk-send: disabled
- Successful sends before this hop: exactly 1
- Known test send:
  - From: `pi-88@agentmail.to`
  - To: `tony-88@agentmail.to`
  - Message ID: `<0100019ea7fd4af0-a8f11985-9e9f-46db-8562-d14d92773ed1-000000@email.amazonses.com>`
  - Sender-side thread ID: `2e0af429-a1b7-4872-806e-0d97c3166183`

## Changes
- Added a first-class `agentmail_receive_path` status model.
- Added recipient lookup fallbacks that do not assume sender-side and recipient-side thread IDs match.
- Exposed receive-path status through:
  - `/api/agentmail/status`
  - `/api/agentmail/send-access/status`
  - `/api/bridge/agentmail-readiness`
- Updated `/agentmail` Event Console with:
  - Last approved send
  - Sender-side visibility
  - Recipient-side visibility
  - Recipient lookup methods attempted
  - Recipient-visible message/thread IDs when found
  - Provider allowlist status
  - Final receive-path blocker

## Receive Verification Result
- Sender-side visibility: verified
- Recipient read credential: verified, AgentMail read probe returned HTTP 200
- Sender thread ID recipient-visible: false
- Fallback lookup methods attempted:
  - recipient thread by sender-side thread ID
  - recipient message by known Message ID
  - recipient messages list
  - recipient message by subject
  - recipient message by participants
  - recipient message by timestamp window
  - recipient thread by subject/participants
- Recipient-visible message ID: null
- Recipient-visible thread ID: null
- Final receive blocker: `agentmail_received_message_not_visible`

## Provider Allowlist
- Pi allowlist status: `configured_for_tony_88_agentmail_to`
- Agent Zero allowlist status: `provider_allowlist_status_unknown`
- No allowlist was expanded in this hop.

## Safety Proof
- Additional email sent during this hop: no
- Send request created during this hop: no
- Auto-send enabled: no
- Bulk-send enabled: no
- Successful sends after verification: exactly 1
- AgentMail credential exposure: false
- Token exposure: false
- Env value exposure: false
- Raw secret exposure: false
- `.env` / `.env.local`: not modified

## Audit Events
Sanitized audit rows were written for:
- `agentmail_receive_verification_started`
- `agentmail_sender_sent_message_visible`
- `agentmail_recipient_read_credential_verified`
- `agentmail_recipient_thread_lookup_failed`
- `agentmail_recipient_message_lookup_by_message_id`
- `agentmail_recipient_message_lookup_by_subject`
- `agentmail_recipient_message_lookup_by_participants`
- `agentmail_recipient_message_lookup_by_timestamp`
- `agentmail_recipient_thread_lookup_by_participants`
- `agentmail_receive_verification_failed`
- `agentmail_provider_allowlist_status_recorded`
- `agentmail_event_console_updated`

## Verification
- Targeted AgentMail tests: passed, 68 tests
- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- Service restart: passed
- Service active: yes
- Runtime cwd: `/home/tony/mission-control/.next/standalone`
- Route smoke:
  - `/login`: 200
  - `/agentmail` unauthenticated: 401
  - `/api/agentmail/status` unauthenticated: 401
  - `/api/agentmail/send-access/status` unauthenticated: 401
  - `/api/bridge/agentmail-readiness` unauthenticated: 401
- Stale text search: `Bridge Session required to send mail` absent from searched deployed runtime assets
- AgentMail-specific client bundle secret scan: no matches for `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_KEY`, or raw-looking `am_...` key material
- Touched-file secret scan: no matches

## Current State
- AgentMail setup remains ready for approval-gated sending.
- Receive path now reports the exact blocker `agentmail_received_message_not_visible`.
- Event console can show receive verification state without requiring another send.

## Rollback
- Code rollback: revert the receive-path status/event-console commit and rebuild.
- Runtime rollback: no credential or `.env` rollback needed; no secrets or env files changed.
- Service rollback command after code restore:
  - `sudo systemctl restart mission-control.service`
