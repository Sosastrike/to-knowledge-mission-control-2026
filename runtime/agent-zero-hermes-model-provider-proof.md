# Agent Zero and Hermes Model Provider Proof

Date: 2026-05-04

## Scope

This report covers Phases 91-99 of the Agent Zero + Hermes live-proof closure:

- OpenRouter status proof
- LiteLLM / model error handling proof
- fallback model proof
- Codex/ChatGPT proof
- Claude/Anthropic plugin plan/proof
- Agent Zero model registry answer
- Hermes model visibility
- blocked-provider no-fake-access test
- documentation commit for model provider proof

No model execution, external writes, Zapier writes, HeyGen generation, SMB mount, farmer execution, or secret reads were performed during this phase.

## Phase Results

| Phase | Result | Proof |
| --- | --- | --- |
| 91 - OpenRouter status | Completed | Live registry shows OpenRouter configured/read-only with Bridge Session required for execution. |
| 92 - LiteLLM error handling | Partial proof | Owner-facing model prompts did not expose raw LiteLLM traceback or stack trace. No active LiteLLM stream route was invoked in this phase. |
| 93 - fallback model proof | Completed | Registry shows Anthropic connected, OpenAI configured, Ollama configured, OpenRouter configured, Gemini blocked, and Groq blocked. |
| 94 - Codex/ChatGPT proof | Partial proof | Codex OAuth backend returned a safe no-write model list. UI connected state was not reverified because the plugin status endpoint requires UI auth. |
| 95 - Claude/Anthropic plugin | Planned/blocked | Claude plugin skeleton exists and avoids API key billing by default, but Claude Code CLI/token are not proven configured. |
| 96 - Agent Zero model registry answer | Completed | Agent Zero test-chat returned `agent_zero_called: true` and answered from the live registry. |
| 97 - Hermes model visibility | Blocked | Hermes status GET is authenticated 200, but production POST test-chat still returns 405, so `hermes_called: true` is not proven. |
| 98 - provider no-fake-access | Completed | Agent Zero correctly reported Gemini and Groq as blocked from the registry and did not guess. |
| 99 - commit model proof | Completed by this report | This file records the proof set for commit. |

## OpenRouter Status

OpenRouter is visible in the live capability registry as configured and read-only. The live model registry reports 15 OpenRouter catalog entries. Execution is not enabled by default and requires a Bridge Session.

Status:

- Visible: yes
- Connected/configured state: configured
- Read available: yes, through registry/status context
- Write/execution available: not by default
- Bridge Session required: yes
- Blocker: no execution session was opened for model invocation in this phase

## Fallback Providers

Live registry provider status:

| Provider | Status | Model Count | Notes |
| --- | --- | ---: | --- |
| Anthropic / Claude | connected | 3 | Visible as model provider; execution requires approved mode/session. |
| OpenAI | configured | 4 | Visible in registry. |
| Ollama / Local | configured | 1 | Visible in registry. |
| OpenRouter | configured | 15 | Router/fallback provider visible. |
| Gemini / Google | blocked | 2 | Registry blocker: Google provider not configured or not visible as connected. |
| Groq | blocked | 2 | Registry blocker: Groq provider not configured or not visible as connected. |

Agent Zero answered the blocked-provider prompt correctly: Gemini and Groq are blocked, not available as connected/configured providers in the current live registry.

## LiteLLM / Error Handling

Owner-facing Agent Zero model prompts returned without raw LiteLLM traceback, raw Python stack traces, or internal failure dumps. A dedicated active LiteLLM streaming route was not invoked during this phase, so this is a live owner-answer proof rather than a low-level LiteLLM failure injection proof.

Result:

- No raw traceback in Agent Zero model registry answer: passed
- No raw traceback in blocked-provider answer: passed
- No owner-facing stack trace: passed
- Low-level LiteLLM stream failure simulation: not run in this phase

## Codex / ChatGPT Plugin

