# Mission Control Production Readiness Breakdown

Generated: 2026-05-07

## Executive Summary

Current overall status: PARTIAL GO.

The project has made substantial progress in code, tests, Gateway architecture, Agent Hub, Paperclip modeling, SpaceAgent research routing, and Playwright MCP runtime integration. The system is not fully production-complete yet because the latest Mission Control production service has not been restarted onto the newest build, Hermes live chat is still not proven with `hermes_called:true`, Paperclip is not active as a live workforce service, and external delivery/write connectors still need Bridge Session-scoped proof.

The most important immediate blocker is administrator restart access for `mission-control.service`. The latest code is built, tested, committed, and pushed, but production cannot honestly be claimed updated until the service restart happens and authenticated route/browser smoke tests pass.

## Current Production Decision

| System | Current Decision | Percent | Reason |
| --- | --- | ---: | --- |
| Agent Zero | PARTIAL GO | 89% | Production test-chat proof previously returned `agent_zero_called:true`; commander routing and live context are working, but final delivery, owner-channel, and newest production code proof still depend on restart/smoke. |
| Hermes | NO-GO live / partial read-only | 42% | Service and status route exist, but live `hermes_called:true` is not proven. Prior production POST returned 405/stale route behavior. |
| Mission Control production | PARTIAL GO | 86% | Full build and tests pass, but root service restart requires administrator authentication. |
| Gateway core | PARTIAL GO | 86% | Gateway APIs, registry, policy, events, data layer, Agent Hub, and reports are implemented, but live production proof requires restart and authenticated smoke. |
| Agent Hub / Control Center | Built, pending production smoke | 82% | Code and metadata are committed. Owner-facing production view needs Mission Control restart/browser proof. |
| SpaceAgent | PARTIAL GO | 72% | Gateway role, route contracts, research packets, gauntlets, and Playwright MCP path are implemented; SpaceAgent standalone install/live service is not fully proven; Firecrawl credential is missing. |
| Playwright MCP | PARTIAL GO | 86% | Local-only service is active and MCP smoke passed; production Mission Control UI/API proof is blocked by service restart. |
| Paperclip | PARTIAL GO read-only / NO-GO live ops | 68% | Gateway workforce model, reports, bridge contracts, and gauntlets exist; Paperclip service is not active for live workforce operations. |
| Mini-agent operating system | Design/test partial | 70% | Schemas, policies, gauntlets, and route concepts are present; production execution remains disabled until Bridge Session and live supervisor proof. |
| Brain / Obsidian / MemPalace / Graphify / Build-Wiki | PARTIAL GO | 80-85% | Read/status context works in reports/tests; writes remain Bridge Session-gated or blocked pending adapter proof. |
| OpenCloud / Build-Wiki / Farmer | KEEP / governed runtime | 70% | OpenCloud is retained as worker/runtime. Build-Wiki/Farmer visible; Run Now remains scoped to `opencloud-docs-farmer.service`; Fork 2/SMB blocked. |
| External connectors | PARTIAL GO | 58% | Some registry/status visibility exists; Firecrawl missing credential, OneDrive/n8n blocked, writes/uploads/sends need Bridge Session proof. |
| Overall ecosystem | PARTIAL GO | 84-85% | Strong code/test baseline, but production restart, Hermes live call, Paperclip live service, and delivery/write proofs remain. |

## What Is Already Executed

### Mission Control / Gateway

Executed:

- Gateway transformation is implemented in code and reports.
- Agent Network naming has been migrated to Gateway in active surfaces while compatibility aliases remain.
- Gateway registry, status, nodes, flows, policies, events, observability, data-layer, docs, and replay-safe routes exist in code.
- Gateway policy layer blocks protected writes without Bridge Session.
- Gateway tests passed in the full suite.
- Agent Hub / Control Center production surface was added.
- Paperclip is modeled before OpenClaw+ in the operating chain.
- OpenCloud remains a worker/runtime engine, not a deletion target.

Pending:

