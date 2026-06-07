# AgentMail Selected Inbox Mapping - 2026-06-07

## Summary
Mission Control now supports an owner-selected live inbox reuse mapping for AgentMail. This avoids creating extra AgentMail inboxes when the owner has already created acceptable inboxes manually.

## Owner-Approved Mapping Applied
- Pi -> `pi-88@agentmail.to`
- Agent Zero -> `jarvis88@agentmail.to`
- Bridge Unit -> `bridge-unit@agentmail.to`
- Mission Control Monitor -> `tony-88@agentmail.to`
- Audit Archive -> `audit-88@agentmail.to`
- Gateway -> `gateway@agentmail.to`

## Runtime Result
- Live AgentMail inbox count observed: 9.
- Registry rows updated: 6.
- Inbox registry state: assigned/synced for all six Mission Control AgentMail rows.
- Current primary blocker: `agentmail_inbox_credential_required`.
- Full remaining blocker list:
  - `agentmail_inbox_credential_required`
  - `message_send_permission_missing`
  - `owner_approval_required`
  - `action_bridge_session_inactive`

## Safety Proof
- Scoped AgentMail credentials created: false.
- Email sent: false.
- Send enabled: false.
- Auto-send enabled: false.
- Raw secret values exposed: false.
- Token values exposed: false.
- Env values exposed: false.
- Browser/client credential exposure: false.

## Routes Added
- `POST /api/agentmail/connect/selected-mapping`

The route is protected and requires Mission Control operator auth. Unauthenticated requests returned `401`.

## Tests
- `pnpm exec vitest run src/lib/agentmail-inbox-provisioning.test.ts`: 6 passed.
- `pnpm exec vitest run src/lib/agentmail-inbox-provisioning.test.ts src/lib/agentmail-api-routes.test.ts src/lib/agentmail-capacity-status.test.ts src/lib/agentmail-local-control.test.ts src/lib/agentmail-credential-resolver.test.ts`: 63 passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `git diff --check`: passed.

## Service Status
- `mission-control.service`: active after restart.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.

## Next Safe Hop
Provision scoped per-agent AgentMail inbox credentials through approved runtime secret storage. Do not send mail until scoped credentials, message permissions, owner approval, Gateway policy, and an active AgentMail Action Bridge Session are all proven.

## Rollback
Revert the selected-mapping route/helper commit, rebuild, restart only `mission-control.service`, and restore previous registry rows from backup if needed.
