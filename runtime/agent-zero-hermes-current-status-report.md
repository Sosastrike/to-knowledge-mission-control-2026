# Agent Zero and Hermes Current Ecosystem Status Report

Date: 2026-05-04

## Executive Summary

Agent Zero is the active commander track and is substantially integrated across Mission Control, Bridge/MCP, Brain context, OpenClaw+ skills, Telegram/voice ownership, report surfaces, and Bridge Session execution rules. Hermes is integrated as the lieutenant track for skills, workflows, planning, and Agent Zero collaboration, but Hermes is not yet a full live Mission Control chat participant because the safe Hermes live-chat adapter is still not proven with `hermes_called: true`.

Current decision:

- Agent Zero: PARTIAL GO.
- Hermes: NO-GO for full integration, PARTIAL readiness for read-only lieutenant context.
- Joint ecosystem: PARTIAL GO.

The next blocking item is not more registry work. The next blocking item is authenticated live proof: run Agent Zero and Hermes through protected Mission Control routes with owner auth, then configure/prove the safe Hermes live-chat adapter.

## Current Percentages

| Area | Current percentage | Reason |
| --- | ---: | --- |
| Agent Zero commander integration | 86% | Commander profile, Telegram/voice ownership, Mission Control surfaces, Bridge Session rules, registry context, report generation, and guardrails are in place. Remaining blockers are authenticated live re-proof and some external delivery/write adapters. |
| Hermes lieutenant integration | 78% | Hermes is running, visible, guarded, tested, and connected to Agent Zero collaboration contracts. Remaining blocker is safe live Hermes chat through Mission Control. |
| Mission Control / Bridge / MCP | 88% | Production service active, protected routes present, Bridge/MCP registry visible, tests/build pass. Authenticated route proof still needed for this report cycle. |
| Brain / Obsidian / MemPalace / Graphify / Build-Wiki | 82% | Status/read context is visible; writes and some live adapters remain Bridge Session or adapter gated. |
| OpenClaw+ shared runtime / skills | 90% | Shared skill registry is visible to Agent Zero and Hermes; Tony no longer owns active skills. |
| External delivery/connectors | 62% | AgentMail and Drive/OneDrive/Firecrawl/Zapier/HeyGen are reported honestly, but writes/uploads/generation remain blocked unless connectors and Bridge Session allow them. |
| Overall joint readiness | 82% | Agent Zero is mostly operational; Hermes is ready as guarded lieutenant context but not live-chat GO. |

## Agent Zero Status

Role: Commander / chief operator.

Status: PARTIAL GO.

Evidence:

- Agent Zero container is running.
- Agent Zero health endpoint returned HTTP 200.
- Mission Control production service is active.
- Agent Zero routes are present and protected.
- Unauthenticated Agent Zero status/test-chat routes returned 401.
- ClaudeClaw/OpenClaw+ includes Agent Zero commander profile and voice/Telegram ownership commits.
- Mission Control tests and build passed after the latest Hermes/Bridge changes.

What Agent Zero can currently do:

- Appear as commander in the Mission Control hierarchy.
- See Mission Control/Bridge/MCP registry context.
- See tools, models, skills, integrations, and Brain context through registry surfaces.
- Use OpenClaw+ as shared runtime/skills layer.
- Use Bridge Session execution model through registered adapters only.
- Create reports through Mission Control report surfaces when the adapter path is used.
- Route owner channel/voice through Agent Zero on the ClaudeClaw side, based on pushed commits.

What is still pending for Agent Zero:

- Fresh authenticated production Agent Zero live-chat verification in this report cycle.
- Final proof that all owner-facing Telegram routes are using Agent Zero in every path, not just configured code paths.
- Google Drive and OneDrive upload proof if connectors are configured.
- AgentMail live send proof only inside an approved Bridge Session and domain allow-list.
- Firecrawl usable proof if credential/adapter is configured.
- Final delivery report/PDF attachment workflow proof through owner-facing channel.

## Hermes Status

Role: Lieutenant / skill and workflow specialist.

Status: NO-GO for full integration; PARTIAL readiness for read-only lieutenant context.

Evidence:

- `hermes-gateway.service` is active.
- Mission Control Hermes status route exists.
- Mission Control Hermes test-chat route exists.
- Unauthenticated Hermes status/test-chat routes returned 401.
- Hermes is represented in Agent Network and Brain hierarchy as Agent Zero's lieutenant.
- Hermes can receive redacted read-only Mission Control context.
- Hermes natural behavior contract is enforced.
- Hermes 1,000-scenario gauntlet passed with zero failures.

What Hermes can currently do:

