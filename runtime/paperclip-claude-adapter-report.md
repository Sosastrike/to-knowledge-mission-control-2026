# Paperclip Claude/Anthropic Adapter Audit

Date: 2026-05-06

## Scope

This report covers Paperclip integration phases 071-080 for the Claude/Anthropic adapter track. The work was limited to safe discovery, adapter registration verification, and no-write smoke testing. No production Paperclip service was persisted and no public access was opened.

## Phase Status

| Phase | Result |
| --- | --- |
| 071 - Check Claude CLI installed | Passed |
| 072 - Run Claude version check | Passed |
| 073 - Check Claude auth safely | Passed |
| 074 - Confirm Claude Code subscription login | Passed |
| 075 - Check ANTHROPIC_API_KEY presence | Passed, values not printed |
| 076 - Warn about API key override risk | Included below |
| 077 - Owner login/setup-token if needed | Not needed now |
| 078 - Token storage rule | No token moved or exposed |
| 079 - Register Claude/Anthropic adapter in Paperclip | Existing built-in adapter confirmed |
| 080 - Safe no-write Claude smoke | Passed |

## Claude CLI

- Installed: yes
- Version: 2.1.126 (Claude Code)
- Authenticated: yes
- Auth method: claude.ai / Claude Code OAuth
- API provider mode: first-party subscription
- Subscription mode observed: Max
- Credential files: present, non-empty, owner-only file permissions
- Credential contents printed: no

## API Billing Guardrail

- ANTHROPIC_API_KEY in shell environment: no
- ANTHROPIC_API_KEY in Mission Control environment files: no
- ANTHROPIC_API_KEY in ClaudeClaw environment file: yes, value not printed
- Billing warning: if ANTHROPIC_API_KEY is inherited by a Paperclip or Claude adapter runtime, it may override subscription OAuth behavior and route calls through Anthropic API billing. For this phase, the safe smoke commands did not load the ClaudeClaw environment file.

## Paperclip Adapter Registration

- Paperclip Claude local adapter present: yes
- Server registry includes claude_local: yes
- UI adapter surface exists: yes
- Adapter mode: local Claude Code CLI through Claude Code OAuth/subscription
- Anthropic API billing enabled by default: no
- Separate from Codex/ChatGPT auth: yes
- Codex auth files reused for Claude: no

## Safe No-Write Smoke

Direct Claude smoke:
- Result: passed
- Prompt contract: respond only with connected
- Tool use: none observed
- File edits: none
- External writes: none

Paperclip Claude adapter environment probe:
- Result: passed
- Checks passed: command resolvable, valid working directory, subscription mode possible, hello probe passed
- File edits: none
- External writes: none

## Tests

Focused Paperclip Claude adapter tests:
- Test files: 3 passed
- Test cases: 18 passed
- Skipped tests: none in focused run
- Commands executed with the Node 24 runtime already used for this workspace

## Security Confirmation

- Secrets printed: no
- Auth files printed: no
- API keys printed: no
- Tokens printed: no
- .env files modified: no
- Credentials committed: no
- Public Paperclip exposure: no
- Persistent Paperclip service created: no
- External writes performed: no

## Remaining Blockers

- Production Paperclip company/agent registration still requires the owner login/company bootstrap path before production use.
- A persistent Paperclip service decision is still pending.
- Before enabling Claude for Paperclip production tasks, ensure the Claude adapter process does not inherit ANTHROPIC_API_KEY when the intended mode is Claude Code OAuth/subscription.

## Rollback

This phase is report-only. Roll back the report commit with:

    git revert <commit>
