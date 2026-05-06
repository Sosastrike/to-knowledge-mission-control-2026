# Paperclip Sandbox Install Report

Status: partial pass with test blockers
Date: 2026-05-06
Scope: Phases 031-050

## Summary

Paperclip was cloned and evaluated in an isolated lab path. It was not installed into production, not exposed publicly, not persisted as a service, and not connected to Mission Control, OpenCloud, Build-Wiki, or production secrets.

## Phase Results

- Phase 031: Node.js version check passed. Server lab shell reports Node v22.22.2, and the approved Node toolchain provides Node v24.14.1.
- Phase 032: pnpm version check passed using the approved Node toolchain. pnpm reports 10.33.0, satisfying the >=9 requirement.
- Phase 033: Paperclip code was not already installed on the server. Only prior Mission Control reports existed.
- Phase 034: Created isolated lab path `/home/tony/paperclip-lab`.
- Phase 035: Cloned `https://github.com/paperclipai/paperclip.git` into the lab path.
- Phase 036: No production secrets were used.
- Phase 037: Mission Control database was not used.
- Phase 038: OpenCloud production data was not used.
- Phase 039: `pnpm install` completed in the lab path after package/script review.
- Phase 040: `pnpm test` was safe to run but did not fully pass. Two tests failed because the server has an active Tailnet address where the tests expected loopback fallback.
- Phase 041: `pnpm run typecheck` passed.
- Phase 042: `pnpm run build` passed.
- Phase 043: Sandbox run was started through Paperclip CLI using loopback-only setup. No persistent service was created.
- Phase 044: UI and API started successfully in the sandbox.
- Phase 045: Health endpoint returned 200 with status `ok`.
- Phase 046: Public exposure check passed. Listeners were loopback-only during the smoke test.
- Phase 047: No secret values were intentionally printed or committed. Paperclip reported secret presence/status only.
- Phase 048: This sandbox install report was created.
- Phase 049: No persistent service was created.
- Phase 050: This report is safe to commit in Mission Control as report-only documentation.

## Repo Metadata

- Branch: master
- Recent HEAD: `d0e9cc76 Show workspace changes and stale notices in issue threads (#5356)`
- Package manager declared by repo: pnpm 9.15.4
- Node engine declared by repo: >=20
- Workspace package count observed during install: 23

## Install Notes

`pnpm install` completed. Warnings were observed for missing plugin SDK bin links before build artifacts existed. Build/typecheck later prepared the SDK artifacts successfully.

## Test Results

- `pnpm test`: failed with 2 Tailnet environment expectation failures.
- Passing tests observed before failure: shared, db, adapter-utils, acpx local adapter, codex local adapter, opencode local adapter, UI, and most CLI tests.
- Failed tests:
  - `src/__tests__/network-bind.test.ts`: expected loopback fallback, received the server Tailnet address.
  - `src/__tests__/onboard.test.ts`: expected loopback fallback, received the server Tailnet address.
- Root cause assessment: environment-specific Tailnet detection, not a production data or secret issue.

## Typecheck And Build

- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- Build warning: large UI chunks and a dynamic/static import chunking warning for the Markdown editor. No build failure.

## Sandbox Startup Smoke

- Deployment mode: local trusted/private.
- Bind: loopback only.
- UI: returned HTTP 200.
- API health: returned HTTP 200 with status `ok`.
- Embedded PostgreSQL used lab-local data only.
- Server and embedded database were stopped after smoke testing.

## Safety Confirmation

- No production Paperclip service was created.
- No public port was opened.
- No Mission Control database was used.
- No OpenCloud production data was used.
- No external writes were performed.
- No Zapier, HeyGen, SMB, or external farmer actions were performed.
- No `.env` file in Mission Control was modified.
- No secrets were committed.

## Blockers

- Paperclip test suite is blocked by Tailnet-aware behavior on this server until tests are made deterministic or run in an environment without Tailnet discovery.
- Paperclip is not ready for production service persistence until the sandbox test blocker is resolved or formally waived.
- Paperclip has not been connected to Gateway execution routes.

## Recommended Next Step

Fix or isolate the Tailnet fallback tests, then rerun the Paperclip test suite before any persistent service or Gateway execution integration.
