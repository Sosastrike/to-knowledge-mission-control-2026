# Hermes Install and Activation Report

Generated: 2026-05-03

## Executive Status

Hermes does not need a fresh install. A local Hermes runtime already exists, is managed by a user systemd service, and is currently running as a read-only/degraded lieutenant candidate under Agent Zero. No unknown code was downloaded, no secrets were printed, no `.env` files were modified, and no execution access was granted.

Phase gate result: **proceed with Hermes read-only onboarding only**. Hermes health is connected at the service/process level, but full ecosystem integration remains degraded until a safe Hermes chat/test endpoint and Bridge Session execution path are proven.

## Phase 21-40 Results

| Phase | Status | Evidence | Blocker / Next Step |
| --- | --- | --- | --- |
| 21 - Verify whether Hermes must be installed | Complete | Hermes exists at `/home/tony/.hermes/hermes-agent`; binary reports `Hermes Agent v0.11.0 (2026.4.23)`. | No reinstall needed. |
| 22 - Install source validation | Complete | Local git repo remote is `https://github.com/NousResearch/hermes-agent.git`, branch `main`, HEAD `4a62ba9cc`. | Do not update the repo without owner approval. |
| 23 - Install prerequisites | Complete | Python, Node, Docker, memory, disk, and port checks passed. Gateway listens on port `9876`. | Raw gateway HTTP GET health paths return `501`; use Mission Control status route for safe health. |
| 24 - Secret requirements | Complete | Required credential stores exist as booleans only. Hermes config, env, and auth files are present and mode `0600`. | Credential values were not read or printed. |
| 25 - Workspace plan | Complete | Workspace: `/home/tony/.hermes/hermes-agent`; home/config/cache state: `/home/tony/.hermes`; logs: user journal; backup plan: `/home/tony/.hermes/backups`. | Create backups before any future upgrade. |
| 26 - Installation if missing | Skipped | Hermes is already installed. | No install performed. |
| 27 - Service/container setup | Complete | `hermes-gateway.service` is active and enabled. No Hermes Docker container is required or present. | Keep as user service unless owner approves a different deployment. |
| 28 - Health endpoint | Complete | Mission Control route `/api/bridge/hermes/status` is the safe authenticated health/status route. | Raw Hermes gateway has no simple unauthenticated health route. |
| 29 - API endpoint | Partial | Mission Control has authenticated Hermes surfaces, including `/api/hermes` and `/api/bridge/hermes/status`. | A dedicated safe `/api/bridge/hermes/test-chat` endpoint is not proven yet. |
| 30 - Auth source | Complete | Hermes auth/config stores are present as safe local files with restrictive permissions. | Values remain secret. |
| 31 - Config redaction | Complete | Hermes status route now exposes only `auth_configured` and source-type booleans, never values. | Production Mission Control must be restarted to load this new field. |
| 32 - Startup test | Complete | Hermes service is active; no restart was needed. | None. |
| 33 - Health test | Complete | Service active since `2026-04-29 08:36:59 EDT`; binary version `v0.11.0`. | Gateway route behavior remains nonstandard HTTP `501` for guessed health paths. |
| 34 - No-secrets startup log check | Complete | Recent Hermes journal secret-pattern count: `0`. | Continue using redacted log checks only. |
| 35 - Service persistence | Complete | `hermes-gateway.service` is enabled with `Restart=on-failure`. | None. |
| 36 - Install report | Complete | This report records activation/install findings. | None. |
| 37 - Commit install/activation | Pending | Commit planned: `feat(agents): activate hermes runtime`. | Run checks and commit after validation. |
| 38 - Rollback plan | Complete | Stop: `systemctl --user stop hermes-gateway.service`; disable: `systemctl --user disable hermes-gateway.service`. | Do not delete `/home/tony/.hermes` unless separately approved. |
| 39 - Agent Zero dependency check | Complete | Agent Zero container is running; Mission Control and ClaudeClaw services are active. | Agent Zero production chat remains separately gated by its own API-key/runtime state. |
| 40 - Phase gate | Complete | Hermes is installed, active, enabled, and visible through Mission Control status. | Continue only with read-only onboarding until live Hermes chat and Bridge Session tests pass. |

## Runtime Facts

- Hermes installed: yes.
- Hermes running: yes, via `hermes-gateway.service`.
- Hermes service enabled: yes.
- Hermes container: no Hermes Docker container detected.
- Hermes version: `Hermes Agent v0.11.0 (2026.4.23)`.
- Hermes source: local checkout of `NousResearch/hermes-agent`.
- Hermes gateway process: active.
- Hermes gateway port: `9876`.
- Raw gateway health: guessed GET paths returned HTTP `501`.
- Mission Control Hermes status route: present and authenticated.
- Hermes execution mode: read-only/degraded until Bridge Session execution is explicitly implemented and approved.

## Credential and Redaction Status

- Hermes config store present: yes.
- Hermes auth store present: yes.
- Hermes env store present: yes.
- File modes checked: restrictive `0600`.
- API/token values printed: no.
- Credential values returned by UI/API: no.
- New Mission Control status metadata: `auth_configured: true/false`, with source-type booleans only.

## Workspace Plan

- Runtime home: `/home/tony/.hermes`.
- Source checkout: `/home/tony/.hermes/hermes-agent`.
- Service unit: `/home/tony/.config/systemd/user/hermes-gateway.service`.
- State database: `/home/tony/.hermes/state.db`.
- Memory files: `/home/tony/.hermes/memories`.
- Sessions: `/home/tony/.hermes/sessions`.
- Skills: `/home/tony/.hermes/skills` and `/home/tony/.hermes/hermes-agent/skills`.
- Logs: user systemd journal for `hermes-gateway.service`.
- Proposed backup path: `/home/tony/.hermes/backups`.

## Dependency Check

- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.
- `agent-zero` container: running.
- No farmer execution was triggered.
- No Zapier, HeyGen, SMB, or external write was executed.

## Current Blockers

1. Hermes has not proven a live chat/test endpoint through Mission Control.
2. Hermes has not proven read-only Bridge context query through a live Hermes call.
3. Hermes has no approved Bridge Session execution path yet.
4. Production Mission Control must be restarted to expose the new Hermes `auth_configured` status field.
5. Hermes should not be marked fully integrated until live tests prove it can coordinate under Agent Zero without fake access or unapproved execution.

## Rollback

- Stop Hermes runtime: `systemctl --user stop hermes-gateway.service`.
- Disable Hermes runtime persistence: `systemctl --user disable hermes-gateway.service`.
- Re-enable if needed: `systemctl --user enable --now hermes-gateway.service`.
- Revert this report/status change after commit: `git revert <commit-hash>`.

## No-Secrets Confirmation

No secret values were printed, copied into the report, committed, or returned by the updated status route. No `.env` files were changed. No auth policy was weakened.
