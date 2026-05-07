# Paperclip Live Sandbox Smoke Report

Generated: 2026-05-07

## Scope

This report covers the fresh Phase 000 research and sandbox-install smoke for Paperclip Gateway integration. It is sandbox-only. No production Paperclip service was installed, no public route was opened, and no Mission Control `.env` file was modified.

## Current Sandbox Access

- Localhost URL: `http://localhost:3100`
- Current localhost health: not active in this run because Paperclip is bound to Tailnet-only mode.
- Tailnet URL: `http://100.116.35.95:3100`
- Current Tailnet UI health: HTTP 200.
- Current Tailnet API health: HTTP 200, status `ok`.
- Public exposure: not opened. The listener is on the Tailnet address for port `3100`.
- Persistent service: not enabled.

## Owner Login

- Auth mode: authenticated/private sandbox.
- Auth system: ready.
- Owner login: not fully proven in this smoke because no owner browser-login completion was verified.
- Bootstrap/invite material: treated as sensitive and not recorded.

## Codex / ChatGPT Auth

- Codex CLI: present.
- Codex login status: present, but reports API-key mode.
- ChatGPT account auth through Paperclip: not proven.
- Paperclip `codex_local` adapter package: present.
- Safe Paperclip Codex adapter smoke: not run because Paperclip owner login/company context is not proven yet.
- Billing note: Codex API-key mode may use API billing; do not claim ChatGPT account billing avoidance for Codex yet.

## Claude / Anthropic Auth

- Claude CLI: present.
- Claude login status: first-party Claude subscription auth is present.
- Anthropic API key in checked shell: false.
- API billing avoided for Claude path: yes, based on first-party Claude auth and absent Anthropic API key in the checked shell.
- Paperclip `claude_local` adapter package: present.
- Safe Paperclip Claude adapter smoke: not run because Paperclip owner login/company context is not proven yet.

## Workforce / Co-Worker Capability

Paperclip can model companies, agents, issues, work products, heartbeats, budgets, approvals, adapters, and local agent runtimes. Gateway dry-run contracts already cover:

- Agent Zero task handoff.
- Hermes proposal handoff.
- Pi dispatcher recommendation.
- SpaceAgent research-task/work-product flow.
- Co-worker definition creation.
- Co-worker lifecycle tracking.
- Co-worker policy validation.
- Token governor budget dry-run.

Live creation/management inside Paperclip is not proven yet because authenticated owner/company access was not completed in this smoke.

## Worker / Adapter Registration Readiness

Ready as design/adapter candidates, not live-registered in Paperclip DB yet:

- Agent Zero: commander worker/decision authority.
- Hermes: lieutenant and skill/workflow builder.
- Pi: dispatcher candidate / route optimizer.
- SpaceAgent: web/browser/YouTube/Firecrawl research specialist.
- OpenCloud: worker/runtime engine.
- OpenClaw+: runtime/skills/adapters layer.

Live registration requires owner login, company context, and write-safe registration flow.

## Validation Results

- Frozen install: passed.
- Typecheck: passed.
- Build: passed.
- Full Paperclip test run: partial pass with two known Tailnet-environment expectation failures.
- Passing groups observed: shared, database, adapter-utils, acpx, Codex adapter, OpenCode adapter, UI, and most CLI tests.
- Failing tests:
  - `network-bind.test.ts`: expected loopback fallback when Tailnet is unavailable, but server has Tailnet address.
  - `onboard.test.ts`: same Tailnet fallback expectation.

## Safety Confirmation

- No production install.
- No public exposure.
- No `.env` modification in Mission Control.
- No secrets printed or committed.
- No external writes.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No external farmer execution.
- No existing agent replacement.

## Final Recommendation Before Production Wiring

Keep Paperclip in sandbox/Tailnet-only mode. Before production wiring, complete these in order:

1. Owner completes Paperclip login through the Tailnet URL.
2. Create a sandbox company context for To Knowledge Gateway.
3. Register Agent Zero, Hermes, Pi, SpaceAgent, OpenCloud, and OpenClaw+ as sandbox workers/adapters.
4. Run no-write Codex and Claude adapter smokes from inside Paperclip.
5. Resolve or formally waive the two Tailnet test failures.
6. Add a Gateway write adapter only after Bridge Session policy and audit are enforced.
7. Rerun full Paperclip and Mission Control validation.

Final status: sandbox health is good on Tailnet. Production wiring is not approved yet.