- Production Mission Control restart.
- Authenticated owner browser smoke for Gateway / Agent Hub.
- Authenticated API smoke after restart.

### Agent Zero

Executed:

- Agent Zero is the active commander in the reports and Gateway model.
- Prior production proof recorded `agent_zero_called:true`.
- Agent Zero can live-query Mission Control context according to the 24-hour operational report.
- Agent Zero 10,000-scenario ecosystem gauntlet passed with zero failures.
- Tony is not modeled as active commander; Tony remains historical/archive only.

Pending:

- Re-run authenticated owner prompts after Mission Control restart.
- Re-run live Gateway registry/status query after restart.
- Complete report delivery proof through approved channel.
- Complete Bridge Session execution proofs for safe scoped actions.

### Hermes

Executed:

- Hermes service is active.
- Hermes status route exists in Mission Control.
- Hermes is modeled as lieutenant / skill-workflow specialist under Agent Zero.
- Hermes guardrail and natural behavior tests exist.
- Hermes remains read-only/gated unless a Bridge Session allows more.

Pending:

- Production `POST /api/bridge/hermes/test-chat` must return either `hermes_called:true` or a safe exact blocker.
- Agent Zero to Hermes live collaboration must be proven.
- Hermes workflow/skill design must be tested through production Mission Control.

### SpaceAgent / Playwright MCP

Executed:

- SpaceAgent is modeled as the browser, web, YouTube, Firecrawl, and Playwright MCP research specialist.
- Playwright MCP repo was audited.
- Playwright MCP is installed as a local-only user service.
- Service listens only on `127.0.0.1:8931`.
- Direct MCP smoke passed with 23 tools, safe navigate, and accessibility snapshot.
- Mission Control code adds Playwright MCP status and evidence routes.
- Gateway / Agent Hub metadata shows Playwright MCP connected local-only under SpaceAgent.
- Full Mission Control suite passed after Playwright work: 132 test files and 1,234 tests.
- Reports were generated and pushed:
  - `runtime/playwright-mcp-production-report.md`
  - `runtime/playwright-mcp-production-report.pdf`
  - `runtime/playwright-mcp-developer-handoff-report.md`
  - `runtime/playwright-mcp-developer-handoff-report.pdf`

Pending:

- Restart Mission Control to load the new routes.
- Authenticated status route smoke.
- Authenticated evidence route smoke.
- Gateway / Agent Hub browser proof that owner can see Playwright MCP under SpaceAgent.
- Firecrawl credential and route proof remain separate blockers.

### Paperclip

Executed:

- Paperclip was researched and modeled as Workforce Control Plane.
- Correct chain is now: Owner -> Gateway -> Agent Zero / Pi / Hermes -> Paperclip -> OpenClaw+ -> mini-agents / specialist agents / skills / tools / reports / approvals.
- Paperclip reports and gauntlet proof exist.
- Paperclip bridge contracts and policy-gated dry-run payloads exist.
- 1,000 deterministic Paperclip routing scenarios passed.

Pending:

- Paperclip service is not active for live operations.
- Local health endpoint and Tailnet UI must be proven again.
- Owner login must be proven.
- Live task/co-worker creation must remain blocked until sandbox and Bridge Session policies pass.

### Mini-Agent Gateway Operating System

Executed:

- Mini-agent schemas, policy concepts, memory TTL rules, documentation requirements, and gauntlet tests are represented in Gateway work.
- Mini-agents are subordinate workers and cannot self-promote.
- Every mini-agent must have a supervisor, scope, allowed tools, forbidden tools, memory TTL, output contract, expiration/kill condition, and audit trail.

Pending:

- Production live mini-agent creation through Gateway.
- Agent Zero/Hermes/Pi live creation/review flow.
- Production docs for every agent/mini-agent/skill/tool/integration need final verification.
- Memory promotion and expiration need live adapter proof.

### OpenCloud / Build-Wiki / Farmer

Executed:

