# Phase 13 - Paperclip Codex and Claude Auth Separation Report

## Result

**PARTIAL / BLOCKED.** Auth sources remain separated. Codex home exists, but Codex CLI and Claude CLI were not available in the production shell used for this proof; no Paperclip no-write model smoke was run.

## Safe Boolean Checks

| Check | Result |
|---|---|
| Codex home present | yes |
| Codex CLI present | no |
| Claude CLI present | no |
| Anthropic API billing key present | no |
| Anthropic API billing enabled | no evidence; not enabled by Codex |
| Tokens printed | no |
| Auth files printed | no |

## Blockers

- paperclip_codex_cli_not_available_in_proof_shell
- paperclip_claude_code_oauth_not_available_in_proof_shell

## Standing Governance

| Rule | Result |
|---|---|
| Secrets printed | No |
| Auth weakened | No |
| .env changed | No |
| Public local service exposure | No |
| SMB/Fork 2 | Not run |
| Zapier/HeyGen writes | Not run |
| External farmers | Not run |
| Architecture naming | OpenClaw+ used as runtime layer; literal legacy service name retained only where required |

## Pi Inclusion

| Field | Current truth |
|---|---|
| Role | Dispatcher / Route Optimizer Candidate |
| Authority | Advisory only; Agent Zero remains commander |
| Execution | Disabled |
| Writes | Disabled |
| Baseline from owner | 35% DESIGN / PENDING / SHADOW |
| Current evidence-based status | 72% PARTIAL GO / SHADOW after Gateway route and recommendation tests |
| Current blocker | Standalone Pi runtime session not proven; in-process Gateway shadow dispatcher is proven |