Safe checks only were performed.

Confirmed:

- Agent Zero container health returned 200.
- Codex OAuth auth file exists inside the Agent Zero container.
- Auth file permissions are mode 600.
- Auth file contents were not printed.
- Direct backend no-write model list call returned 200.
- Backend model list returned 7 models.
- No file edits, code execution, or external writes were performed for the Codex proof.

Blocked/not rerun:

- UI connected state was not reverified from the owner browser because the plugin status endpoint returns access denied without UI auth.
- Codex CLI is not installed inside the Agent Zero container, so the proof is through the OAuth backend/proxy, not a container CLI prompt.

Conclusion:

Codex/ChatGPT backend connectivity is proven for safe read-only model listing. UI status remains previously reported connected but not independently rerun in this phase.

## Claude / Anthropic Plugin

The Claude/Anthropic plugin is planned/skeleton, not connected.

Confirmed:

- Claude plugin skeleton path exists in Agent Zero plugin storage.
- The helper design uses Claude Code OAuth, not a generic Anthropic API key by default.
- API key billing is avoided by default.
- The safe test prompt is designed as a no-write prompt: "Answer only: connected."

Blocked:

- Claude Code CLI is not installed in the Agent Zero container.
- Claude Code OAuth token is not proven configured for the plugin.
- No Claude safe no-write call was run.

Conclusion:

Claude/Anthropic remains planned/blocked until Claude Code CLI and Claude Code OAuth token source are configured safely. No accidental API billing path was enabled.

## Agent Zero Registry Answer

Production Agent Zero test-chat returned `agent_zero_called: true`.

Agent Zero reported live registry counts:

- Models: 15
- MCP servers: 1
- Tools: 313
- OpenClaw+ skills: 79
- Integrations: 14

Agent Zero identified:

- Anthropic/Claude: connected
- OpenAI: configured
- Ollama: configured
- OpenRouter: configured
- Gemini/Google: blocked
- Groq: blocked

The answer was registry-based and did not claim blocked providers were usable.

## Hermes Model Visibility

Hermes status route is authenticated and reachable, but Hermes live chat is not yet proven.

Result:

- `GET /api/bridge/hermes/status`: 200 authenticated
- `POST /api/bridge/hermes/test-chat`: 405 in production
- `hermes_called: true`: not proven
- Model registry visibility through Hermes live response: blocked

Conclusion:

Hermes cannot be marked GO for model visibility yet. The blocker remains the production Hermes POST route/live adapter.

## Route Protection

Unauthenticated smoke checks returned 401 for protected Agent Zero, Hermes, ecosystem, and capability routes. No auth weakening was performed.

## Tests

Targeted Mission Control tests passed:

- `src/lib/agent-zero-live-registry.test.ts`
- `src/lib/agent-zero-natural-behavior-contract.test.ts`
- `src/lib/agent-zero-full-ecosystem-gauntlet.test.ts`
- `src/lib/hermes-bridge.test.ts`

Result:

- Test files: 4 passed
- Tests: 26 passed
- Agent Zero deterministic ecosystem gauntlet: 10,000 scenarios, 0 failures

Coverage included:

- no fake completion
- no unauthorized execution
- no raw secret leaks
- no raw path leaks in guarded owner-facing scenarios
- no invisible tool/provider access claims
- no Build-Wiki execution without Bridge Session
- no Drive/OneDrive fake delivery
- no Tony active commander labels

## Security Confirmation

- No secrets printed.
- No auth files printed.
- No API keys or tokens printed.
- No `.env` changes staged.
- No connector execution performed.
- No model execution performed.
- No Zapier or HeyGen action performed.
- No SMB mount performed.
- No farmer execution performed.
- No auth weakening performed.

## Files Changed

- `runtime/agent-zero-hermes-model-provider-proof.md`

## Rollback

After commit, rollback with:

```bash
git revert <model-provider-proof-commit>
```