- OpenCloud is explicitly retained.
- Build-Wiki/Farmer remains visible and governed.
- `opencloud-docs-farmer.timer` is active.
- `opencloud-docs-farmer.service` is inactive when not running.
- Run Now remains scoped only to `opencloud-docs-farmer.service`.
- SMB/Fork 2 remains blocked.

Pending:

- Do not delete or disable OpenCloud.
- Do not mount SMB or run Fork 2 without a separate approved phase.
- Build-Wiki Run Now execution proof requires Bridge Session and owner-approved exact scope.

### External Connectors

Executed:

- Gateway and reports represent external connectors with connected/configured/blocked status.
- Zapier and HeyGen writes were not run.
- Broad connector execution remains disabled.

Pending:

- Firecrawl credential and adapter proof.
- Google Drive upload proof, if configured and scoped.
- OneDrive upload proof, if configured and scoped.
- AgentMail incoming/outgoing proof inside Bridge Session and allow-list.
- n8n install/running/API key proof if owner wants n8n in current phase.
- Zapier/HeyGen remain protected and blocked unless a Bridge Session explicitly scopes the action.

### Claude / Anthropic / Codex

Executed:

- The project has reports noting Claude/Anthropic and Codex/ChatGPT status distinctions.
- Codex/ChatGPT and Claude/Anthropic must remain separate surfaces.
- Anthropic API billing should remain disabled by default unless owner explicitly approves it.

Pending:

- Final separate Claude/Anthropic UI/backend proof if not already deployed after restart.
- Claude Code OAuth/subscription status must be checked without printing credentials.
- Safe no-write Claude smoke must be rerun if the owner wants this in the next production gate.

## Current Services

| Service / Runtime | Current Status |
| --- | --- |
| mission-control.service | Active, but latest restart blocked by admin authentication. |
| claudeclaw.service | Active. |
| hermes-gateway.service | Active. |
| playwright-mcp.service | Active. |
| opencloud-docs-farmer.timer | Active. |
| opencloud-docs-farmer.service | Inactive, which is expected when not running. |
| Agent Zero container | Running. |
| Paperclip service | Not active for live workforce operations per latest Paperclip report. |

## Current Git / Deployment State

Branch: `to-knowledge-mc`.

Latest pushed commits include:

- `89a70e8` - Playwright MCP production reports.
- `d1d9bcc` - Playwright MCP SpaceAgent browser evidence integration.
- `6698bc0` - Agent Hub deployment metadata.
- `ed68044` - Agent Hub production surface.
- `1651386` - Paperclip before OpenClaw runtime.
- `5f69cbe` - Paperclip live sandbox smoke report.
- `0ab7579` - Paperclip integration report bundle.

Tracked working tree: clean.

Untracked parked artifacts: 97. These are mostly prior runtime reports, designer review artifacts, public media, backups, and parked helper files. They were not mixed into the current commits.

## What Is Still In Progress

1. Production Mission Control restart and smoke.
2. Agent Hub production proof in the owner browser.
3. Hermes live `hermes_called:true` proof.
4. Agent Zero to Hermes live collaboration proof.
5. SpaceAgent Playwright MCP production route proof after restart.
6. Firecrawl credential/adapter proof.
7. Paperclip live sandbox service and owner login proof.
8. Report delivery adapter proof.
9. Bridge Session execution proof for approved safe actions.
10. Connector proof for AgentMail, Drive, OneDrive, Firecrawl, Zapier/HeyGen read-only, and n8n if in scope.
11. Dirty/untracked artifact cleanup, separately from production integration.

## What I Need To Finish Production

### Needed From Admin / Host

1. Administrator authorization to restart `mission-control.service`.
2. Confirmation that the new process has a changed MainPID or ActiveEnterTimestamp.
3. Permission to run authenticated smoke after restart.

Without this, the latest build cannot be honestly marked live in production.

### Needed From Owner

1. Owner-authenticated browser session or permission to use an existing authenticated session for UI smoke.
2. Bridge Session approval for any protected action proof, including report delivery, Drive/OneDrive upload, AgentMail send, Build-Wiki Run Now, or Brain write.
3. Confirmation of which external connectors should be finalized next:
   - Firecrawl,
   - AgentMail,
   - Google Drive,
   - OneDrive,
   - n8n,
   - Zapier read-only only,
   - HeyGen read-only only.
