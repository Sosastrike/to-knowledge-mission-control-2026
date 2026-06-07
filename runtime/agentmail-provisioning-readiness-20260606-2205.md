# AgentMail Owner Connection + Provisioning Readiness Report

## Summary
Implemented the provisioning-readiness hop without unlocking sends. Mission Control now exposes richer AgentMail inbox sync/provisioning preview data and a protected inbox provisioning approval-request route. No inboxes were provisioned, no scoped credentials were created, no email was sent, and no environment files were changed.

## Files Changed
- `src/lib/agentmail-local-control.ts`
- `src/app/agentmail/AgentMailConnectActions.tsx`
- `src/app/api/agentmail/connect/test/route.ts`
- `src/app/api/agentmail/connect/sync/route.ts`
- `src/app/api/agentmail/connect/provision-request/route.ts`
- `src/lib/agentmail-local-control.test.ts`
- `src/lib/agentmail-api-routes.test.ts`

## Routes Added/Changed
- Added `POST /api/agentmail/connect/provision-request`.
- Updated `POST /api/agentmail/connect/test` to audit runtime-visible vs runtime-not-visible connection truth.
- Updated `POST /api/agentmail/connect/sync` to avoid stale Bridge-primary blocker wording.
- Updated `POST /api/agentmail/connect/provision-preview` data shape through the shared preview builder.

## Preview Behavior
`buildAgentMailInboxSyncPreview` now reports:
- connection state
- runtime visibility
- organization selected state
- available/existing inboxes
- known Mission Control agents
- missing inbox addresses
- proposed inbox assignments
- provisioning plan
- required scoped credentials
- required permissions
- bridge routing preview
- `mutation_enabled:false`
- `send_enabled:false`

## Provisioning Request Behavior
`POST /api/agentmail/connect/provision-request` creates only an owner approval request for `agentmail_inbox_provisioning` and returns preview data. It does not provision inboxes, create scoped credentials, or send email.

## Current Expected Blocker
Until owner connection is visible to `mission-control.service`, the expected primary blocker remains:
- `agentmail_owner_sso_or_api_key_required`

If owner-side AgentMail connection becomes visible but inboxes remain absent, the expected next primary blocker is:
- `agentmail_inbox_not_provisioned`

If inboxes are provisioned but scoped credentials are missing, the expected next primary blocker is:
- `agentmail_inbox_credential_required`

## Verification
- Targeted AgentMail tests: passed (`50` tests).
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `git diff --check`: passed.
- `/login`: `200`.
- `/agentmail`: `401` unauthenticated/protected.
- `/api/agentmail/status`: `401` unauthenticated/protected.
- `/api/agentmail/connect/provision-preview`: `401` unauthenticated/protected.
- `/api/agentmail/connect/provision-request`: `401` unauthenticated/protected.
- `/api/agentmail/credentials/provision-preview`: `401` unauthenticated/protected.
- `.env` diff lines: `0`.
- Touched-file secret scan: no matches.
- `mission-control.service`: active after restart.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.

## Safety Proof
- No Google credentials were requested or handled.
- No cookies, OAuth tokens, AgentMail API keys, authorization headers, or webhook secrets were logged.
- No raw secret paths were included.
- No `.env` or `.env.local` change was made.
- No email was sent.
- No inboxes were provisioned.
- No scoped credentials were created.
- Send remains owner-approved and Action Bridge gated.

## Remaining Owner/Runtime Blocker
The owner must complete AgentMail hosted connection/API-key fallback in a way visible to `mission-control.service`. If that still does not appear in Mission Control after owner login, the exact blocker is `agentmail_connection_not_visible_to_runtime`.

## Rollback
```bash
git revert <commit_sha>
cd /home/tony/mission-control
pnpm run build
sudo systemctl restart mission-control.service
```
