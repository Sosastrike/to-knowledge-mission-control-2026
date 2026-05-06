# Paperclip Codex/ChatGPT Adapter Report

Status: connected in sandbox through ChatGPT account auth
Date: 2026-05-06
Scope: Phases 061-070

## Summary

Paperclip can use the local Codex/ChatGPT authentication model in sandbox. The shared Codex auth source exists, is non-empty, and is shaped like ChatGPT account auth rather than API-key auth. A Paperclip company-scoped Codex home was created in the lab and seeded from the shared Codex login. Safe no-write Codex smoke tests passed after using read-only, ephemeral execution settings.

## Phase Results

- Phase 061: Codex CLI is installed in the approved Node toolchain. Version observed: `codex-cli 0.125.0`.
- Phase 062: Codex auth exists and is non-empty. Contents were not printed.
- Phase 063: Codex auth mode is inferred as ChatGPT account auth. No API key field was detected in the auth file.
- Phase 064: Default Codex home exists. `CODEX_HOME` is not exported in the default shell, so Codex uses its default home.
- Phase 065: Paperclip `codex_local` adapter exists.
- Phase 066: Paperclip can seed per-company Codex home from shared Codex login.
- Phase 067: A company-scoped Codex home was created in the Paperclip lab runtime.
- Phase 068: Paperclip has `codex_local` registered in its built-in adapter registry. No production company/agent registration was performed.
- Phase 069: Safe no-write Codex smoke passed using ephemeral, read-only execution and the company-scoped Codex home.
- Phase 070: Codex auth mode: ChatGPT account.

## Auth Findings

- Shared Codex auth file exists: yes.
- Shared Codex auth file is non-empty: yes.
- Shared Codex auth file permission: owner-only.
- ChatGPT account token shape present: yes.
- Account email present in decoded auth metadata: yes, value not recorded.
- Plan type present in decoded auth metadata: yes, value not recorded.
- API key field present: no.
- Auth contents printed: no.

## Paperclip Managed Codex Home

- Company-scoped Codex home created: yes.
- Managed auth uses symlink to shared auth: yes.
- Managed auth resolves to shared auth: yes.
- Managed config copied from shared config: yes.
- API-key auth file written by Paperclip: no.
- Production secrets used: no.

## Adapter Registration

- Adapter key: `codex_local`.
- Built-in adapter registry entry exists: yes.
- Supports local agent JWT: yes.
- Supports instructions bundle: yes.
- Supports skills: yes.
- Requires materialized runtime skills: no.
- Production agent registration: not performed in this phase.

## Smoke Results

- Direct Codex no-write smoke: passed.
- Paperclip Codex environment probe with default args: failed because the default probe did not include the sandbox-safe git-check override.
- Paperclip Codex environment probe with read-only, ephemeral, skip-git-check args: passed.
- Focused Paperclip tests: passed.
  - `codex-local-adapter-environment.test.ts`
  - `adapter-routes.test.ts`
  - `execute.remote.test.ts`
- Focused test result: 3 test files passed, 15 tests passed, 1 Windows-only probe skipped.

## Safety Confirmation

- No Codex auth values were printed.
- No auth file contents were printed.
- No API keys were printed.
- No `.env` file in Mission Control was modified.
- No production Paperclip service was started.
- No Mission Control database was used.
- No OpenCloud production data was used.
- No external writes were performed.
- No Zapier, HeyGen, SMB, or farmer actions were performed.

## Remaining Blockers

- Paperclip production company/agent registration remains blocked until owner login/company bootstrap is completed.
- Persistent Paperclip service remains blocked until sandbox test blockers are closed or formally waived.
- Any execution-capable Codex usage must remain gated by Gateway policy and Bridge Session scope.

## Recommended Next Step

After owner Paperclip login is proven, create a sandbox Paperclip company agent using the `codex_local` adapter and keep its runtime command configured with read-only, ephemeral, skip-git-check defaults for smoke validation.