4. If Claude/Anthropic subscription integration is still in scope, owner login/token setup through Claude Code OAuth only. No API billing unless explicitly approved.

### Needed Credentials / Secrets

No secret values should be sent in chat.

Only these boolean/source-level items are needed:

- Firecrawl credential configured: yes/no.
- Agent Zero external API key source non-empty: yes/no.
- Hermes live adapter credential/source configured: yes/no.
- AgentMail IMAP/SMTP/REST source configured: yes/no.
- Google Drive connector configured: yes/no.
- OneDrive connector configured: yes/no.
- Claude Code OAuth/subscription configured: yes/no.
- Paperclip owner login configured: yes/no.

### Actions Not Needed / Not Authorized

- No OpenCloud deletion.
- No Build-Wiki/Farmer disablement.
- No SMB/Fork 2 mount.
- No broad external farmer execution.
- No Zapier write.
- No HeyGen generation.
- No public Playwright MCP exposure.
- No public Paperclip exposure.
- No raw root shell or Docker socket granted to agents.

## Exact Recommended Direction

### Step 1 - Production Restart Gate

Restart `mission-control.service` with administrator authorization.

Then prove:

- Gateway page loads.
- Agent Hub page loads.
- SpaceAgent Playwright MCP status route works.
- SpaceAgent Playwright MCP evidence route works.
- Agent Zero status/test-chat still works.
- Hermes status/test-chat no longer returns stale 405; it must return `hermes_called:true` or exact blocker.

### Step 2 - Hermes Live Gate

Fix or configure Hermes until production test-chat returns one of:

- GO: `hermes_called:true`, or
- safe blocked: exact blocker with no fake success.

Then prove Agent Zero can ask Hermes for a planning-only skill/workflow and receive a response.

### Step 3 - Delivery Gate

Open a Bridge Session and prove one safe report delivery path:

1. Mission Control report link.
2. Telegram PDF attachment if configured.
3. Drive or OneDrive only if connector works and session scope allows.

No fake delivery claims.

### Step 4 - Connector Gate

Finalize connectors in this order:

1. Firecrawl read-only.
2. AgentMail incoming/status.
3. AgentMail allowed-domain send inside Bridge Session.
4. Google Drive status/upload proof.
5. OneDrive status/upload proof.
6. n8n status if needed.
7. Zapier/HeyGen stay read-only until explicitly scoped.

### Step 5 - Paperclip Gate

Bring Paperclip back up in sandbox/Tailnet-only mode.

Prove:

- Health endpoint.
- Owner login.
- Company dashboard.
- Agent roster.
- Task creation dry-run.
- No public exposure.
- No write execution without Bridge Session.

### Step 6 - Clean Parked Artifacts

Classify and clean the 97 parked/untracked artifacts in a separate phase. Do not mix cleanup with live production fixes.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Mission Control restart blocked | High | Admin restart is required before claiming production updated. |
| Hermes live route stale or missing | High | Restart first, then fix adapter only if route returns safe blocker. |
| External connector fake success | High | Keep blocked unless Bridge Session and live proof exist. |
| Secrets exposure | High | Continue boolean-only secret reporting and staged secret scans. |
| OpenCloud accidental decommission | High | Keep OpenCloud as worker/runtime; no deletion path. |
| Dirty artifact mixing | Medium | Keep cleanup separate and stage surgically. |

## Final Direction Decision

Recommended next action: **Admin Restart Gate**.

Do not start new large feature tracks until production Mission Control is restarted and the already-built Gateway / Agent Hub / Playwright MCP / Hermes routes are smoke-tested. That is the narrowest move that unlocks the most blocked work.

## One-Line Status

The codebase is ahead of production runtime: the implementation is mostly built and tested, but production needs administrator restart and live authenticated smoke before the project can move from PARTIAL GO toward GO.
