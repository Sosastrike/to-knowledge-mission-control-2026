# Space Agent Local Sandbox Report

Generated: 2026-05-06
Scope: Phases 071-080. Sandbox validation only. No production install, no production secrets, no public bind, and no external product actions.

## Executive Summary

Space Agent was cloned into a temporary isolated sandbox and exercised as a local-only test runtime. The server can start successfully on loopback with an isolated single-user test account, and it shuts down cleanly. It is still not approved for production installation because the dependency audit found one high-severity transitive vulnerability, and the full repo test story needs a proper upstream runner profile.

Recommended status: sandbox-start verified, production install still blocked.

## Phase 071 - Isolated Clone

- A fresh clone was created in a temporary sandbox location, not in the production Mission Control, OpenClaw+, OpenCloud, or Agent Zero paths.
- Repository: `Sosastrike/To-Knowledge-space-agent`.
- Branch: `main`.
- Audited commit: `9c26f9f`.
- The clone remained clean after install/startup checks except ignored local dependency folders.

## Phase 072 - No Public Ports

- The development server was started only on loopback.
- Verified listener: `127.0.0.1:31991`.
- No `0.0.0.0`, public, or Tailnet bind was used.
- After shutdown, no listener remained on the test port.

## Phase 073 - No Production Secrets

- No production secret file was read or copied.
- No `.env` was used or modified.
- The test runtime used isolated `HOME`, config, data, and customware directories under the temporary sandbox.
- No token, API key, auth file, or credential value was printed.

## Phase 074 - Local Test Account Only

- Runtime was launched with `SINGLE_USER_APP=true` for local sandbox validation.
- Health reported the local test user as `user` from `single-user-app` mode.
- The local user appeared in `_admin` because that is Space Agent's single-user mode behavior; this must not be treated as production authority.

## Phase 075 - NPM Install After Dependency Review

- Dependency review was completed before install in the prior audit.
- Install command used lifecycle scripts disabled: `npm install --ignore-scripts --no-audit --no-fund`.
- Result: 151 packages installed in the sandbox.
- Warnings observed: deprecated `lodash.isequal`, deprecated `glob` version family, and npm version notice.

## Phase 076 - NPM Audit

Audit command: `npm audit --omit=dev`.

Result:

- 1 high-severity vulnerability.
- Package family: `lodash`.
- Reported issue types: prototype pollution and template/code-injection advisories.
- Suggested upstream action: audit fix / dependency refresh.

Policy impact:

- Do not install Space Agent into production until this vulnerability is resolved or formally risk-accepted.
- Keep Space Agent as a Gateway design/sandbox candidate for now.

## Phase 077 - Existing Tests

There is no root `npm test` script. The repo does contain many Node `.mjs` test files and larger desktop/browser/performance harnesses.

Focused safe Node test run:

- Total tests executed: 61.
- Passed: 54.
- Failed: 7.
- Desktop/Electron, browser harness, stress, and LLM performance suites were not run in this phase.

Failure summary:

- `prompt_budget_trim_test`, `prompt_items_test`, and `promptinclude_test` failed because imports referenced `/mod/...` absolute runtime module URLs that are not resolved in the plain cloned Node test context.
- `router_cache_headers_test` had two failures around mocked response stream behavior: `res.once is not a function` / `dest.on is not a function`.
- `set_command_test` had two failures because it looked for a hardcoded `/workspace/agent-one/commands/params.yaml` path instead of the isolated clone path.

Interpretation:

- The sandbox test run proves many units pass, but this repo needs its intended test runner/profile documented before production promotion.
- These failures are blockers for claiming production readiness, not blockers for continuing Gateway adapter design.

## Phase 078 - Local Development Server

Startup command class:

- `node space serve HOST=127.0.0.1 PORT=31991 SINGLE_USER_APP=true CUSTOMWARE_PATH=<temporary-customware> CUSTOMWARE_WATCHDOG=false CUSTOMWARE_GIT_HISTORY=false CLOUD_SHARE_ALLOWED=false`

Runtime environment:

- Isolated `HOME`.
- Isolated config directory.
- Isolated data directory.
- Isolated customware directory.
- No production auth or owner credentials.

Startup proof:

- Health endpoint returned `ok: true` and `name: space-agent-server`.
- Browser app URL resolved to loopback only.
- User self-info returned the local single-user account.

Shutdown proof:

- The test process was killed after validation.
- The process exited cleanly enough for the shell trap to complete.
- No test listener remained on the port.

## Phase 079 - No External Writes

Confirmed no external product action was run:

- No Zapier write.
- No HeyGen generation.
- No SMB mount.
- No external farmer.
- No Drive or OneDrive upload.
- No AgentMail send.
- No OpenCloud or Build-Wiki execution.
- No production service restart.
- No public endpoint exposure.

Sandbox writes only:

- Local npm dependencies inside the isolated clone.
- Empty isolated customware runtime folder.
- Local server log in the temporary sandbox.

## Phase 080 - Startup and Shutdown Notes

Startup for future sandbox checks:

1. Clone to a temporary isolated path.
2. Use isolated `HOME`, config, data, and customware directories.
3. Install dependencies only after dependency review.
4. Start with loopback-only host: `HOST=127.0.0.1`.
5. Prefer `CUSTOMWARE_WATCHDOG=false` and `CUSTOMWARE_GIT_HISTORY=false` for simple smoke tests.
6. Use `SINGLE_USER_APP=true` only for local sandbox smoke; do not carry that authority into production.
7. Call `/api/health` for readiness.
8. Kill the process and verify the port is closed.

Production blockers before any live Gateway install:

- Resolve or risk-accept the high-severity `lodash` audit finding.
- Create a read-only Gateway Research Packet adapter.
- Add no-write/no-secret/no-public-bind policy tests.
- Define a service identity that does not expose owner credentials.
- Keep Space Agent external writes disabled unless Bridge Session explicitly scopes them.

## No-Secrets Confirmation

- No secret values were printed.
- No auth files were printed.
- No `.env` files were opened, changed, or copied.
- No production secret source was used.
- No public ports were opened.
- No production system was modified.
