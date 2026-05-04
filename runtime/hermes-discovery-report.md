# Hermes Discovery Report

Generated: 2026-05-03 23:38:01

## Executive Summary

Hermes is installed and reachable in read-only discovery mode. It is not missing. It is not fully integrated yet.

Initial Hermes status: **reachable-read-only / degraded for full ecosystem integration**.

Hermes is running as a user systemd gateway service and as a Python gateway process. Mission Control already has authenticated Hermes status routes and registry surfaces. Hermes appears as Agent Zero's lieutenant / skill and workflow specialist, and the shared OpenClaw+ skill registry is visible to both Agent Zero and Hermes. Hermes does not yet have a proven Mission Control live chat/API command channel, and no Bridge Session execution has been enabled.

No install phase is required right now. Continue with safe read-only Hermes chat/API bridge design only after the Agent Zero production live-call blocker is resolved or explicitly waived.

## Phase 0 - Baseline Both Repos

Mission Control:
- Repo: `/home/tony/mission-control`
- Branch: `to-knowledge-mc`
- HEAD: `733390a`
- Dirty count: 90 known parked/untracked entries.
- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 96 files / 1001 tests.

ClaudeClaw:
- Repo: `/home/tony/claudeclaw`
- Branch: `master`
- HEAD: `db83363`
- Dirty count: 93 known parked entries, including tracked runtime deletions and untracked runtime artifacts.
- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: passed, 61 files / 1213 tests / 4 skipped.
- `npm run design-lock:verify`: passed.

Services:
- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `hermes-gateway.service`: active.
- `opencloud-docs-farmer.timer`: active.
- `opencloud-docs-farmer.service`: inactive/idle.
- `agent-zero` container: running.

No `.env` edits were made. No secrets were committed. Report output intentionally avoids credential values.

## Phase 1 - Hermes Locations

Found Hermes locations:
- `/home/tony/.hermes`
- `/home/tony/.hermes/hermes-agent`
- `/home/tony/.hermes/skills`
- `/home/tony/sandbox/hermes-home-20260428`
- Mission Control Hermes routes/libs:
  - `src/app/api/hermes/route.ts`
  - `src/app/api/hermes/events/route.ts`
  - `src/app/api/hermes/memory/route.ts`
  - `src/app/api/hermes/tasks/route.ts`
  - `src/app/api/bridge/hermes/status/route.ts`
  - `src/lib/hermes-sessions.ts`
  - `src/lib/hermes-memory.ts`
  - `src/lib/hermes-tasks.ts`
- Prior reports/docs include `runtime/hermes-full-ecosystem-onboarding-report.md` and older COX/task Hermes notes.

## Phase 2 - Hermes Process / Service

Hermes is running:
- User service: `hermes-gateway.service` active.
- Process: `/home/tony/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace`.
- Docker: no Hermes container found.
- PM2: no Hermes PM2 process found.
- Cron: no Hermes cron entry found through the user crontab scan.
- Listening socket observed on port `9876` owned by a Python process. Treat as Hermes gateway candidate until route-level auth/usage is proven.

## Phase 3 - Hermes Repo / Source

Hermes has its own git repo:
- Path: `/home/tony/.hermes/hermes-agent`
- Branch: `main`
- HEAD: `4a62ba9cc`
- Remote: `https://github.com/NousResearch/hermes-agent.git`

Hermes is not merely documentation inside Mission Control or ClaudeClaw.

## Phase 4 - Hermes UI / Channel

Detected surfaces:
- CLI binary: `/home/tony/.local/bin/hermes` -> `/home/tony/.hermes/hermes-agent/venv/bin/hermes`
- Gateway service: `hermes-gateway.service`
- Mission Control API surfaces:
  - `/api/hermes`
  - `/api/hermes/memory`
  - `/api/hermes/tasks`
  - `/api/hermes/events`
  - `/api/bridge/hermes/status`
- Mission Control Agent Network references Hermes as lieutenant.

Not yet proven:
- A live Hermes test-chat endpoint through Mission Control.
- A Hermes owner-facing Telegram route.
- A safe Hermes execution channel.

## Phase 5 - Hermes Auth Model

Hermes has local credential/config stores, but values were not read into this report:
- `/home/tony/.hermes/config.yaml` exists and is mode 600.
- `/home/tony/.hermes/.env` exists and is mode 600.
- `/home/tony/.hermes/auth.json` exists and is mode 600.

Safe metadata only:
- `auth.json` contains top-level keys: active provider, credential pool, providers, updated timestamp, version.
- Config indicates provider/model/tool settings exist.

Do not print or commit these values. Hermes full auth should be handled through Mission Control / Bridge secret policy, not raw file exposure.

## Phase 6 - Hermes Model Provider

Hermes appears capable of multiple provider backends based on config/auth metadata and model cache:
- Active provider metadata exists in `auth.json`.
- Model cache contains many provider namespaces, including OpenRouter/OpenAI/Anthropic-like provider groups.
- Environment/config key presence indicates OpenRouter, OpenAI, Anthropic, NVIDIA, Firecrawl, Tinker, and other provider keys may be configured.

No model execution was run. Exact billing/provider selection must be confirmed through Hermes status/API without exposing credential values.

## Phase 7 - Hermes Skills

