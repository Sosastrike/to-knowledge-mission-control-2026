# Gateway Live Validation Report

Date: 2026-05-05
Scope: Phases 191-200
Commit target: docs(gateway): record gateway live validation

## Summary

Gateway validation is partial. The current production Mission Control process still appears stale for authenticated `/api/gateway/*` requests: unauthenticated requests are protected with 401, but authenticated API-key requests to the current production loopback service redirect to the Mission Control designer page instead of returning Gateway JSON. The latest built standalone code validates the Gateway registry/status/node APIs correctly on a temporary loopback server.

Owner page auth was not proven because the validation runner did not have access to an owner password/session source. No password, token, API key, auth file, or `.env` value was printed. API-key authentication was available for protected API validation.

## Phase Results

| Phase | Goal | Result | Evidence |
|---|---|---|---|
| 191 | Authenticated Gateway page test | Blocked | Owner session login could not run because no owner password/session secret was available to the validation runner. API-key auth cannot authenticate page routes. |
| 192 | Unauthenticated Gateway route test | Passed | Current production `/api/gateway/registry`, `/api/gateway/status`, and `/api/gateway/nodes/agent_zero` returned 401 unauthenticated. |
| 193 | Agent Zero Gateway test | Partial | Current production Agent Zero test-chat returned `agent_zero_called:true` with no raw path exposure, but current production Gateway registry routes are stale. Latest build registry is available. |
| 194 | Hermes Gateway test | Blocked | Current production Hermes POST still returned 405. Latest build route exists but returned 500 in temporary validation, so `hermes_called:true` is not proven. |
| 195 | Gateway route planning test | Passed | Latest build preflight routed the Hermes skill/workflow request to `hermes_sandbox_read_only` with execution disabled. |
| 196 | Blocked connector test | Passed | Latest build preflight for n8n write returned `CREDENTIAL_REQUIRED`, missing credential count 2, execution disabled. |
| 197 | Build-Wiki no-execution test | Passed | Latest build preflight for Build-Wiki Run Now returned `OWNER_APPROVAL_REQUIRED`, created no approval request, and kept execution disabled. |
| 198 | Report generation test | Passed | Latest build created a safe Mission Control report response with report and PDF URLs present, no raw local path in normal reply, and no external delivery write. |
| 199 | No Tony active test | Passed on latest build | Latest Gateway registry returned 37 nodes, Agent Zero commander connected, Hermes lieutenant degraded, Tony nodes archived, and zero Tony active edges. Current production Gateway registry still requires restart/loading. |
| 200 | Commit live test proof | Completed | This report records the proof and blockers for commit. |

## Current Production Loopback Results

- Auth method available for APIs: api_key.
- Owner page session available: False.
- Page auth blocker: owner_auth_secret_not_available_to_validation_runner.
- Unauthenticated Gateway API statuses: {'/api/gateway/registry': 401, '/api/gateway/status': 401, '/api/gateway/nodes/agent_zero': 401}.
- Authenticated Gateway API statuses: registry=307, status=307, node=307.
- Agent Zero test-chat: status=200, agent_zero_called=True, raw_paths_exposed=False.
- Hermes test-chat: status=405, hermes_called=False.

## Latest Build Loopback Results

- Auth method available for APIs: api_key.
- Gateway registry/status/node statuses: registry=200, status=200, node=200.
- Registry summary: node_count=37, agent_zero=commander:connected, hermes=lieutenant:degraded.
- Tony archived only: True.
- Route planning: decision=OWNER_APPROVAL_REQUIRED, primary_route=hermes_sandbox_read_only, execution_enabled=False.
- Blocked connector: decision=CREDENTIAL_REQUIRED, missing_credentials_count=2, execution_enabled=False.
- Build-Wiki no-execution: decision=OWNER_APPROVAL_REQUIRED, approval_request_created=False, execution_enabled=False.
- Report generation: status=201, mission_control_url_present=True, pdf_url_present=True, normal_reply_safe=True.
- Agent Zero latest-build test-chat: status=500, agent_zero_called=False.
- Hermes latest-build test-chat: status=500, hermes_called=False.

## Browser/Page Auth

Authenticated Gateway page rendering remains blocked until an owner session is available to the validation runner or the owner performs the browser login. The test did not bypass auth and did not create a fake owner session. The previous static Gateway smoke still proves `page=gateway` and the legacy `page=agent-network` alias render the Gateway shell, but that is not counted as owner-authenticated proof.

## Safety Confirmation

- No secrets were printed.
- No auth files, tokens, API keys, or `.env` values were printed.
- No `.env` files were modified.
- No Zapier writes were run.
- No HeyGen generation was run.
- No SMB mount was attempted.
- No farmer execution was run.
- Report generation used Mission Control local report links only; no Telegram, Drive, OneDrive, or email delivery write was attempted.

## Blockers

1. Production Mission Control needs an admin-authorized restart to load the latest Gateway API routes into the running process.
2. Owner-authenticated page smoke needs an owner session/login in the browser, or an approved non-printing session source for the validation runner.
3. Hermes live Gateway proof is still blocked: production POST is 405, and latest-build POST did not prove `hermes_called:true`.
4. Agent Zero Gateway registry answer is partial until the production Gateway registry route is loaded and Agent Zero is tested against that live registry route.

## Rollback

- Revert this proof report commit with `git revert <commit-hash>` after commit.
- No runtime service state was changed by this report commit.
