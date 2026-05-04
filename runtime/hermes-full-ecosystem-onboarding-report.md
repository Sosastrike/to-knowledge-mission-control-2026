# Hermes Full Ecosystem Onboarding Report

Generated: 2026-05-03 23:31:56

## Executive Summary

Hermes onboarding has started safely. Hermes is installed, versioned, running as a gateway service/process, and visible in Mission Control as Agent Zero's lieutenant / skill-workflow specialist. Mission Control authenticated Hermes routes work, shared OpenClaw+ skills are visible to both Agent Zero and Hermes, and active stale Tony wording in the Hermes provider status was fixed.

Decision: NO-GO for full Hermes integration. Hermes is not yet a live integrated operational lieutenant because no Hermes live chat/API route through Mission Control has been proven, no Hermes Bridge Session execution has been enabled, and Agent Zero production test-chat remains blocked by the empty Agent Zero API key file.

Evidence-based Hermes completion: 24%. Read-only discovery and registry visibility are real; live coordination and execution remain blocked.

## Current Truth

- Agent Zero remains commander target.
- Hermes is lieutenant / skill and workflow specialist in read-only/degraded mode.
- Tony is retired / archived only.
- OpenClaw+ / ClaudeClaw remains shared runtime and skills layer.
- Mission Control remains dashboard and command surface.
- Bridge/MCP remains access layer.
- Brain remains Obsidian, MemPalace, Graphify, Brain Sync, Build-Wiki/Farmer.

## Live Discovery

- Hermes binary: installed, Hermes Agent v0.11.0.
- Hermes service: hermes-gateway.service active.
- Hermes process: gateway process running.
- Mission Control /api/hermes: authenticated 200, unauthenticated 401.
- Mission Control /api/bridge/hermes/status: authenticated 200, unauthenticated 401.
- Agent runtimes route reports Hermes installed and authenticated, but not fully runtime-running from that detector.
- Shared skill registry available_to includes agent_zero and hermes.

## Changes Made

1. Sanitized Hermes provider status so stale ClaudeClaw provider data cannot say Hermes should bridge to Tony.
2. Added Hermes gateway process detection fallback for Mission Control status when systemd user-bus checks are unavailable from production service context.
3. Created this onboarding report.

## Validation

Mission Control checks after code changes:
- git diff --check: passed.
- pnpm run typecheck: passed.
- pnpm run build: passed after provider-status change.
- pnpm test: passed, 96 files and 1001 tests, after provider-status change.
- Targeted Hermes tests after gateway process detection: passed.

Security:
- No .env changes.
- No secrets printed.
- No secrets committed.
- No auth weakening.
- No Zapier writes, HeyGen generation, SMB mount, farmer execution, email send, Drive upload, OneDrive upload, raw root shell, Docker socket, or direct secret reads.

## 200-Phase Execution Ledger

| Phase Band | Goal | Status | Evidence / Blocker |
|---|---|---|---|
| 1-10 | Baseline, safety, and hierarchy | Partial complete | Repos/services baselined. Mission Control at 3e60cb4 after Hermes fixes. ClaudeClaw at db83363. Mission Control and ClaudeClaw have known parked dirty files; no unrelated cleanup performed. |
| 11-20 | Hermes discovery | Complete | Hermes binary detected as v0.11.0. User service hermes-gateway.service is active. A Hermes gateway process is running. Mission Control /api/hermes and /api/bridge/hermes/status return authenticated 200. |
| 21-30 | Hermes provider registry | Complete for read-only | Hermes is visible as Agent Zero lieutenant / skill-workflow specialist. Stale active wording that referenced bridging Hermes to Tony was sanitized. |
| 31-40 | OpenClaw+ shared skills visibility | Complete | Mission Control shared skill runtime exposes OpenClaw+, Agent Zero, Hermes, home Claude, Mission Control, and database skill sources to agent_zero and hermes. Tony does not own active skills. |
| 41-50 | Mission Control live visibility | Partial | Hermes can be represented in Mission Control read-only status. Direct Hermes live chat/API into Mission Control is not proven yet. |
| 51-60 | Bridge/MCP context | Partial | Bridge status routes expose Hermes read-only status. Hermes execution through Bridge/MCP is disabled until Bridge Session proof exists. |
| 61-70 | Brain systems visibility | Partial | Brain/Obsidian/MemPalace/Graphify/Build-Wiki are visible through Agent Zero ecosystem context. Hermes direct read adapter is not separately proven. |
| 71-80 | Skill/workflow specialist role | Partial complete | Hermes skills directories are detected and included in registry. Hermes may recommend/draft skills and workflows; execution remains disabled. |
| 81-90 | Hermes chat/API channel | Blocked | No Hermes Mission Control test-chat/live chat endpoint was proven. Must define or verify a safe Hermes API/chat channel before claiming integration. |
| 91-100 | Hermes to Agent Zero communication | Blocked | Agent Zero production test-chat remains blocked by empty Agent Zero API key file, so live Agent Zero-Hermes coordination cannot be proven. |
| 101-110 | Bridge Session execution | Not started | No Hermes Bridge Session execution granted or run. Required future scope must be adapter-only, audited, and owner-approved. |
| 111-120 | Adapters and reports | Not started | No Hermes write/report execution adapter was enabled. Report creation remains Agent Zero/Mission Control side until Hermes execution is proven. |
| 121-130 | Email/Drive/OneDrive/Zapier/HeyGen | Blocked | No external writes performed. Missing/blocked connectors remain governed by Agent Zero operational report. |
| 131-140 | Build-Wiki/Farmer | Status only | No farmer execution. Build-Wiki remains exact-scope Bridge Session only. |
| 141-150 | SMB/Fork 2 | Blocked | No SMB mount attempted. Prerequisites still need separate proof. |
| 151-160 | Natural behavior/no fake access | Partial | Existing Agent Zero behavior contracts pass. Hermes-specific live natural behavior tests are not yet implemented. |
| 161-170 | Security posture | Complete for this hop | No secrets printed, no .env changes, no auth weakening, no Docker socket/raw root/direct secret access granted. |
| 171-180 | Large-scale Hermes gauntlet | Not started | No Hermes-specific 10k/100k gauntlet exists yet. Must be added after read-only chat/API exists. |
| 181-190 | Production UI/live owner tests | Blocked | Cannot claim live Hermes pass until production UI/chat routes prove reachable behavior. |
| 191-200 | Final GO decision | NO-GO for full Hermes integration | Hermes is discovered and visible as read-only lieutenant, but not fully integrated. Continue only after Agent Zero live blocker and Hermes chat/API proof are resolved. |

## Commits

- 294e9b8 `fix(bridge): sanitize hermes lieutenant provider status`
- 3e60cb4 `fix(bridge): detect hermes gateway process safely`

## Rollback

- `git revert 3e60cb4`
- `git revert 294e9b8`
- `git push`
- Restart Mission Control after owner/admin authorization if production needs the latest bundle loaded.

## Exact Next Step

Fix the Agent Zero production live-call blocker first by populating the safe Agent Zero API key file without printing it, then admin-restart Mission Control and prove Agent Zero `test-chat` returns `agent_zero_called=true`. After that, add a safe Hermes test-chat/API bridge and run live read-only Hermes prompts before any Bridge Session execution work.