Hermes-specific skill locations exist:
- `/home/tony/.hermes/skills`
- `/home/tony/.hermes/hermes-agent/skills`
- `/home/tony/sandbox/hermes-home-20260428/skills`

Mission Control shared skill runtime already includes Hermes sources and exposes `available_to_agents: ['agent_zero', 'hermes']`.

Hermes role fit: skill authoring, workflow proposals, operational planning, and specialist review.

## Phase 8 - Hermes Memory

Hermes memory/storage exists:
- `/home/tony/.hermes/state.db`
- `/home/tony/.hermes/memories/USER.md`
- `/home/tony/.hermes/memories/MEMORY.md`
- `/home/tony/.hermes/sessions/*.json`
- `/home/tony/.hermes/models_dev_cache.json`

Mission Control has read-only Hermes memory/task/session adapters. No memory writes were performed.

## Phase 9 - Hermes Integration References

Mission Control references Hermes in:
- Agent runtime detection.
- Gateway control/status.
- Agent Network hierarchy.
- Brain Sync hierarchy.
- Agent Zero ecosystem context.
- Shared skill registry.
- Provider/capability registry.
- Hermes memory/tasks/events routes.

ClaudeClaw/OpenClaw+ references are mostly legacy/skill/runtime adjacency; no active Tony ownership should be inferred.

## Phase 10 - Hermes In Agent Network

Mission Control Agent Network maps:
- Agent Zero as commander.
- Hermes as lieutenant.
- Tony as retired/archived/hidden by default.

This matches the requested hierarchy at the source level.

## Phase 11 - Hermes In Brain Sync

Brain Sync source references show Hermes as secondary/lieutenant under Agent Zero, not reporting to Tony. No active Brain Sync label search found the forbidden Tony hierarchy phrases in source.

## Phase 12 - Hermes In Provider Registry

Hermes appears in Bridge provider status. A stale provider note from ClaudeClaw previously said Hermes was not bridged to Tony; this was corrected by commit `294e9b8`, which sanitizes Hermes provider output to keep Agent Zero as the lieutenant chain owner.

Hermes provider state remains read-only/sandbox/degraded until live chat/API and Bridge Session proof pass.

## Phase 13 - Hermes In Skills Registry

Hermes is included in the shared skill runtime:
- `available_to_agents`: `agent_zero`, `hermes`.
- `tony_owns_skill_system`: false.
- Skill paths, requirements, blockers, and execution requirements are visible as metadata.
- Execution remains disabled without Bridge Session approval.

## Phase 14 - Hermes In Governance

Hermes must inherit the same operating constraints as Agent Zero through OpenClaw+ / ClaudeClaw governance and Bridge policy:
- Universal Laws.
- Honesty protocol.
- Channel policy.
- Secret/redaction policy.
- Bridge Session approval policy.

No governance files were changed.

## Phase 15 - Hermes Runtime Blockers

Blockers for full integration:
1. No Mission Control Hermes test-chat/live chat endpoint has been proven.
2. No Hermes-to-Agent-Zero live communication has been proven.
3. No Hermes Bridge Session execution has been enabled or tested.
4. Production Mission Control still needs admin restart to load latest bundles if live service parity is required.
5. Agent Zero production test-chat remains blocked by its empty safe API key file, which blocks full commander/lieutenant live-chain proof.
6. Hermes model provider/billing mode needs safe status confirmation without value exposure.
7. Hermes gateway port exposure and auth path need explicit safety review before owner-facing use.

## Phase 16 - Discovery Report

This file is the requested no-secrets Hermes discovery report.

## Phase 17 - Commit Plan

Commit message:
`docs(agents): record hermes discovery status`

## Phase 18 - Initial Hermes Status

Status: **reachable-read-only / degraded for full integration**.

Rationale:
- Connected/reachable: Hermes service and process are running, CLI exists, Mission Control read-only routes work.
- Degraded: no proven live chat/API, no Bridge Session execution, no proven live Agent Zero coordination.

## Phase 19 - Canonical Hermes Role

Hermes role:
- Lieutenant / skill and workflow specialist.
- Supports Agent Zero with skills, workflow design, automation plans, operational proposals, and specialist review.
- Uses OpenClaw+ / ClaudeClaw as the shared runtime/skill layer.
- Uses Mission Control / Bridge / MCP only through approved adapters.
- Requires Bridge Session approval for execution.

## Phase 20 - Stop / Continue Decision

Hermes is installed and reachable, so no install plan is required.

Continue only with safe read-only integration work next:
1. Fix Agent Zero production test-chat blocker or formally waive it.
2. Add or verify a Hermes test-chat/API route through Mission Control.
3. Prove Hermes can receive read-only Mission Control / Bridge / skills context.
4. Add Hermes-specific natural/no-fake-access tests.
5. Only after that, design Bridge Session execution for Hermes.

Do not start protected execution, external writes, SMB, Zapier, HeyGen, farmer execution, raw shell/root, Docker socket, or direct secret reads.

## Commits / Rollback

Recent Hermes-related commits already pushed:
- `294e9b8` - sanitize Hermes lieutenant provider status.
- `3e60cb4` - detect Hermes gateway process safely.
- `733390a` - record broader Hermes onboarding discovery status.

Rollback for this report commit after it is created:
`git revert <commit-hash> && git push`

## No-Secrets Confirmation

The report contains no API key, token, OAuth file contents, auth file contents, or `.env` content values.
