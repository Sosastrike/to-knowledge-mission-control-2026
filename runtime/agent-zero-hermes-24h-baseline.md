# Agent Zero + Hermes 24-Hour Baseline

Generated: 2026-05-04 09:18 EDT

## Phase 0 - Current Percentage Table

These are live-verified baseline estimates, not 100% completion claims.

| Area | Current % | Status | Baseline reason |
| --- | ---: | --- | --- |
| Agent Zero | 90% | PARTIAL GO | Production Mission Control test-chat returns `agent_zero_called:true`; registry and email wording still need a post-restart behavior pass. |
| Hermes | 45% | NO-GO for live chat, partial visible context | Hermes service and Mission Control status route are active, but production test-chat still returns HTTP 405. |
| Mission Control | 88% | PARTIAL GO | Repo checks pass and production is active; production process still needs admin restart to load latest Hermes route code. |
| Bridge/MCP | 86% | PARTIAL GO | Authenticated Bridge/MCP routes return 200 and unauthenticated routes return 401; execution remains Bridge Session gated. |
| Brain | 80% | PARTIAL GO | Brain/Obsidian/MemPalace/Graphify/Build-Wiki context is visible through Agent Zero context; write paths remain Bridge Session or adapter gated. |
| Skills | 85% | PARTIAL GO | OpenClaw+/shared skill registry exists and tests pass; Hermes live use is not proven. |
| External Connectors | 45% | BLOCKED/PARTIAL | Several external credential sources are missing or empty; no external writes were tested or run. |
| OpenCloud / Build-Wiki | 70% | KEEP | Farmer timer is active, service is inactive, Run Now remains scoped/gated, and OpenCloud must not be destroyed yet. |
| Overall | 84% | PARTIAL GO | Agent Zero live-call gate is fixed; Hermes live-chat and final delivery/connectors remain blockers. |

## Phase 1 - Mission Control Repo Baseline

Repo: Mission Control.

Branch: `to-knowledge-mc`.

HEAD: `865120f`.

Recent commits:

- `865120f` docs(agents): record agent zero hermes 24h wiring status
- `313ecd0` docs(agents): record hermes owner access status
- `deef4d0` feat(mission-control): add hermes test chat surface
- `bd4c64a` fix(mission-control): enable hermes read-only test chat
- `86b547d` docs(agents): add agent zero hermes current ecosystem report

Dirty state: many pre-existing untracked/parked artifacts remain in the worktree. No tracked code modifications were present before this report.

Checks:

- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 99 test files and 1037 tests.

Notable test proof: Agent Zero 10,000-scenario ecosystem gauntlet passed with zero hard failures.

## Phase 2 - ClaudeClaw / OpenClaw+ Repo Baseline

Repo: ClaudeClaw / OpenClaw+ runtime.

Branch: `master`.

HEAD: `db83363`.

Recent commits:

- `db83363` feat(agents): install agent zero primary commander profile
- `20a1b6a` fix(agentmail): verify email and enforce domain allowlist
- `c4bd87b` fix(telegram): keep owner channel on agent zero
- `820b8ca` feat(telegram): route owner command channel to agent zero
- `db981fc` fix(voice): transfer active voice ownership to agent zero

Dirty state: many pre-existing deleted runtime report files and untracked runtime/artifact files remain parked. They were not touched in this baseline.

Checks:

- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: passed, 61 test files and 1213 tests passed with 4 skipped.
- `npm run design-lock:verify`: passed.

Notable test proof: ClaudeClaw 100,000-scenario gauntlet passed with zero hard-fail leaks in the test output.

## Phase 3 - Service Baseline

| Service | Status |
| --- | --- |
| `mission-control.service` | active |
| `claudeclaw.service` | active |
| `hermes-gateway.service` | active |
| `opencloud-docs-farmer.timer` | active |
| `opencloud-docs-farmer.service` | inactive |
| Agent Zero container | running |

Agent Zero container health was not reprinted with secret-bearing payloads. Container status showed it was up.

## Phase 4 - Route Baseline

Authenticated and unauthenticated route checks were run with the Mission Control credential read only inside the remote shell. The credential value was not printed.

