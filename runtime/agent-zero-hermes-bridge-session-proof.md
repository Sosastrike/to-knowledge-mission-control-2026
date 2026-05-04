# Agent Zero + Hermes Bridge Session Proof

Date: 2026-05-04

## Scope

This report covers Phases 100-109:

- Open Agent Zero Bridge Session request
- Include Hermes in the Bridge Session model
- Prove no approval spam
- Prove blocked connectors remain blocked
- Prove audit behavior
- Prove expiration behavior
- Prove execution gateway restrictions
- Prove no raw shell, root, Docker socket, or direct secret reads
- Attempt safe end-to-end task through the registered execution gateway
- Commit this Bridge Session proof

No secrets were printed. No `.env` files were modified. No Zapier writes, HeyGen generation, SMB mount, farmer execution, email send, Drive upload, OneDrive upload, raw shell action, Docker socket use, root access, or direct secret read occurred.

## Executive Result

The Bridge Session request path is live and protected. A new Agent Zero Bridge Session approval request was created with a 12-hour scope, and a repeat request reused the pending approval instead of creating approval spam.

The session did **not** become active in production because Mission Control enforces the canonical owner-channel approval policy:

- Direct Mission Control approval route result: blocked
- Reason: `canonical_approval_decisions_are_telegram_only`
- Decision surface: Telegram inline Approve/Deny buttons only
- Execution enabled: false

This is the correct safe outcome. I did not bypass the approval model by editing database state directly.

## Phase Status

| Phase | Status | Result |
| --- | --- | --- |
| 100 - Open Bridge Session | Partial / pending owner-channel approval | Production created a single pending Agent Zero Bridge Session request. It is not active until canonical owner-channel approval occurs. |
| 101 - Include Hermes | Code/test proof passed | The Bridge Session model includes Hermes as lieutenant for planning/design and requires explicit delegation/scope for execution. Production route did not expose Hermes participant details in the response observed during this proof. |
| 102 - No approval spam proof | Passed | Repeating the open-session POST reused the existing pending request with `duplicate_prompt_prevented: true`. |
| 103 - Blocked connector still blocked | Passed by gateway registry/test; live execution blocked pre-approval | Blocked adapters remain blocked and session creation does not make unavailable connectors active. Production cannot execute blocked-connector proof until owner-channel approval activates the session. |
| 104 - Audit proof | Passed for request; active execution audit covered by tests | Production wrote `bridge_session.approval_requested` audit rows. Unit tests prove started/finished audit pairs for active adapter execution. |
| 105 - Expiration proof | Passed by live prior expired session and tests | Production status before the new request showed the prior session as `expired` with execution disabled. Tests cover expiration blocking. |
| 106 - Execution gateway proof | Passed | Execution gateway listed 31 registered adapters and blocks execution without an active Bridge Session. |
| 107 - No raw shell/root proof | Passed | Forbidden action attempt returned blocked; gateway safety flags show raw shell, root, Docker socket, and direct secret reads disabled. |
| 108 - Safe end-to-end task | Blocked live by approval policy | Report creation through the registered adapter returned `active_bridge_session_required`; no report was created and no fake completion was claimed. Active report creation is covered by tests, not production execution. |
| 109 - Commit proof | Completed by this report | This file records the proof set. |

## Production Route Proof

Authenticated route results:

- `GET /api/bridge/agent-zero/bridge-session`: returned status for existing session; previous session was expired.
- `POST /api/bridge/agent-zero/bridge-session`: created one pending approval request.
- Repeated `POST /api/bridge/agent-zero/bridge-session`: reused the pending request and prevented a duplicate prompt.
- `GET /api/bridge/agent-zero/execute`: returned execution gateway registry with 31 adapters.
- `POST /api/bridge/agent-zero/execute` with `agent_zero.report.create`: blocked with `active_bridge_session_required`.
- `POST /api/bridge/agent-zero/execute` with a forbidden raw-shell style action: blocked; no shell was executed.
- `POST /api/bridge/agent-zero/bridge-session/audit` before activation: blocked with `active_bridge_session_required`.
- Direct approval route: blocked with `canonical_approval_decisions_are_telegram_only`.

## Bridge Session Request State

Current production state after the request:

- Latest session present: yes
- Session state: `pending_approval`
- Approval state: `pending`
- Execution enabled: false
- Expiration timestamp present: yes
- Approval resolved: no
- Active execution allowed: no

Audit rows:

- `bridge_session.approval_requested`: 1 session audit event
- Bridge approval audit outcome `approval_requested`: 1 bridge audit event

## Scope and Duration

The production request was opened with this mission scope:

Agent Zero may use registered Mission Control, Bridge/MCP, Brain, Build-Wiki, skills, models, integrations, and delivery adapters for this approved proof mission. Hermes may plan/design only unless explicitly scoped. Duration 12 hours.

Live route summary:

