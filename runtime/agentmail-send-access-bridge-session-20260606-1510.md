# AgentMail Send Access + Bridge Session Wiring Report

Generated: 2026-06-06T15:10:05-04:00
Active runtime: /home/tony/mission-control
Service: mission-control.service
Runtime cwd: /home/tony/mission-control/.next/standalone

## Files Changed
- src/lib/agentmail-local-control.ts
- src/lib/agentmail-local-control.test.ts
- src/lib/agentmail-api-routes.test.ts
- src/app/agentmail/page.tsx
- src/app/agentmail/AgentMailConnectActions.tsx
- src/app/api/agentmail/send-access/status/route.ts
- src/app/api/agentmail/bridge-session/{status,request,approve,revoke}/route.ts
- src/app/api/agentmail/send/{preview,request,approve,dispatch}/route.ts

## Behavior
- Added AgentMail send-access status model with per-agent inbox, credential, permission, policy, Bridge Session, and readiness blockers.
- Added protected Bridge Session status/request/approve/revoke routes.
- Added protected send preview/request/approve/dispatch routes.
- Direct approve endpoints remain canonical-owner-channel gated; Mission Control does not create a duplicate approval decision system.
- Dispatch remains blocked unless canonical message approval, active Bridge Session, scoped credential, permission proof, and Gateway policy all pass.
- UI now shows Send Access, Bridge Session status, Agent Send Readiness, Permission Matrix, and Safe Send Test stages.
- Added client buttons for Request Bridge Session and Revoke Bridge Session; these do not expose credentials and do not dispatch mail.

## Current Readiness Truth
- Send default: approval_required.
- Pi and Agent Zero can be evaluated for approval-gated send readiness, but send_ready remains false until inbox assignment, scoped credential, permissions, canonical approval, and Bridge Session are all valid.
- Gateway, Bridge Unit, Monitor, and Audit remain control-plane/no-send by default.
- Generic Bridge Session copy is replaced with exact blockers such as bridge_session_inactive, owner_approval_required, message_send_permission_missing, wrong_agent_inbox, and gateway_policy_monitor_only.

## Verification
- AgentMail targeted tests: PASS, 33 tests.
- Typecheck: PASS.
- Production build: PASS.
- Route smoke:
  - /login -> 200
  - /agentmail unauthenticated -> 307 login redirect
  - /api/agentmail/send-access/status unauthenticated -> 401
  - /api/agentmail/bridge-session/status unauthenticated -> 401
  - /api/agentmail/send/dispatch unauthenticated -> 401
- Service restart: PASS, mission-control.service active.
- Service cwd: /home/tony/mission-control/.next/standalone.
- git diff --check on touched AgentMail files: PASS.
- .env diff: clean; no .env or .env.local edits were made.

## Secret Safety
- credential_values_exposed:false remains on new status and send payloads.
- No AgentMail API keys, OAuth tokens, Google credentials, cookies, authorization headers, or webhook secrets are logged or rendered.
- Touched-file secret scan returned no raw secret-like values.
- Provider/AgentMail keys were not added to .env.

## Rollback
Revert the AgentMail commit from this branch, rebuild, and restart only mission-control.service:

    git revert <commit_sha>
    pnpm run build
    sudo systemctl restart mission-control.service