| Route | Authenticated | Unauthenticated | Result |
| --- | ---: | ---: | --- |
| `GET /api/bridge/agent-zero/status` | 200 | 401 | protected and working |
| `POST /api/bridge/agent-zero/test-chat` | 200 | 401 | protected and working |
| `GET /api/bridge/hermes/status` | 200 | 401 | protected and working |
| `POST /api/bridge/hermes/test-chat` | 405 | 401 | production POST not loaded yet |
| `GET /api/bridge/providers` | 200 | 401 | protected and working |
| `GET /api/bridge/preflight` | 200 | 401 | protected and working |
| `GET /api/mcp/list` | 200 | 401 | protected and working |
| `GET /api/bridge/capability-matrix` | 200 | not rerun unauthenticated in this baseline | authenticated route working |

Agent Zero test-chat result: `agent_zero_called:true`, execution disabled, no blocker.

Agent Zero response preview: it reported live Mission Control access by naming `GET /api/bridge/agent-zero/status` with HTTP 200.

Hermes test-chat result: HTTP 405 in production, so `hermes_called:true` is not proven.

## Phase 5 - Secret-Source Baseline

Only existence/non-empty state was checked. No secret values were printed.

| Secret source | Configured |
| --- | --- |
| Agent Zero external API key file | true |
| Agent Zero Mission Control API key file | true |
| Host Codex CLI auth file | true |
| Agent Zero container Codex plugin auth file | true |
| Agent Zero host-mounted Codex plugin auth path | false |
| Agent Zero `secrets.env` | false, file exists but empty |
| OpenRouter API key in Mission Control env file | false |
| OpenAI API key in Mission Control env file | false |
| Firecrawl API key in Mission Control env file | false |
| AgentMail API key in Mission Control env file | false |
| SMTP host/user in Mission Control env file | false |
| Google OAuth client ID/secret in Mission Control env file | false |
| Microsoft OAuth client ID/secret in Mission Control env file | false |
| ElevenLabs API key in Mission Control env file | false |

Important note: Codex auth is present inside the Agent Zero container, but the specific host-mounted plugin path checked from Mission Control is missing. This should be treated as a mapping/configuration distinction, not as a token failure.

## Phase 6 - Agent Zero External API Key Blocker

Current result: blocker cleared.

The Agent Zero external API key secret file exists and is non-empty. Its value was not printed.

Production Agent Zero test-chat returned HTTP 200 and `agent_zero_called:true`.

## Phase 7 - Hermes Live-Chat Blocker

Current production result: blocked.

`POST /api/bridge/hermes/test-chat` returned HTTP 405 in production.

Interpretation: production Mission Control has not loaded the pushed Hermes POST route yet. Hermes live chat is not proven and must not be claimed as GO.

Expected next behavior after admin restart:

- If the pushed route is loaded and no live adapter is configured, return a truthful blocked response instead of 405.
- If a safe live adapter is configured, return 200 with `hermes_called:true`.

## Phase 8 - Production Restart Status

Mission Control process marker:

- MainPID: `2077627`
- ActiveEnterTimestamp: `Sun 2026-05-03 22:33:02 EDT`

Current result: restart still needed.

The production process is active, but it is still the pre-restart process. Latest repo code is present on disk, but production must be admin-restarted to load it.

## Phase 9 - Baseline Report

This file is the baseline report:

`runtime/agent-zero-hermes-24h-baseline.md`

Report safety:

- No secrets included.
- No auth file contents included.
- No API key values included.
- No `.env` contents included.
- No external writes executed.
- No SMB mount attempted.
- No farmer execution run.
- No OpenCloud destruction performed.

## Baseline Decision

Agent Zero remains PARTIAL GO and is live-callable through Mission Control.

Hermes remains NO-GO for live owner chat until production POST test-chat returns a truthful result and ideally `hermes_called:true`.

The next required action is the admin-authorized restart of `mission-control.service`, followed by a production route smoke and Agent Zero/Hermes live behavior tests.

## Rollback

Report-only rollback:

```bash
git revert <baseline-report-commit>
```

No runtime rollback is required for this report because it changes no runtime code, secrets, or service configuration.
