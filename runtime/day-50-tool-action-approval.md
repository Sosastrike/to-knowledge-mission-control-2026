# Day 50 - Tool Action Approval

Date: 2026-05-10
Status: DEVELOPER-SIDE CLOSED; protected execution remains OWNER_GATED by design
Branch: to-knowledge-mc

## Lane
External tool action approval for MCP, Zapier, HeyGen, AgentMail, Google Drive, and OneDrive protected actions.

## What Changed
- Added a canonical tool-action approval planner.
- Added protected route:
  - POST /api/bridge/tool-action-approval
- Added runtime smoke:
  - scripts/check-tool-action-approval.mjs
- Added regression tests for:
  - exact scope mapping
  - no execution
  - no writes
  - dry-run preview with no approval row
  - unsupported broad action blocking
  - authentication requirement

## Approval Scope Behavior
Supported exact scopes:
- zapier.write
- heygen.generate
- agentmail.send
- google_drive.upload
- onedrive.upload
- protected_action.execute for generic mutating MCP tool execution

Unsupported or broad requests return:
- canonical_status: BLOCKED
- blocker: tool_action_scope_not_supported
- approval_request_created: false
- accepted_for_execution: false

## Safety Behavior
- No external tool execution was enabled.
- No Zapier writes were enabled.
- No HeyGen generation was enabled.
- No Drive or OneDrive upload was enabled.
- No AgentMail send was enabled.
- Payload values are not stored in the owner-facing approval response.
- Approval scope stores payload hash and field names only.
- Bridge approval/audit persistence creates the pending request and audit event.

## Runtime Proof
Runtime bind:
- 127.0.0.1:3337

Restarted runtime PID:
- 15639

Proof artifacts:
- runtime/day-50-tool-action-approval-smoke.json
- runtime/day-50-tool-action-approval-create-proof.json

Create-proof summary:
- status: 201
- mode: tool_action_approval_requested
- canonical_status: OWNER_GATED
- required_scope: agentmail.send
- approval_request_created: true
- approval_state: pending
- audit_event_id_present: true
- accepted_for_execution: false
- execution_enabled: false
- writes_enabled: false
- bridge_session_required: true
- owner_approval_required: true
- unsafe_output_detected: false

## Tests And Checks
- Focused Day 50 tests:
  - pnpm exec vitest run src/lib/tool-action-approval.test.ts src/app/api/bridge/tool-action-approval/route.test.ts --pool=forks --no-file-parallelism --reporter verbose
  - Result: 2 files / 11 tests passed
- git diff --check: passed
- pnpm run typecheck: passed
- pnpm run build: passed
- pnpm test: passed, 177 files / 1386 tests
- Protected-file invariant scan: passed
- .env diff check: clean
- /login smoke: 200
- Mission Control route rendering smoke: passed, 46 routes and 8 designer pages checked
- Tool action approval smoke: passed, 5 checks

## Files Changed
- src/lib/tool-action-approval.ts
- src/lib/tool-action-approval.test.ts
- src/app/api/bridge/tool-action-approval/route.ts
- src/app/api/bridge/tool-action-approval/route.test.ts
- scripts/check-tool-action-approval.mjs
- runtime/day-50-tool-action-approval.md
- runtime/day-50-tool-action-approval.pdf
- runtime/day-50-tool-action-approval-smoke.json
- runtime/day-50-tool-action-approval-create-proof.json

## Blocker Classification
- Developer-side Day 50 blocker: NONE
- Actual external execution blocker: OWNER_GATED

Reason:
External tool actions now route to exact Bridge approval requests. They still cannot execute until owner approval and a scoped Bridge Session allow the specific action.

## Rollback
After commit:
- git revert <day50_tool_action_approval_commit_sha>

## Safety Confirmation
- No .env changes.
- No secrets printed.
- No auth weakening.
- No public local exposure added.
- No fake Done.
- No fake sent/uploaded/generated status.
- No external writes executed.
- No SMB/Fork 2.
- No Zapier writes.
- No HeyGen generation.

## Next Day
Day 51 starts next:
- Tool error handling closure.
