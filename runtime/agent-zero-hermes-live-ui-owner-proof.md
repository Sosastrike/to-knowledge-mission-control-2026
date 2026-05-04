# Agent Zero + Hermes Live UI and Owner-Route Proof

Date: 2026-05-04

## Scope

This report covers Phases 110-119:

- Agent Network browser smoke
- Brain Sync browser smoke
- capability registry browser smoke
- Agent Zero status/test-chat smoke
- Hermes status/test-chat smoke
- Telegram owner route proof
- Agent Zero voice proof
- Tony no-response proof
- BotFather note
- live UI proof commit

During this phase I also fixed a discovered owner-facing context regression: the Agent Zero read-only context could still receive a legacy Tony provider/agent record marked active from an upstream provider registry. The code now normalizes Tony/Tony Legacy/Tony v2 records to `tony_legacy` retired, hidden, non-owner-facing, non-executable, and not active commander before Agent Zero receives the context.

## Browser Smoke Result

Browser Use opened Mission Control at the public URL and reached the sign-in page.

Result:

- Public Mission Control URL reachable: yes
- Browser profile authenticated: no
- Auth was not weakened or bypassed.
- No credentials were typed.
- No cookies or tokens were printed.

Because the in-app browser profile was not authenticated, authenticated visual browser smoke could not be completed in the browser. Authenticated route smoke was run from the server with a temporary session, then the temporary session was removed.

## Authenticated Route Smoke

Authenticated production route results:

| Route | Result |
| --- | --- |
| `GET /api/bridge/capability-matrix` | 200 |
| `GET /api/bridge/agent-zero/ecosystem` | 200 |
| `GET /api/bridge/brain-sync/status` | 200 |
| `GET /api/bridge/agent-zero/status` | 200 |
| `POST /api/bridge/agent-zero/test-chat` identity prompt | 200 |
| `POST /api/bridge/agent-zero/test-chat` commander prompt | 200 |
| `GET /api/bridge/hermes/status` | 200 |
| `POST /api/bridge/hermes/test-chat` | 405 |

Unauthenticated route smoke:

| Route | Result |
| --- | --- |
| `GET /api/bridge/agent-zero/status` | 401 |
| `GET /api/bridge/hermes/status` | 401 |

## Phase Results

| Phase | Status | Proof |
| --- | --- | --- |
| 110 - Agent Network browser smoke | Partial | Browser reached auth wall. Authenticated route smoke confirmed Agent Zero, Hermes, and Tony Legacy hierarchy signals; source fix added for legacy Tony context normalization. |
| 111 - Brain Sync browser smoke | Partial | Browser reached auth wall. Authenticated Brain Sync route returned 200 and showed Agent Zero, Hermes, Obsidian, MemPalace, Graphify, and Build-Wiki/Farmer visible. Some exact UI label strings were not present in the route payload. |
| 112 - Capability registry browser smoke | Partial | Browser reached auth wall. Authenticated capability/ecosystem routes returned 200 and showed tools, models, skills, integrations, and MCP visible. |
| 113 - Agent Zero page smoke | Passed by route | Status route returned 200 and test-chat returned `agent_zero_called: true`. |
| 114 - Hermes page smoke | Blocked | Status route returned 200, but test-chat still returns 405, so `hermes_called: true` is not proven. |
| 115 - Telegram owner route proof | Not live-rerun | The requested real owner Telegram prompt was not sent in this phase. Code/tests confirm active command routing is Agent Zero, but no new real inbound Telegram message was observed. |
| 116 - Agent Zero voice proof | Passed by capability/test | ClaudeClaw voice capability reports TTS true for `agent-zero` and `agent_zero`, false for `tony`; voice tests passed. No live ElevenLabs synthesis was run. |
| 117 - Tony no-response proof | Partial | Config/tests show active commander ID is `agent-zero`, Tony TTS is false, and Agent Zero answers commander prompts. Real Telegram no-response proof was not rerun. |
| 118 - BotFather note | Documented | If the visible Telegram bot display name still says Tony, rename is external owner-controlled through BotFather. Code cannot rename BotFather display identity here. |
| 119 - Commit live UI proof | Completed by this report | This file and the context normalization fix record the proof. |

## Agent Network Result

Authenticated route smoke confirmed:

- Agent Zero present: yes
- Commander label/signal present: yes
- Hermes present: yes
- Hermes lieutenant label/signal present: yes
- Tony Legacy present only as legacy/retired signal: yes
- Tony active commander signal: no

Discovered regression:

- Agent Zero read-only test-chat context included an upstream provider registry entry with Tony marked active.

Fix applied:

- `buildAgentZeroReadOnlyContext()` now normalizes `tony`, `tony_legacy`, and `tony_v2` records into `tony_legacy` retired/hidden/non-executable/non-owner-facing before context reaches Agent Zero.
- Tests now fail if Tony remains as an active provider/agent in Agent Zero read-only context.

