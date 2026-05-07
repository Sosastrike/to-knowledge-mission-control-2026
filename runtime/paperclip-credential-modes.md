# Paperclip Credential Modes

Generated: 2026-05-07

## Summary

Paperclip credential handling is modeled as strict secret-reference governance for production and private modes. Paperclip must not receive inline API keys, owner-visible token values, raw auth files, or environment dumps. Owner-facing Mission Control surfaces should show only configured booleans, safe auth method names, and secret-reference labels.

## Credential Subjects

| Subject | Auth method | Storage mode | Owner UI behavior | Billing behavior |
| --- | --- | --- | --- | --- |
| ChatGPT/Codex | chatgpt_codex_oauth | protected_local_auth_home | show configured true/false only; no auth-file path | no direct API billing implied by this mode |
| Claude/Anthropic | claude_code_oauth | protected_secret_ref | show configured true/false only; no token or auth-file path | Anthropic API billing disabled by default |

## Production / Private Strict Mode

- Strict secrets mode is enabled for production and private mode.
- Inline secret values are blocked.
- Auth-file paths are hidden and treated as a policy failure if supplied to owner-visible payloads.
- Environment values are never emitted.
- Paperclip secret references are allowed only as labels, not values.
- Actual execution still requires Gateway policy and Bridge Session scope.

## Tests

The Paperclip bridge test suite now covers:

- Paperclip secret references instead of inline keys.
- Strict secrets mode for production/private mode.
- ChatGPT/Codex protected local auth/home mode.
- Claude Code OAuth protected secret-ref mode.
- No owner UI secret values.
- No owner UI auth-file paths.
- Failed staged secret scan handling.
- No environment leakage.
- No auth-file leakage.

## No-Secrets Confirmation

No credentials, auth files, token values, passwords, or environment values are included in this document.