- Allowed tool entries: 10
- Allowed integration entries: 10
- Allowed model entries: 6
- Allowed skill entries: 5
- Blocked scopes included broad shell, Docker socket, root system access, credential exfiltration, auth bypass, SMB mount without a separate SMB phase, and memory write without explicit owner scope.

## Hermes Inclusion

Repository tests confirm Hermes is part of the Bridge Session model:

- Hermes role: lieutenant / skill-workflow specialist
- Default Hermes actions: planning, design, suggestions, workflow planning, integration mapping, failure analysis, and report outlines
- Hermes execution: requires Agent Zero delegation and explicit session scope
- Blocked Hermes actions: raw shell, root access, Docker socket, direct secret read, external email outside allow list, direct Build-Wiki execution, and unregistered adapters

Production route response during this proof did not expose Hermes participant details in the returned session object, so live Hermes participation remains a code/test proof until the production route/build exposes those participant fields or a refreshed production build is verified.

## No Approval Spam

The first POST created the approval request:

- `approval_request_created: true`
- `status: pending_approval`
- `approval_needed: true`

The second POST reused it:

- `approval_request_created: false`
- `duplicate_prompt_prevented: true`
- `no_approval_spam: true`

No repeated owner approval prompts were generated for the same scope.

## Blocked Connector Behavior

The session request did not make blocked connectors active. Because production execution is not active, live adapter calls remain blocked before connector-specific checks run.

The test suite covers active-session behavior for unavailable adapters:

- AgentMail send remains blocked when send connector is not configured.
- Google Drive upload remains blocked when upload connector is not configured.
- OneDrive upload remains blocked when upload connector is not configured.
- MCP tool execution remains blocked when an invocation adapter is not configured.
- Build-Wiki execution is scoped to the registered adapter and does not enable SMB/Fork 2.

## Audit Proof

Production proof:

- Session approval request wrote a Bridge Session audit event.
- Bridge approval request wrote a bridge audit event.
- Pre-active audit POST was blocked with `active_bridge_session_required`.

Test proof:

- Active adapter execution writes started and finished audit events.
- Blocked in-scope actions are audited when an active session exists and an adapter is outside scope.
- Obsidian and MemPalace writes are audited in active-session test coverage.
- Build-Wiki scoped execution is audited in active-session test coverage.

## Expiration Proof

Production proof:

- Before the new request, the latest Bridge Session was read as `expired`.
- Execution was disabled.
- Blocked reason was `bridge_session_expired`.

Test proof:

- Expired sessions block execution.
- Session sync updates expired state and prevents further adapter execution.

## Execution Gateway Proof

Production gateway registry:

- Adapter count: 31
- Execution enabled: false until active Bridge Session
- Safety flags:
  - raw shell: disabled
  - arbitrary filesystem: disabled
  - root: disabled
  - Docker socket: disabled
  - direct secret reads: disabled
  - every execution audited: true
  - result checked: true
  - no fake done: true

Forbidden raw-shell style action result:

- Accepted for execution: false
- Raw shell enabled: false
- Root enabled: false
- Docker socket enabled: false
- Direct secret reads enabled: false

## Safe End-To-End Task

Requested live task:

- Action: `agent_zero.report.create`
- Result: blocked
- Reason: `active_bridge_session_required`
- Accepted for execution: false
- Report created: no
- External delivery attempted: no

This is the correct production outcome until the owner-channel Bridge Session approval is completed. No fake "Done" was emitted.

## Tests

Targeted Mission Control tests passed:

- `src/lib/agent-zero-bridge-session.test.ts`
- `src/lib/agent-zero-execution-gateway.test.ts`
- `src/lib/agent-zero-hermes-collaboration.test.ts`

Result:

- Test files: 3 passed
- Tests: 27 passed

Coverage included:

- Bridge Session creation/reuse
- active session derivation from approval state
- duplicate approval prevention
- expiration blocking
- Hermes Bridge Session permission evaluation
- registered adapter execution only
- report creation through adapter
- unavailable connectors blocked honestly
- Build-Wiki scoped adapter behavior
- Obsidian/MemPalace adapter audit behavior
- Agent Zero to Hermes collaboration guardrails

## Security Confirmation

- No secrets printed.
- No auth files printed.
- No API keys or tokens printed.
- No `.env` changes staged.
- No auth weakening.
- No direct DB approval bypass.
- No root shell.
- No Docker socket.
- No direct secret reads.
- No raw filesystem execution adapter.
- No external writes.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No farmer execution.

## Files Changed

- `runtime/agent-zero-hermes-bridge-session-proof.md`

## Blocker

The remaining live blocker is owner-channel approval activation:

- Required action: use the canonical Telegram inline Approve button for the pending Agent Zero Bridge Session approval request.
- Direct Mission Control approval route is intentionally blocked.
- Until that approval state becomes `approved`, execution stays disabled.

## Rollback

After commit, rollback with:

```bash
git revert <bridge-session-proof-commit>
```
