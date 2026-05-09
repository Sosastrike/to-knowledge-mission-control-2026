# Day 27 - Failed Execution Behavior

Date: 2026-05-09
Branch: to-knowledge-mc
Status: CLOSED / SERVICE_DOWN PROOF
Code change: none
Report commit: pending
Rollback: no successful execution rollback required; report-only rollback is `git revert <day27_report_commit_sha>`
Next day started: Day 28 - Approval Security

## Closure Decision

Day 27 is closed for failed execution behavior.

The runtime proved a controlled failed execution path for the exact Build-Wiki Run Now scope. The action was approved, dispatch was attempted, the service start failed safely, a failed connector run row was written, a failed audit event was written, and the UI/API state returned `failed`.

This does not make the Farmer service GO. The underlying service remains unavailable in this local runtime.

Blocker classification: SERVICE_DOWN

Exact blocker:

`opencloud_docs_farmer_service_not_started_in_local_runtime`

## Scope

Safe proof action:

- connector: `skill.build_wiki`
- action: `buildwiki.run_now`
- target service: `opencloud-docs-farmer.service`
- fork: Fork 1 only

No SMB, Fork 2, external farmers, Zapier writes, HeyGen, or broad connector execution were used.

## Live Proof

Proof artifact:

`runtime/day-27-failed-execution-proof.json`

Approval id:

`apr_6bfec882-a5aa-423a-957d-aeabb9f449ee`

Run id:

`run_3d13e892-6e9e-4c18-8085-4ba6ef549160`

Audit id:

`audit_5f86c254-1158-4d97-bfba-039b1081dad7`

Create response:

- status: 201
- mode: `run_now_approval_requested_no_execution`
- accepted for execution: false
- execution enabled: false

Approved execution response:

- status: 502
- mode: `approval_request_approved_buildwiki_run_now_dispatched_failed`
- accepted for execution: true
- execution enabled: true
- blocked reason: `buildwiki_run_now_systemctl_failed`
- dispatch mode: `run_now_dispatched_failed`
- run state: `failed`
- target service: `opencloud-docs-farmer.service`
- next action: `Check the local service/timer status before retrying.`

## Persistence Proof

`bridge_approval_requests`:

- approval state: `approved`
- connector: `skill.build_wiki`
- action: `buildwiki.run_now`
- target key: `opencloud-docs-farmer.service`
- resolved: true

`bridge_connector_runs`:

- run state: `failed`
- has audit pointer: true
- rollback ref: `systemctl --user stop opencloud-docs-farmer.service`
- input hash present
- output hash absent because no successful output was produced

`bridge_audit_events`:

- `approval_requested`
- `approved`
- `failed`

## UI / API State

Run Now read route:

- status: 200
- UI state: `failed`

Build-Wiki status route:

- status: 200
- Run Now UI state: `failed`

This is the required owner-facing behavior: the page can show a failed terminal state and a safe next action without pretending the run completed.

## Safe Error Output

The proof scanned the serialized response, run row, and audit metadata for:

- private key markers
- API key/token/secret/password assignments
- bearer tokens
- raw local home paths
- auth file names
- `.env`

Result:

- unsafe output detected: false
- secret values printed: false
- raw local path exposure: false

Audit metadata keys were limited to safe execution metadata:

- accepted_for_execution
- dispatch_endpoint
- execution_enabled
- finished_at
- run_id
- source
- stderr_tail_present
- systemctl_exit_code
- systemctl_signal
- target_service

## Verification

Fresh checks around this Bridge failure surface:

- `git diff --check`: pass
- `pnpm run typecheck`: pass
- focused tests: pass, 4 files / 11 tests
- `node scripts/check-protected-file-invariants.mjs`: pass
- live failed execution proof: pass
- `.env` diff check: clean

Build and full test suite were already run for the current source commit during Day 25. Day 27 changed no source files.

## Files Added

- `runtime/day-27-failed-execution-proof.json`
- `runtime/day-27-failed-execution-behavior-100-closure.md`
- `runtime/day-27-failed-execution-behavior-100-closure.pdf`

## Safety Confirmation

- No `.env` changes.
- No secrets printed.
- No auth weakening.
- No public exposure added.
- No fake completion.
- No raw local path exposed.
- No SMB.
- No Fork 2.
- No external farmers.
- No Zapier writes.
- No HeyGen generation.

## Remaining Blocker

`SERVICE_DOWN`: `opencloud-docs-farmer.service` is unavailable/inactive in the current runtime service manager.

Owner/admin action if live Farmer execution is required on this host:

1. Install or expose `opencloud-docs-farmer.service` to the runtime user.
2. Confirm `systemctl --user start opencloud-docs-farmer.service` works for the Mission Control runtime user.
3. Confirm `systemctl --user is-active opencloud-docs-farmer.service`.
4. Re-run the Day 25/27 Run Now proof.

## Day 28 Start

Day 28 - Approval Security begins next.

Goal:

Verify non-owner/unauthenticated approval routes cannot approve, deny, or dispatch protected actions, and owner-only controls remain protected.
