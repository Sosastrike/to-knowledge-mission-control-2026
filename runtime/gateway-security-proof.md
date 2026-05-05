# Gateway Security Proof

Status: completed.

Scope: Phases 161-170. This phase loads the Gateway governance manifest and records tests for redaction, allowlists, Bridge Session write gates, external-write scope gates, route authentication, Hermes public UI safety, Docker socket denial, and raw root-shell denial.

Completed checks:
- Gateway policies now expose a `security_proof` object through the authenticated policies payload.
- Governance manifest includes Universal Laws, Honesty Protocol, Channels Policy, Preflight, and Redaction Spec metadata without returning raw governance paths or file contents.
- Redaction proof verifies owner output strips secret-like values, auth-file references, raw local paths, task ids, and internal stage names.
- AgentMail send/reply policy remains restricted to approved domains or addresses.
- Writes and external actions require an active Bridge Session.
- Zapier, HeyGen, Google Drive, and OneDrive writes require scoped Bridge Session approval.
- Gateway routes remain authenticated and public/Tailscale-bypassing access is not enabled.
- Hermes is not exposed as a public unauthenticated UI surface by Gateway policy.
- Docker socket, raw root shell, and direct secret reads remain forbidden surfaces.

Safety confirmation:
- No secrets, API keys, tokens, auth files, or `.env` values were printed or committed.
- No external writes were run.
- No Zapier writes, HeyGen generation, SMB mount, farmer execution, AgentMail send, Drive upload, or OneDrive upload occurred.

Validation:
- Focused Gateway security tests were added for governance loading, redaction, allowlists, Bridge Session write gates, external-write scopes, public Hermes UI exposure detection, Docker socket denial, root-shell denial, and direct secret-read denial.
- Route authentication coverage remains in `src/lib/gateway-route-auth.test.ts`.

Rollback:
- Revert the phase commit with `git revert <commit>`.
