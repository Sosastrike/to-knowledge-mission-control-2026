# Model / Provider Production Proof

Generated: 2026-05-07T22:22:15.991Z

## Executive Result

Model/provider access is **PARTIAL GO** for registry and read-only discovery. Gateway can show model/provider status, but live Codex/Claude provider execution is blocked because the production PATH does not expose those CLIs. No billable model call was executed.

## Production Route Evidence

| Check | Result |
| --- | --- |
| Gateway data-layer getModels | 200, read-only, execution false |
| Bridge providers | 200, 8 providers visible |
| Gateway models node | 200, read_only |
| Unauthenticated getModels | 401 |
| Codex CLI | unavailable on PATH |
| Claude CLI | unavailable on PATH |
| Ollama CLI | installed, version 0.20.4 |
| NVIDIA CLI | unavailable on PATH |

## Credential Presence Booleans

| Provider key | Present in checked process env |
| --- | --- |
| OPENROUTER_API_KEY | false |
| OPENAI_API_KEY | false |
| ANTHROPIC_API_KEY | false |
| GEMINI_API_KEY | false |
| GROQ_API_KEY | false |

No key values were printed or inspected.

## Provider Decision

| Provider | Status | Notes |
| --- | --- | --- |
| OpenRouter | registry-visible, live key not present in checked env | blocked for live call |
| OpenAI | registry-visible, live key not present in checked env | blocked for live call |
| Claude / Anthropic | CLI unavailable, API key absent | subscription/OAuth CLI proof required; API billing avoided |
| Codex / ChatGPT | CLI unavailable on production PATH | account auth cannot be smoke-tested yet |
| Ollama | CLI installed | local model path can be evaluated in later scoped smoke |
| NVIDIA / Groq / Gemini | not live-proven | blocked until configured/proven |

## Security Confirmation

- No model call was executed.
- No API key value was printed.
- No auth file was printed.
- No .env changes were made.
- No Anthropic API billing path was used.
- Unauthenticated model discovery route returned 401.

## Completion Estimate

| Component | Percent | Status |
| --- | ---: | --- |
| Registry/provider visibility | 80% | live read-only routes |
| Auth protection | 90% | unauthenticated blocked |
| Ollama CLI proof | 70% | CLI installed, no model call |
| Codex CLI proof | 0% | CLI unavailable |
| Claude CLI proof | 0% | CLI unavailable |
| External provider live calls | 0% | no keys/no calls |
| Model/provider overall | 45% | PARTIAL GO |

## Remaining Blockers

| Blocker | Impact | Exact Next Step |
| --- | --- | --- |
| codex_cli_unavailable | Codex/ChatGPT plugin cannot be proven live. | Install/expose approved Codex CLI and run no-write smoke. |
| claude_cli_unavailable | Claude Code OAuth cannot be proven live. | Install/expose approved Claude CLI and run no-write smoke. |
| provider_keys_not_present_in_checked_env | OpenRouter/OpenAI/Gemini/Groq live calls cannot be proven from this runtime. | Configure approved secret source without printing values. |

## Final Decision

Models/providers: **PARTIAL GO**.

Discovery works. Live provider execution remains blocked until CLI/auth or approved secret sources are configured and smoke-tested.