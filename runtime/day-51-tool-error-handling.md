# Day 51 - Tool Error Handling

Date: 2026-05-10
Status: DEVELOPER-SIDE CLOSED
Branch: to-knowledge-mc

## Lane
Tool error handling for MCP, Zapier, HeyGen, delivery connectors, Bridge-gated tool actions, and owner-facing Mission Control surfaces.

## CloudCode Package
CloudCode backend-support was consumed as a contract reference for safe owner-facing status/error classification.

Applied method:
- Adapted into Mission Control source instead of git am.

Reason:
- The backend-support package is already present in this repository.
- Day 51 needed the error classifier integrated into current Mission Control routes and tests, not a separate backend-support-only patch branch.

CloudCode concepts consumed:
- classifyError / classifyErrors
- canonical owner-facing blocker kinds
- safe redaction behavior

## What Changed
- Added canonical tool error classifier:
  - src/lib/tool-error-classifier.ts
- Added protected classifier endpoint:
  - POST /api/bridge/tool-error-classifier
- Added runtime smoke:
  - scripts/check-tool-error-classifier.mjs
- Updated tool-action approval route so blocked/failed approval paths return a classified owner-facing error.
- Added regression tests for:
  - HTTP status mapping
  - credential-gated classification
  - service-down classification
  - backend-missing classification
  - route-missing classification
  - owner-gated classification
  - execution/write disabled classification
  - redaction of secrets, auth filenames, private hosts, and raw local paths
  - protected API access
  - no execution/write enablement from the classifier

## Canonical Error Kinds
- OWNER_GATED
- CREDENTIAL_GATED
- SERVICE_DOWN
- BACKEND_MISSING
- ROUTE_MISSING
- AUTH_REQUIRED
- EXECUTION_DISABLED
- WRITE_DISABLED
- EXTERNAL_WRITE_DISABLED
- UNKNOWN

## Endpoint Behavior
POST /api/bridge/tool-error-classifier

Expected behavior:
- Requires authenticated viewer context.
- Accepts a single error object or an errors array.
- Returns canonical classifications with:
  - kind
  - owner_message
  - next_action
  - safe_detail
  - severity
- Never enables execution.
- Never enables writes.
- Never enables external writes.
- Confirms no secret output for authenticated classification responses.

## Tool Action Approval Integration
POST /api/bridge/tool-action-approval now returns classified_error for:
- unsupported broad tool scopes
- approval request creation failures

Unsupported broad tool actions remain blocked:
- canonical_status: BLOCKED
- blocker: tool_action_scope_not_supported
- approval_request_created: false
- accepted_for_execution: false
- execution_enabled: false
- writes_enabled: false
- classified_error.kind: BACKEND_MISSING

## Runtime Proof
Runtime bind:
- 127.0.0.1:3337

Restarted runtime PID:
- 18435

Proof artifacts:
- runtime/day-51-tool-error-classifier-smoke.json
- runtime/day-51-tool-action-approval-classified-smoke.json

Tool error classifier smoke:
- unauthenticated POST returned 401
- canonical batch classified SERVICE_DOWN, AUTH_REQUIRED, CREDENTIAL_GATED, BACKEND_MISSING
- owner-gated single error classified OWNER_GATED
- execution_enabled: false
- writes_enabled: false
- external_writes_enabled: false
- no unsafe output patterns detected

Tool action approval classified smoke:
- unauthenticated POST returned 401
- Zapier write preview stayed OWNER_GATED with no write
- HeyGen generation preview stayed OWNER_GATED with no generation
- AgentMail send preview stayed OWNER_GATED with no send
- Unsupported broad scope stayed BLOCKED with no approval row and no execution

## Tests And Checks
- Red tests were created first and failed on missing classifier modules/routes.
- Focused Day 51 tests:
  - pnpm exec vitest run src/lib/tool-error-classifier.test.ts src/app/api/bridge/tool-error-classifier/route.test.ts src/app/api/bridge/tool-action-approval/route.test.ts --pool=forks --no-file-parallelism --reporter verbose
  - Result: 3 files / 20 tests passed
- git diff --check: passed
- pnpm run typecheck: passed
- pnpm run build: passed
- pnpm test: passed, 179 files / 1402 tests
- Protected-file invariant scan: passed
- .env diff check: clean
- /login smoke: 200
- Tool error classifier smoke: passed, 3 checks
- Tool action approval smoke: passed, 5 checks

## Files Changed
- src/lib/tool-error-classifier.ts
- src/lib/tool-error-classifier.test.ts
- src/app/api/bridge/tool-error-classifier/route.ts
- src/app/api/bridge/tool-error-classifier/route.test.ts
- src/app/api/bridge/tool-action-approval/route.ts
- src/app/api/bridge/tool-action-approval/route.test.ts
- scripts/check-tool-error-classifier.mjs
- runtime/day-51-tool-error-handling.md
- runtime/day-51-tool-error-handling.pdf
- runtime/day-51-tool-error-classifier-smoke.json
- runtime/day-51-tool-action-approval-classified-smoke.json

## Blocker Classification
- Developer-side Day 51 blocker: NONE

External action blockers remain truthful per runtime classification:
- OWNER_GATED where owner approval is required
- CREDENTIAL_GATED where provider credentials are absent
- SERVICE_DOWN where a runtime service is unreachable
- BACKEND_MISSING where a route or adapter is not implemented

## Rollback
After commit:
- git revert <day51_tool_error_handling_commit_sha>

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
Day 52 starts next:
- MCP / Zapier / HeyGen final closeout.
