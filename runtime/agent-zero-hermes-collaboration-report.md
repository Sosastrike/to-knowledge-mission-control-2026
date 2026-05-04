# Agent Zero Hermes Collaboration Report

Generated: 2026-05-04

## Scope

Phases 141-160 implemented the Agent Zero to Hermes collaboration protocol. Agent Zero can hand off planning/specification tasks to Hermes through a protected Mission Control route. Hermes returns plan/spec/recommendation artifacts only. No execution, external writes, root shell, Docker socket, direct secret reads, or raw filesystem access are enabled.

## Phase Status

| Phase | Goal | Status | Evidence |
| --- | --- | --- | --- |
| 141 | Define communication protocol | Completed | Protocol states Agent Zero sends task/workflow requests and Hermes returns plan/spec/recommendation only. |
| 142 | Agent Zero to Hermes route | Completed | Added `POST /api/bridge/agent-zero/hermes-handoff`. |
| 143 | Hermes response contract | Completed | Responses are structured, concise, sanitized, no raw paths, no fake access. |
| 144 | Conversation correlation | Completed | Internal request, Agent Zero task, and Hermes response IDs are tracked in audit metadata only; owner responses expose no raw IDs. |
| 145 | Hermes task types | Completed | Supported task types: skill design, workflow plan, automation plan, integration mapping, failure analysis, docs/report outline. |
| 146 | Hermes forbidden tasks | Completed | Forbidden requests for external write, root shell, secret reads, Docker socket, arbitrary filesystem, and unapproved execution are blocked. |
| 147 | Hermes handoff audit | Completed | Route records `agent_zero.hermes_handoff` audit events with redacted metadata. |
| 148 | Hermes handoff UI | Completed | Agent Network shows the Agent Zero to Hermes handoff protocol card. |
| 149 | Hermes handoff report | Completed | Collaboration result includes report contribution metadata so reports can mention Hermes when used. |
| 150 | Agent Zero asks Hermes test | Completed in automated test | Test prompt: "Ask Hermes to design a skill for email triage." |
| 151 | Hermes returns draft | Completed | Hermes returns a skill proposal only, no execution. |
| 152 | Agent Zero reviews draft | Completed | Result includes Agent Zero review summary and usability flag. |
| 153 | Hermes iteration | Completed | Revision handoff is supported through previous response metadata and tested as planning only. |
| 154 | Multi-agent no-loop guard | Completed | Depth and repeated Hermes chain checks block loops. |
| 155 | Timeout handling | Completed | Timeout returns blocked response without fake completion. |
| 156 | Failure handling | Completed | Unreachable Hermes returns blocked response. |
| 157 | Tests | Completed | Unit coverage added for success, revision, forbidden tasks, unsupported tasks, loop guard, timeout, unreachable Hermes, and audit metadata. |
| 158 | Commit protocol | Pending at report creation | Commit message: `feat(agents): add agent zero hermes collaboration protocol`. |
| 159 | Live collaboration test | Partially blocked | Production route is present and protected; unauthenticated GET/POST return 401. Authenticated owner-session POST was not run from this shell because no owner session credential was available and auth was not bypassed. |
| 160 | Phase report | Completed | This report records the implementation and validation. |

## Files Changed

- `src/lib/agent-zero-hermes-collaboration.ts`
- `src/lib/agent-zero-hermes-collaboration.test.ts`
- `src/app/api/bridge/agent-zero/hermes-handoff/route.ts`
- `src/components/agent-network/AgentNetworkClient.tsx`
- `src/app/api/bridge/button-contracts/route.ts`
- `runtime/agent-zero-hermes-collaboration-report.md`

## Route Contract

`GET /api/bridge/agent-zero/hermes-handoff`

- Shows the read-only collaboration contract.
- Requires authenticated viewer access.
- Returns supported task types, forbidden task list, timeout policy, loop guard, and audit policy.

`POST /api/bridge/agent-zero/hermes-handoff`

- Requires authenticated operator access.
- Accepts `task_type`, `prompt`, optional `agent_zero_task_id`, optional previous Hermes response reference, handoff depth, and agent chain.
- Returns a sanitized owner-safe result with no raw internal IDs.
- Records correlation IDs in audit metadata only.

## Supported Tasks

- `skill_design`
- `workflow_plan`
- `automation_plan`
- `integration_mapping`
- `failure_analysis`
- `docs_report_outline`

## Forbidden Tasks

Hermes blocks:

- direct external writes
- raw root shell
- secret reads
- unapproved execution
- Docker socket access
- arbitrary filesystem access

## Safety Result

- Execution enabled: false.
- Writes enabled: false.
- External writes: not enabled.
- Secrets exposed: no.
- Raw local paths in owner response: no.
- Raw IDs in owner response: no.
- Fake completion: blocked by contract and tests.
- Infinite Agent Zero/Hermes loops: blocked.
- Timeout fake completion: blocked.

## Tests Run

- `git diff --check`: passed.
- `pnpm exec vitest run src/lib/agent-zero-hermes-collaboration.test.ts`: passed, 8 tests.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 99 test files and 1032 tests.

## Route Smoke

Unauthenticated production smoke:

- `GET /api/bridge/agent-zero/hermes-handoff`: 401.
- `POST /api/bridge/agent-zero/hermes-handoff`: 401.
- `/agents`: 401.

Authenticated production POST was not executed because this shell did not have an owner session credential. Auth was not bypassed or weakened.

## Service Status

- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.
- `agent-zero` container: running.

## Blockers

- The live authenticated Mission Control handoff prompt still needs an owner session to run from the UI or authenticated API.
- Hermes remains a planning/specification lieutenant in this route; this phase does not enable Hermes execution.

## No-Secrets Confirmation

- No `.env` changes.
- No auth tokens printed.
- No API keys printed.
- No auth files read or committed.
- No secrets committed.
- No auth weakening.

## Rollback

After commit:

```bash
git revert <commit-hash>
systemctl restart mission-control.service
```
