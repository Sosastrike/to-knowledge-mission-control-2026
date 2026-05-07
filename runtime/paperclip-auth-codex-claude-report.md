# Paperclip Auth, Codex, and Claude Report

Generated: 2026-05-07

## Executive Summary

Paperclip auth and local model-agent adapters must remain separated from Mission Control secrets and production credentials. Codex/ChatGPT and Claude/Anthropic integrations are not to be mixed. Claude/Anthropic should use Claude Code OAuth/subscription auth, not Anthropic API key billing unless explicitly approved by the owner.

Current status: planning/blocked for live Paperclip adapter auth. No Paperclip production secret store was configured in this phase.

## Codex / ChatGPT

- Desired auth mode: existing protected Codex/ChatGPT account auth, not inline API keys.
- Adapter target: Paperclip `codex_local` style adapter, after sandbox review.
- Company-scoped auth home: planned, not activated in production.
- Safe no-write Codex smoke through Paperclip: not proven in this closure block.
- Status: blocked until Paperclip sandbox service/auth is running and a company-scoped adapter test is performed.

## Claude / Anthropic

- Required auth method: `claude_code_oauth`.
- Claude Code path: auto-discover with `command -v claude` when running the auth setup phase.
- Claude token/source: separate protected Claude auth/token source.
- Anthropic API billing: disabled by default.
- `ANTHROPIC_API_KEY`: check only as boolean when running setup; value must never be printed.
- Safe no-write Claude smoke through Paperclip: not proven in this closure block.
- Status: blocked until Claude OAuth/subscription auth is verified safely and Paperclip sandbox adapter is running.

## Separation Rules

- Codex keeps its own OAuth endpoint/auth source.
- Claude/Anthropic must not reuse Codex auth files or Codex endpoint labels.
- No auth files or token paths should appear in owner-facing UI.
- No token or API key values may be printed, committed, or stored inline.
- `.env` must not be modified unless explicitly approved.
- API billing must not be enabled accidentally.

## Paperclip Auth Status

- Owner login: not fully proven.
- Bootstrap invite: sensitive and not included in reports.
- Tailnet UI: previously reachable during sandbox run, currently inactive because Paperclip is not running.
- Current blocker: `paperclip_sandbox_service_not_running`.

## Safe Next Step

Restart Paperclip sandbox in local/Tailnet-only mode, configure auth callback/base URL safely, complete owner login, then run separate no-write Codex and Claude adapter smokes with secret values hidden.

## No-Secrets Confirmation

No API keys, tokens, auth files, `.env` contents, passwords, or secret values are included in this report.
