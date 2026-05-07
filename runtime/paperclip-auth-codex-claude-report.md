# Paperclip Codex and Claude Auth Separation Proof

Generated: 2026-05-07T22:07:23.842Z

## Executive Result

Paperclip Codex/Claude auth separation is **PARTIAL GO**.

The production host has protected Codex and Claude auth homes present, and the Paperclip sandbox source includes Codex and Claude adapter references. However, neither the Codex CLI nor Claude CLI is available on the production PATH, so no safe no-write model smoke was executed and no adapter is marked live.

## Current Truth

| Area | Result |
| --- | --- |
| Paperclip role | Workforce Control Plane before OpenClaw+ |
| Codex CLI | Unavailable on production PATH |
| Codex auth home | Present, values not inspected |
| Claude CLI | Unavailable on production PATH |
| Claude auth hint | Present, values not inspected |
| Anthropic API key | Not present in checked runtime/config surfaces |
| API billing mode | Avoided by default |
| Paperclip Codex adapter reference | Found in sandbox source |
| Paperclip Claude adapter reference | Found in sandbox source |
| Safe Codex no-write smoke | Blocked: codex_cli_unavailable |
| Safe Claude no-write smoke | Blocked: claude_cli_unavailable |

## Auth Separation Requirements

| Requirement | Status |
| --- | --- |
| Do not mix Claude with Codex auth files | PASS, no combined route was used |
| Codex/ChatGPT account mode preferred | BLOCKED until Codex CLI is installed/proven |
| Claude Code OAuth/subscription mode preferred | BLOCKED until Claude CLI is installed/proven |
| Do not use Anthropic API billing by default | PASS |
| Do not print auth file contents | PASS |
| Do not print tokens or keys | PASS |
| Do not modify .env | PASS |
| Do not commit secrets | PASS |

## Paperclip Adapter Readiness

| Adapter | Source Reference | Runtime CLI | Auth Source | Live Smoke |
| --- | --- | --- | --- | --- |
| Codex / ChatGPT | present | missing | protected home present | blocked |
| Claude / Anthropic | present | missing | protected home hint present | blocked |

## What This Means

Paperclip can be modeled as the workforce control layer and can hold references to Codex and Claude adapters, but it cannot truthfully run those adapters yet. The next production step is to install or expose the official Codex and Claude CLIs in the approved service PATH, then run no-write smoke checks using account/OAuth auth, not API billing.

## Exact Blockers

| Blocker | Impact | Required Fix |
| --- | --- | --- |
| codex_cli_unavailable | Paperclip cannot run a Codex no-write smoke. | Install or expose the approved Codex CLI in the service PATH and verify account auth without printing secrets. |
| claude_cli_unavailable | Paperclip cannot run Claude Code OAuth/subscription smoke. | Install or expose the approved Claude CLI in the service PATH and verify subscription/OAuth auth without printing secrets. |
| paperclip_adapter_runtime_not_registered | Paperclip adapter references exist, but runtime registration is not proven. | Register adapters only after CLI/auth smoke passes. |

## Security Confirmation

- No auth files were printed.
- No token, API key, password, or secret value was printed.
- No .env file was modified.
- No external write was executed.
- No Anthropic API billing key was used.
- No Paperclip task/co-worker action was executed.
- No Zapier, HeyGen, SMB, or farmer action was executed.

## Completion Estimate

| Component | Percent | Status |
| --- | ---: | --- |
| Auth source discovery | 80% | protected homes detected without reading contents |
| Codex adapter source readiness | 55% | reference found, runtime CLI missing |
| Claude adapter source readiness | 55% | reference found, runtime CLI missing |
| Billing avoidance | 95% | API key not present in checked surfaces |
| Live no-write adapter proof | 0% | blocked until CLIs exist |
| Paperclip Codex/Claude auth phase | 48% | PARTIAL GO |

## Final Decision

Paperclip Codex + Claude auth separation: **PARTIAL GO**.

No live adapter execution can be claimed until the Codex and Claude CLIs are installed or exposed in the approved runtime PATH and safe no-write smoke checks pass.
