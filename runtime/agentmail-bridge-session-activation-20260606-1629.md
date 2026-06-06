# AgentMail Bridge Session Activation Report

Generated: 2026-06-06T20:29:48Z
Active runtime: /home/tony/mission-control
Service: mission-control.service
Runtime cwd: /home/tony/mission-control/.next/standalone

## Summary
Implemented the AgentMail owner Bridge Session activation path and owner message-approval path without enabling unrestricted sending. Dispatch still remains blocked unless the request has owner approval, an active AgentMail Bridge Session, correct inbox assignment, scoped credentials, required message_send permission, recipient limits, and a real AgentMail send adapter.

## Files changed
- src/lib/agentmail-local-control.ts
- src/lib/agentmail-local-control.test.ts
- src/app/api/agentmail/bridge-session/approve/route.ts
- src/app/api/agentmail/send/approve/route.ts

## Route behavior
- POST /api/agentmail/bridge-session/approve now requires mission_control_owner_operator auth and activates the latest pending AgentMail Bridge Session.
- POST /api/agentmail/send/approve now requires mission_control_owner_operator auth and marks a send request owner-approved.
- GET /api/agentmail/send-access/status remains protected.
- GET /api/agentmail/bridge-session/status remains protected.

## Bridge Session behavior
- Request state starts pending_owner_approval.
- Owner approval changes the latest session to active and sets/extends a 60-minute expiry.
- Active Bridge Session does not enable unrestricted dispatch.
- execution_enabled remains false at the provider/session layer.
- dispatch_enabled remains false until every send-specific gate passes.

## Send dispatch gates
Dispatch checks these blockers in order:
1. bridge_session_inactive / expired / revoked
2. owner_approval_required
3. agentmail_inbox_assignment_missing
4. wrong_agent_inbox
5. agentmail_inbox_credential_required
6. message_send_permission_missing
7. recipient_count_exceeds_limit
8. agentmail_send_adapter_not_configured

Current safe-send test result: with an active Bridge Session and owner-approved message, dispatch remains blocked at agentmail_inbox_credential_required when scoped AgentMail inbox credentials are not present. No email was sent.

## Agent readiness
- Pi: approval-gated path exists; send-ready only after inbox, scoped credential, permissions, owner approval, active Bridge Session, and real adapter.
- Agent Zero: approval-gated path exists; same gates as Pi.
- Gateway: control-plane / monitor-only; no external send by default.
- Bridge Unit: dispatch/control plane only; no general external send.
- Mission Control Monitor: no-send.
- Audit Archive: no-send.

## Verification
- Targeted tests: pnpm exec vitest run src/lib/agentmail-local-control.test.ts src/lib/agentmail-api-routes.test.ts => 35 passed.
- Typecheck: pnpm run typecheck => passed.
- Build: pnpm run build => passed and standalone static sync completed.
- git diff --check => passed.
- Service restart: sudo systemctl restart mission-control.service => active.
- Runtime cwd after restart: /home/tony/mission-control/.next/standalone.
- Route smoke: /login => 200.
- Route smoke: /agentmail unauthenticated => 401.
- Route smoke: /api/agentmail/send-access/status unauthenticated => 401.
- Route smoke: /api/agentmail/bridge-session/status unauthenticated => 401.
- Route smoke: POST /api/agentmail/bridge-session/approve unauthenticated => 401.

## Authenticated proof
No owner browser session or owner bearer token was available in the shell, so authenticated production mutation smoke was not executed from CLI. The owner-gated route behavior is covered by targeted route/helper tests, and unauthenticated production routes reject with 401.

## Secret safety
- No .env or .env.local changes were made.
- Touched-file secret scan: clean.
- No AgentMail API key, OAuth token, cookie, authorization header value, webhook secret, or Google credential was printed or stored in this report.
- Bundle scan note: a generic third-party static chunk contains a literal Bearer template for its own analytics helper; no AgentMail secret value was detected in touched files or AgentMail route/client code.

## Rollback
Revert the scoped commit that contains these AgentMail Bridge Session activation changes, rebuild, then restart only mission-control.service:


- cd /home/tony/mission-control
- git revert <commit-sha>
- PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:/home/tony/bin:$PATH pnpm run build
- sudo systemctl restart mission-control.service