- See Agent Zero as commander through Mission Control context.
- See shared OpenClaw+ skill registry.
- Report Bridge/MCP/tools/models/integrations context from registry data.
- Report Brain/Obsidian/MemPalace/Graphify/Build-Wiki status from registry data.
- Design workflow plans for Agent Zero without execution.
- Draft skill proposals in contract/test mode without writing files.
- Distinguish direct OpenCloud access from Build-Wiki/Farmer status.
- Refuse raw paths, fake done, Tony-active claims, and unauthorized execution.

What is still pending for Hermes:

- Safe live Hermes chat adapter behind Mission Control auth.
- Authenticated `hermes_called: true` proof.
- Authenticated owner UI smoke for Hermes status/test-chat.
- Live Agent Zero to Hermes workflow handoff through Mission Control.
- Bridge Session live test where Agent Zero delegates one safe Hermes planning task.
- Any Hermes execution beyond planning remains blocked until active Bridge Session and explicit registered adapter scope.

## Agent Zero and Hermes Collaboration

Current collaboration model:

- Agent Zero remains commander.
- Hermes is the planning/skill/workflow lieutenant.
- Agent Zero can call Hermes through the Mission Control collaboration protocol in tests/contracts.
- Hermes returns plans/specs/recommendations only.
- Agent Zero reviews, approves, delegates, and owns final execution.
- All actions are audited under the Bridge Session model.

Status: contract and tests are in place; live authenticated proof remains pending.

## Mission Control and Route Status

Mission Control service: active.

Protected route smoke:

- Agent Zero status route unauthenticated: 401.
- Agent Zero test-chat route unauthenticated: 401.
- Hermes status route unauthenticated: 401.
- Hermes test-chat route unauthenticated: 401.

Interpretation: protected route auth is working. This is good security, but it also means live owner-authenticated tests must be run from an authenticated Mission Control session before claiming GO.

## Agent Network Result

Current hierarchy:

- Agent Zero: Commander.
- Hermes: Lieutenant / skill-workflow specialist.
- OpenClaw+ / ClaudeClaw: shared runtime.
- Bridge/MCP: access layer.
- Brain systems: Obsidian, MemPalace, Graphify, Brain Sync, Build-Wiki/Farmer.
- Tony: retired / archived only.

Status: implemented and tested.

Pending: authenticated browser UI smoke after production deployment/restart if new UI bundle has not been loaded.

## Brain Sync Result

Current Brain hierarchy:

- Agent Zero: primary brain operator.
- Hermes: secondary/lieutenant.
- Obsidian: knowledge system.
- MemPalace: memory system.
- Graphify: graph system.
- Build-Wiki/Farmer: knowledge sync/farmer system.

Status: context and tests are in place.

Pending:

- Fresh authenticated UI smoke.
- Live write adapter proof for Obsidian/MemPalace only inside Bridge Session.
- Direct Graphify query/write proof if adapter exists.

## Bridge Session Behavior

Bridge Session now includes both Agent Zero and Hermes roles.

Agent Zero:

- commander,
- delegates/approves Hermes work,
- executes only through registered adapters,
- remains final owner-facing authority.

Hermes:

- can plan/design/suggest by default,
- can draft reports/skill specs only when scoped,
- cannot execute unless active Bridge Session, Agent Zero delegation, configured connector, and registered adapter all allow it,
- cannot use raw shell/root/Docker socket/direct secret reads,
- cannot execute Build-Wiki directly; Hermes may suggest and Agent Zero executes the scoped adapter.

Status: implemented, tested, and pushed.

## Tools / Models / Skills / Integrations

Visible through registry context:

- Models: OpenRouter, OpenAI, Claude/Anthropic, Codex/ChatGPT, Ollama, NVIDIA, Groq, Gemini where configured/visible.
- MCP/Bridge: provider registry, MCP server list, schema summaries, Zapier schema search.
- Skills: OpenClaw+ shared skill registry with Agent Zero and Hermes availability.
- Tools: registered MCP and Mission Control tool metadata.
- Integrations: AgentMail, Google Drive, OneDrive, Firecrawl, Zapier, HeyGen, Telegram, WhatsApp if configured.

Blocked or gated:

- External writes require Bridge Session and configured adapter.
- Drive/OneDrive uploads require connector proof.
- AgentMail sends require Bridge Session and domain allow-list.
- Firecrawl use requires credential/adapter proof.
- Zapier writes and HeyGen generation require explicit Bridge Session scope.

## OpenCloud / Build-Wiki

Current status:

- Build-Wiki/Farmer status is visible.
- `opencloud-docs-farmer.timer` is active.
- `opencloud-docs-farmer.service` is inactive, which is normal for a one-shot service when not currently running.
- Run Now remains scoped to `opencloud-docs-farmer.service`.
- Hermes can suggest Build-Wiki actions.
- Agent Zero must execute Build-Wiki through the scoped Bridge Session adapter.
- SMB/Fork 2 remains blocked unless SMB prerequisites are separately approved and proven.

