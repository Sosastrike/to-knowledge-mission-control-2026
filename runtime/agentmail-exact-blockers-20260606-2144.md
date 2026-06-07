# AgentMail Exact Blockers Report

## Summary
AgentMail remains locked for real sends, but the owner-facing status no longer collapses to the generic Bridge Session message. The first visible blocker is now the actual setup blocker: `agentmail_owner_sso_or_api_key_required`. Bridge Session is still shown as a later Action Bridge blocker, not the primary cause.

## Files Changed
- `src/lib/agentmail-local-control.ts`
- `src/app/api/agentmail/status/route.ts`
- `src/app/agentmail/page.tsx`
- `src/components/gateway/GatewayShell.tsx`
- `src/lib/agentmail-local-control.test.ts`

## Route/UI Behavior
- `/api/agentmail/status` now includes `setup_status` with primary blocker, blockers, next action, checklist, inbox summary, and credential summary.
- `/api/agentmail/send-access/status` now exposes the same exact setup priority through send access state.
- `/agentmail` now shows an AgentMail Setup checklist before local monitor status.
- Gateway AgentMail card now points to the real setup blockers: owner SSO/API key, inbox provisioning, scoped credential, owner approval, and Action Bridge gates.
- A Back to Gateway and Back to Mission Control path remains available on `/agentmail`.

## Current Runtime Truth
- `agentmail_inboxes` table exists.
- `agentmail_scoped_credentials` table exists.
- `agentmail_audit` table exists.
- `agentmail_bridge_sessions` was not present in the read-only runtime snapshot.
- Inbox total: 6.
- Provisioned inboxes: 0.
- Missing inbox addresses: 6.
- Scoped credential count: 0.

## Current Blocker Order
Primary blocker:
- `agentmail_owner_sso_or_api_key_required`

Secondary blockers:
- `agentmail_inbox_assignment_missing`
- `agentmail_inbox_not_provisioned`
- `agentmail_inbox_address_missing`
- `agentmail_inbox_credential_required`
- `message_send_permission_missing`
- `owner_approval_required`
- `action_bridge_session_inactive`

## Safety Result
- No AgentMail sending was enabled.
- No inboxes were provisioned.
- No scoped credentials were created.
- No `.env` or `.env.local` change was made.
- No raw secrets, tokens, cookies, authorization headers, or env values were printed or stored in this report.

## Verification
- Targeted AgentMail tests: passed (`24` tests).
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `git diff --check`: passed.
- `/login`: `200`.
- `/agentmail`: `401` unauthenticated/protected.
- `/api/agentmail/status`: `401` unauthenticated/protected.
- `/api/agentmail/send-access/status`: `401` unauthenticated/protected.
- Touched-file secret scan: no matches.
- `.env` diff lines: `0`.
- `mission-control.service`: active.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.

## Audit Events Added
The setup evaluator writes sanitized audit records for blocker evaluation, selected primary blocker, selected next action, inbox provisioning required, scoped credentials required, and Action Bridge required. These records contain blocker names only, not secrets.

## Rollback
```bash
git revert <commit_sha>
cd /home/tony/mission-control
pnpm run build
sudo systemctl restart mission-control.service
```
