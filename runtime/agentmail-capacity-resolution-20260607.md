# AgentMail Capacity Blocker Resolution Report

Generated: 2026-06-07T22:05:00Z
Runtime: /home/tony/mission-control
Service: mission-control.service
Branch: codex/agentmail-hosted-connect-20260606

## Root Cause

AgentMail runtime visibility is working, but the remaining AgentMail lock is caused by provider inbox capacity, not by Bridge Session as the primary blocker.

Current exact blocker:

- `agentmail_inbox_limit_exceeded`

This causes the remaining setup blocker:

- `agentmail_inbox_assignment_missing`

Bridge Session remains a later send gate, but it is not the first blocker while required AgentMail inboxes are missing.

## UI / Status Fix

Updated owner-facing surfaces so capacity outranks Bridge Session until the inbox setup gates are complete:

- `/api/agentmail/connect/status` now reports `current_blocker: agentmail_inbox_limit_exceeded` when the recent provisioning audit shows AgentMail inbox-limit failures and required inboxes are still missing.
- `/api/bridge/agentmail-readiness` now reports `blocker_class: CAPACITY_GATED` and `current_primary_blocker: agentmail_inbox_limit_exceeded`.
- Gateway AgentMail card copy now says `AgentMail inbox limit exceeded` and lists the five blocked Mission Control inboxes.
- `/agentmail` now includes an `AgentMail Capacity` panel with counts, blocked inboxes, and safe resolution options.

## Live Capacity State

- Live inboxes visible to Mission Control: 3.
- Required target inboxes: 6.
- Provisioned/synced in Mission Control registry: 1.
- Blocked by provider limit: 5.

Provisioned/synced:

- `gateway@agentmail.to`

Blocked inboxes:

- `pi@agentmail.to`
- `agent-zero@agentmail.to`
- `bridge-unit@agentmail.to`
- `agentmail-monitor@agentmail.to`
- `agentmail-audit@agentmail.to`

## Capacity Resolution Options

Option A: increase AgentMail inbox limit / upgrade plan / request capacity, then rerun provisioning.

Option B: reuse existing live inboxes for specific Mission Control agents only after explicit owner-approved mapping. Mission Control does not silently reuse shared inboxes.

Option C: delete unrelated inboxes directly from the hosted AgentMail console, then rerun provisioning. Mission Control does not delete AgentMail inboxes automatically.

## Owner Decision Route

Added protected route:

- `POST /api/agentmail/connect/capacity-resolution`

Authenticated smoke result:

- route returns 200 with `exact_blocker: agentmail_capacity_resolution_owner_decision_required`.
- preview includes current live inboxes, target count, provisioned inboxes, blocked inboxes, recommended resolution, and alternate reuse mapping path.
- unauthenticated route returns 401.

## Safety Proof

No email was sent:

- `agentmail_send_requests` rows in `dispatched` or `sent`: 0.

No scoped credentials were created:

- `agentmail_scoped_credentials` rows: 0.

No automatic deletion or reuse happened:

- no AgentMail inbox delete action was implemented or executed.
- no reuse mapping apply route was implemented or executed.
- no registry row was reassigned in this hop.

No `.env` or `.env.local` changes:

- tracked env diff is empty.

No send unlock:

- `send_enabled:false`.
- `execution_enabled:false`.
- send remains locked until scoped credentials, message_send permission, owner approval, active AgentMail Action Bridge Session, Gateway policy clearance, and audit context exist.

## Audit Events

Sanitized audit events added/used:

- `agentmail_inbox_limit_exceeded`
- `agentmail_capacity_resolution_required`
- `agentmail_capacity_resolution_previewed`
- `agentmail_capacity_resolution_requested`

No audit event intentionally logs AgentMail API keys, OAuth tokens, Google credentials, cookies, authorization headers, Provider Vault material, webhook secrets, raw secret paths, or browser sessions.

## Verification

Targeted AgentMail tests:

- `pnpm exec vitest run src/lib/agentmail-*.test.ts src/lib/jarvis-agentmail-draft-adapter.test.ts`
- Result: 8 files passed, 70 tests passed.

Typecheck:

- `pnpm run typecheck`
- Result: passed.

Build:

- `pnpm run build`
- Result: passed. Standalone assets synced.

Route smoke after restart:

- `mission-control.service`: active.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.
- `GET /login`: 200.
- `GET /agentmail` unauthenticated: 307 login redirect.
- `POST /api/agentmail/connect/capacity-resolution` unauthenticated: 401.
- `GET /api/bridge/agentmail-readiness` unauthenticated: 401.
- Authenticated `/api/agentmail/connect/status`: 200, `current_blocker: agentmail_inbox_limit_exceeded`.
- Authenticated `/api/bridge/agentmail-readiness`: 200, `blocker_class: CAPACITY_GATED`, `blocked_by_provider_limit: 5`.
- Authenticated `/api/agentmail/connect/capacity-resolution`: 200, owner decision required, no send, no scoped credentials.

Secret scans:

- touched-file scan: no raw AgentMail credential or bearer-token value. False positives were a test-only Mission Control master-key env var name and an existing `am_` substring in Gateway copy.
- client bundle scan: no AgentMail bearer-token pattern, no AgentMail env assignment, no Provider Vault material. Two 16-character UI identifier-like `am_...` regex hits appeared in static bundle (`prefix=am_a`, `suffix=nect`, fingerprint `78aff1c48eb4`); not AgentMail credentials.

## Files Changed

- `src/lib/agentmail-capacity-status.ts`
- `src/lib/agentmail-capacity-status.test.ts`
- `src/lib/agentmail-local-control.ts`
- `src/lib/agentmail-api-routes.test.ts`
- `src/app/agentmail/page.tsx`
- `src/app/agentmail/AgentMailConnectActions.tsx`
- `src/app/api/agentmail/connect/capacity-resolution/route.ts`
- `src/app/api/bridge/agentmail-readiness/route.ts`
- `src/components/gateway/GatewayShell.tsx`
- `runtime/agentmail-capacity-resolution-20260607.md`

## Commit / Push

Pending at report creation.

## Rollback

After commit:

```bash
git revert <agentmail-capacity-resolution-commit>
sudo systemctl restart mission-control.service
```

This rollback only reverts code/UI/status changes from this hop. It does not delete AgentMail inboxes or mutate external AgentMail state.
