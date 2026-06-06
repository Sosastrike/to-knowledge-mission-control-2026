# AgentMail Scoped Credentials + Send Adapter Report

Generated: 2026-06-06T23:21:04Z
Active runtime: /home/tony/mission-control
Service: mission-control.service
Runtime cwd: /home/tony/mission-control/.next/standalone

## Summary
Implemented the server-side AgentMail scoped credential resolver and real AgentMail send adapter path while preserving all Mission Control gates. Real dispatch now has an adapter capable of calling AgentMail server-side, but it is still blocked in this runtime until scoped AgentMail inbox credential metadata and runtime secret material exist for each send-capable inbox.

## Files changed
- src/lib/agentmail-credential-resolver.ts
- src/lib/agentmail-send-adapter.ts
- src/lib/agentmail-local-control.ts
- src/lib/agentmail-local-control.test.ts
- src/lib/agentmail-send-adapter.test.ts
- src/lib/agentmail-api-routes.test.ts
- src/app/api/agentmail/send/dispatch/route.ts
- src/app/api/agentmail/credentials/provision-preview/route.ts
- src/app/api/agentmail/credentials/provision-request/route.ts
- src/app/api/agentmail/credentials/provision-approve/route.ts
- src/app/api/agentmail/credentials/provision-apply/route.ts
- src/app/agentmail/page.tsx

## Routes added or changed
- POST /api/agentmail/credentials/provision-preview
- POST /api/agentmail/credentials/provision-request
- POST /api/agentmail/credentials/provision-approve
- POST /api/agentmail/credentials/provision-apply
- POST /api/agentmail/send/dispatch now awaits the adapter path and returns success only when the adapter returns a real message result.

## Adapter behavior
- Server-only adapter added at src/lib/agentmail-send-adapter.ts.
- Send endpoint: https://api.agentmail.to/v0/inboxes/:inbox_id/messages/send.
- Supports new message send, reply helper, credential test helper, and sanitized error mapping.
- Adapter never returns the raw AgentMail key.
- Adapter errors map to Mission Control blockers such as scoped_credential_invalid, message_send_permission_missing, agentmail_inbox_or_message_not_found, agentmail_rate_limited, and agentmail_service_unreachable.

## Credential resolver behavior
- Resolver added at src/lib/agentmail-credential-resolver.ts.
- Metadata table: agentmail_scoped_credentials.
- Stores only credential reference, masked preview, inbox scope, status, and permission metadata.
- Runtime key material is read only server-side from the referenced runtime environment key.
- Route payloads expose only masked refs like am_****last4 and no raw secret values.

## Runtime secret storage result
Current runtime still needs approved AgentMail scoped credential injection. Provision apply is intentionally blocked with agentmail_runtime_secret_store_required until an approved server-side secret path exists for the scoped inbox keys. No .env change was made.

## Provision preview/apply result
- Preview route exists and is protected.
- Preview reports existing/missing inboxes, credential refs, detected/missing permissions, and safe next action.
- Apply route does not create keys without an approved runtime secret store because AgentMail returns full keys only once.

## Per-agent readiness
- Pi: approval-gated send path exists; blocked until scoped inbox credential and runtime secret material are present.
- Agent Zero: approval-gated send path exists; blocked until scoped inbox credential and runtime secret material are present.
- Gateway: control-plane / monitor-only, no normal external send.
- Bridge Unit: dispatch/control-plane only, no normal external send.
- Mission Control Monitor: no-send.
- Audit Archive: no-send.

## Safe send test result
- Unit test with mocked adapter proves dispatch stores message_id/thread_id only after active Bridge Session, owner-approved message, correct inbox, scoped credential metadata, runtime secret availability, message_send permission, and recipient limits pass.
- No real email was sent from this runtime during verification.
- No production message_id/thread_id exists from a real AgentMail send in this hop.

## Negative-case blockers verified
- scoped_credential_missing
- agentmail_runtime_secret_store_required
- scoped_credential_wrong_inbox
- message_send_permission_missing
- bridge_session_inactive
- owner_approval_required
- recipient_limit_exceeded

## Verification
- Targeted tests: pnpm exec vitest run src/lib/agentmail-send-adapter.test.ts src/lib/agentmail-local-control.test.ts src/lib/agentmail-api-routes.test.ts => 45 passed.
- Typecheck: pnpm run typecheck => passed.
- Build: pnpm run build => passed and standalone static sync completed.
- git diff --check => passed.
- Service restart: sudo systemctl restart mission-control.service => active.
- Runtime cwd after restart: /home/tony/mission-control/.next/standalone.
- Route smoke: /login => 200.
- Route smoke: /agentmail unauthenticated => 401.
- Route smoke: /api/agentmail/send-access/status unauthenticated => 401.
- Route smoke: /api/agentmail/credentials/provision-preview unauthenticated => 401.
- Route smoke: /api/agentmail/send/dispatch unauthenticated => 401.

## Secret safety
- No .env or .env.local changes were made.
- Touched-file secret scan: clean.
- AgentMail client/server bundle secret scan: clean.
- No AgentMail API key, OAuth token, cookie, authorization header value, webhook secret, Google credential, or browser session was printed or stored in this report.

## Rollback
- cd /home/tony/mission-control
- git revert <commit-sha>
- PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:/home/tony/bin:$PATH pnpm run build
- sudo systemctl restart mission-control.service