Production note:

- The source fix is committed in this phase, but production needs a rebuild/restart before that context normalization is live in the running standalone process.

## Brain Sync Result

Authenticated Brain Sync route returned 200 and showed:

- Agent Zero visible: yes
- Hermes visible: yes
- Obsidian visible: yes
- MemPalace visible: yes
- Graphify visible: yes
- Build-Wiki/Farmer visible: yes
- `Agent Zero reports to Tony` / `Subordinate to Tony`: not present

Exact route-payload text for "primary brain operator", "main nucleus", and "secondary" was not present in the checked route output, so the browser/UI label proof remains partial until authenticated browser rendering is available or the Brain Sync route exposes explicit hierarchy labels.

## Capability Registry Result

Authenticated capability/ecosystem routes returned 200 and showed visibility for:

- Tools
- Models
- Skills
- Integrations
- MCP

No external connector writes were run.

## Agent Zero Page Result

Agent Zero route smoke:

- Status route: 200
- Test-chat identity prompt: 200
- `agent_zero_called: true`
- Identity reply: "Good morning, Sir. I’m Agent Zero — the active Mission Control ecosystem commander for this test environment."
- Commander reply: "Agent Zero is commander now. Hermes is lieutenant when health and read-only onboarding prove it; Tony is retired and archived."

## Hermes Page Result

Hermes route smoke:

- Status route: 200
- Test-chat route: 405
- `hermes_called: false`
- Blocker: `method_not_allowed`

Hermes owner-access remains blocked until production loads a working POST handler/live adapter for `/api/bridge/hermes/test-chat`.

## Telegram Owner Route

Code/test proof:

- ClaudeClaw `ACTIVE_COMMANDER_AGENT_ID` is `agent-zero`.
- ClaudeClaw owner task defaults assign `agent-zero`.
- Telegram owner task tests passed.
- Agent Zero identity and commander prompts pass through Mission Control test-chat.

Not live-rerun:

- I did not synthesize or fake the owner Telegram prompt "Good morning. Who are you?"
- No new real inbound Telegram owner message was observed in this phase.

## Voice Proof

ClaudeClaw voice capability check:

| Agent ID | STT | TTS |
| --- | --- | --- |
| `agent-zero` | true | true |
| `agent_zero` | true | true |
| `tony` | true | false |

Tests passed:

- `src/voice.test.ts`
- `src/config.test.ts`
- `src/telegram-owner-task-core.test.ts`

Result:

- Test files: 3 passed
- Tests: 28 passed

No live ElevenLabs synthesis was run, and no voice IDs or API keys were printed.

## Tony No-Response Result

Confirmed:

- Mission Control Agent Zero test-chat says Agent Zero is commander.
- Agent Zero says Tony is retired and archived.
- ClaudeClaw active commander constant is `agent-zero`.
- Tony TTS is false.
- Agent Zero context normalization now prevents active Tony provider/agent leakage in source/tests.

Not confirmed in this phase:

- A real inbound owner Telegram message proving Tony does not answer was not sent or observed.

## BotFather Note

If the visible Telegram bot display name still says Tony, that rename is external owner-controlled through Telegram BotFather. This phase did not and cannot rename the Telegram bot account display identity from code without owner-side BotFather control.

## Tests Run

Mission Control:

- `git diff --check`: passed
- `pnpm run typecheck`: passed
- `pnpm test src/lib/agent-zero-bridge.test.ts src/lib/agent-zero-live-registry.test.ts src/lib/agent-zero-natural-behavior-contract.test.ts`: 3 files, 19 tests passed

ClaudeClaw:

- `npm test -- src/voice.test.ts src/config.test.ts src/telegram-owner-task-core.test.ts`: 3 files, 28 tests passed

## Services

Service status during proof:

- `mission-control.service`: active
- `claudeclaw.service`: active
- `hermes-gateway.service`: active

## Security Confirmation

- No secrets printed.
- No auth files printed.
- No API keys or tokens printed.
- No `.env` changes.
- No auth weakening.
- Temporary authenticated route-smoke session was removed after use.
- No external writes.
- No email send.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No farmer execution.
- No live ElevenLabs synthesis.

## Files Changed

- `src/lib/agent-zero-bridge.ts`
- `src/lib/agent-zero-bridge.test.ts`
- `runtime/agent-zero-hermes-live-ui-owner-proof.md`

## Remaining Blockers

- Authenticated browser UI smoke needs a logged-in browser session; current in-app browser reached the sign-in page only.
- Production Mission Control must be rebuilt/restarted for the Tony context normalization fix to be live in the standalone process.
- Hermes POST test-chat still returns 405 in production.
- Real inbound Telegram owner prompt was not rerun.
- BotFather display-name rename, if needed, remains owner-side external work.

## Rollback

After commit, rollback with:

```bash
git revert <live-ui-owner-proof-commit>
```