OpenCloud should not be destroyed yet.

## Voice / Telegram

ClaudeClaw pushed commits show:

- Agent Zero primary commander profile installed.
- Agent Zero voice ownership transferred.
- Agent Zero ElevenLabs voice enabled.
- Owner channel kept/routed to Agent Zero.

Pending:

- Fresh live Telegram owner test proving every active owner-message path reaches Agent Zero and not Tony.
- Telegram BotFather/display-name rename remains external if the bot name still references Tony.

## Tests and Validation

Mission Control latest validation:

- Typecheck: passed.
- Build: passed.
- Full test suite: 99 files, 1,037 tests passed.
- Hermes focused tests: 19 tests passed.
- Hermes gauntlet: 1,000 scenarios, zero failures.
- Agent Zero ecosystem gauntlet: 10,000 scenarios, zero failures.

ClaudeClaw latest validation:

- Typecheck: passed.
- Build: passed.
- Full test suite: 61 files, 1,213 passed, 4 skipped.
- Design-lock verify: passed.

## Services

Current services:

- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.
- `opencloud-docs-farmer.service`: inactive.
- `hermes-gateway.service`: active.
- Agent Zero container: running.

## Commits

Mission Control current head:

- `396137b docs(agents): add hermes lieutenant integration report`

Recent Mission Control commits:

- `396137b docs(agents): add hermes lieutenant integration report`
- `75ee672 docs(agents): add hermes full integration report`
- `e25b09a fix(agents): enforce hermes natural behavior contract`
- `482dc9e feat(bridge): include hermes in agent zero bridge session`
- `ec0f34c feat(agents): add agent zero hermes collaboration protocol`
- `48ba027 feat(bridge): expose full mcp and integration registry to hermes`
- `1df4330 feat(skills): expose shared skill registry to hermes`
- `51c4f48 feat(brain): add hermes as secondary brain specialist`

ClaudeClaw current head:

- `db83363 feat(agents): install agent zero primary commander profile`

Recent ClaudeClaw commits:

- `db83363 feat(agents): install agent zero primary commander profile`
- `20a1b6a fix(agentmail): verify email and enforce domain allowlist`
- `c4bd87b fix(telegram): keep owner channel on agent zero`
- `820b8ca feat(telegram): route owner command channel to agent zero`
- `db981fc fix(voice): transfer active voice ownership to agent zero`
- `a4ec5df fix(voice): enable agent zero elevenlabs voice`

## Dirty Files Remaining

Mission Control:

- 90 unrelated parked/untracked files remain.
- They were not staged or committed with Agent Zero/Hermes closure work.

ClaudeClaw:

- 93 unrelated dirty runtime/report files remain.
- They were not staged or committed with this report.

These should be handled in a separate dirty-tree cleanup pass, not mixed with agent integration work.

## No-Secrets Confirmation

Confirmed in this status pass:

- No secrets printed.
- No auth files printed.
- No `.env` edits made.
- Protected routes returned 401 without auth.
- No auth weakening.
- No Tailscale/auth bypass.
- No external writes.
- No email send.
- No Zapier/HeyGen execution.
- No SMB mount.
- No farmer execution.

## Rollback Commands

Mission Control Hermes report rollback:

```bash
git revert 396137b
git revert 75ee672
git revert e25b09a
git revert 482dc9e
systemctl restart mission-control.service
```

ClaudeClaw Agent Zero routing/voice rollback, only if owner explicitly wants to undo Agent Zero cutover:

```bash
git revert db83363
git revert c4bd87b
git revert 820b8ca
git revert db981fc
git revert a4ec5df
systemctl --user restart claudeclaw.service
```

## Exact Pending Work

Priority 1:

- Run authenticated production Agent Zero status/test-chat.
- Run authenticated production Hermes status/test-chat.
- Configure safe Hermes live-chat adapter.
- Prove Hermes `hermes_called: true`.
- Run live Agent Zero to Hermes workflow handoff.

Priority 2:

- Run browser-authenticated Agent Network UI smoke.
- Run browser-authenticated Brain Sync UI smoke.
- Run live Telegram owner test proving Agent Zero answers and Tony does not.
- Run Agent Zero report creation and attachment proof.

Priority 3:

- Finish Drive/OneDrive upload connector proof or mark blocked.
- Finish AgentMail live-send proof inside Bridge Session/domain allow-list.
- Finish Firecrawl usable proof or mark blocked.
- Keep OpenCloud/Build-Wiki until replacement/decommission map is fully waived or proven.

## Final Recommendation

Recommendation: continue Agent Zero stabilization first, then finish Hermes live adapter proof.

Do not move to broad multi-agent ecosystem stabilization yet. The system is close, but the remaining blockers are live/authenticated proof blockers, not documentation blockers.
