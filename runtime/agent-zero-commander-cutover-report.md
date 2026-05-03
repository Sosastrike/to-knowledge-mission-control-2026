# Agent Zero Commander Cutover Report

Date: 2026-05-03

## Cutover Decision

Agent Zero is not production commander yet.

The cutover is blocked at Phase AZ-C1 because production `mission-control.service` could not be restarted without interactive admin authorization. The current production service still returns HTTP 405 for `POST /api/bridge/agent-zero/test-chat`, which means Agent Zero cannot yet chat through production Mission Control.

Per the owner rule, Tony must not be retired from live owner-facing command paths until Agent Zero production chat works, Agent Zero has full context in production, live owner tests pass, and no fake access or unapproved execution occurs.

## 1. Agent Zero Status

- Container: running.
- Tailnet health endpoint: reachable.
- Health version: M v1.9.
- Mission Control authenticated status route: HTTP 200.
- Production Mission Control test-chat route: HTTP 405.

Agent Zero is reachable and implemented in the current build, but production service has not loaded the POST route set yet.

## 2. Mission Control Production Status

- `mission-control.service`: active.
- Current build checks passed.
- Production restart attempt failed with interactive admin authorization required.
- Production service therefore remains on the older route surface for Agent Zero POST actions.

## 3. Bridge/MCP Status

Authenticated production route checks:

- `/api/bridge/providers`: HTTP 200.
- `/api/mcp/list`: HTTP 200.
- `/api/bridge/brain-sync/status`: HTTP 200.

Visible provider ids from production registry:

- `tony`
- `agent_zero`
- `hermes`
- `openrouter`
- `nvidia`
- `openai`
- `ollama`
- `claude_cli`
- `openclaw_gateway`

MCP server count from production registry: 21.

## 4. Brain / Obsidian / MemPalace Status

Production Brain Sync route is reachable.

Visible source families:

- Tony memory.
- Brain Sync.
- MemPalace.
- Obsidian.
- Graphify.

This confirms Bridge/MCP/Brain visibility exists in production, but Agent Zero chat cannot yet consume it through production `test-chat` because the POST route is stale.

## 5. Build-Wiki / Farmer Status

- `opencloud-docs-farmer.timer`: active.
- OpenCloud / Build-Wiki farmer infrastructure remains preserved.
- OpenCloud must not be destroyed during this cutover.

Build-Wiki remains a dependency until Agent Zero can either replace or safely live without that function and the owner approves decommission.

## 6. Models / OpenRouter Status

The provider registry still exposes model/provider surfaces, including OpenRouter, NVIDIA, OpenAI, Ollama, Claude CLI, and OpenClaw Gateway.

Known caveat from the previous ecosystem access report:

- OpenRouter is visible in the provider registry.
- OpenRouter integration must still be reported according to its configured/blocked state.

## 7. Tools / Skills / Integrations Status

Agent Zero ecosystem context and registries were implemented and tests pass in the current build.

Production-visible route classes:

- Bridge providers.
- MCP server list.
- Brain Sync.

Production Agent Zero chat remains blocked until restart.

## 8. Bridge Session Status

Bridge Session support exists in code and tests.

Current cutover state:

- No active production commander session was opened in this phase.
- No execution was granted.
- No tools were executed.
- No external writes occurred.

Agent Zero Bridge Session execution must remain blocked until production chat is loaded and owner-approved live tests pass.

## 9. Execution Access Status

No execution access was granted in this phase.

Still forbidden:

- Raw shell.
- Direct root access.
- Docker socket.
- Direct secret reads.
- Broad connector execution.
- Zapier writes.
- HeyGen generation.
- SMB mount.
- External farmer execution.
- Fake upload or fake completion.

## 10. Tony Status

Tony is not retired yet.

Current status:

- Tony / ClaudeClaw service is active.
- Tony is still present in the Mission Control provider registry.
- Tony is still referenced as active in several owner-facing and system surfaces.
- Tony Telegram routing is still active through ClaudeClaw until a safe replacement route is verified.

Tony must remain active until Agent Zero production chat and owner live tests pass.

## 11. Where Tony Still Exists

Mission Control active references found during baseline search:

- Bridge provider registry still includes `tony`.
- Static live adapter still treats `tony` as commander/reporting root.
- Agent Network client still maps `tony` as commander and protected.
- Brain Sync status still queries shared context with `agent_id=tony`.
- Build-Wiki Run Now and timer-control surfaces still reference Tony-to-Telegram approval.
- Telegram approval preview still uses Tony-to-Telegram language.
- Button contracts still describe Tony approval paths.
- Capability matrix still describes Tony as an active system.
- Report/executive report helpers still include Tony labels.

ClaudeClaw active references:

- Telegram transport and allowlist remain Tony-oriented.
- Tony go/no-go and Tony v2 tests are still present.
- Tony capability registry and Telegram approval flow still exist.
- Governance panel still targets Tony config.
- ClaudeClaw service remains active.

These are not safe to remove until Agent Zero production chat and commander live tests pass.

## 12. Whether Tony Can Still Respond To Owner

Yes. Tony / ClaudeClaw remains active.

Tony owner-message routing was not disabled because Agent Zero production chat is not loaded yet. Disabling Tony now would risk leaving the owner without a verified commander channel.

## 13. Whether Agent Zero Is Commander

No.

Agent Zero is implemented as the intended commander in current code, but production cutover is blocked until:

1. `mission-control.service` is restarted with the current build.
2. `POST /api/bridge/agent-zero/test-chat` returns HTTP 200.
3. `agent_zero_called: true` is verified in production.
4. Live owner tests pass.
5. Tony owner-facing surfaces are retired/hidden after Agent Zero passes.

## 14. Live Test Results

Production tests from this phase:

- Agent Zero status GET: HTTP 200.
- Agent Zero test-chat POST: HTTP 405.
- Bridge providers GET: HTTP 200.
- MCP list GET: HTTP 200.
- Brain Sync GET: HTTP 200.

Result: production live tests are blocked because Agent Zero cannot chat through production Mission Control yet.

## 15. Tests Passed

Mission Control:

- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 94 test files and 993 tests.

ClaudeClaw:

- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: passed, 59 test files and 1,204 tests passed with 4 skipped.
- `npm run design-lock:verify`: passed.

## 16. Services Active

- `mission-control.service`: active.
- `claudeclaw.service`: active.
- `opencloud-docs-farmer.timer`: active.
- Agent Zero container: running.

## 17. Sensitive Data Verification

No sensitive values were printed, committed, or written into this report.

No `.env` file was modified.

No external write, Zapier write, HeyGen generation, SMB action, external farmer run, Docker socket access, or raw secret read was performed.

## 18. Commits Pushed

No push was performed in this phase.

The Mission Control branch was already ahead of its tracked remote before this report. This report commit is local unless the owner separately approves a push.

## 19. Rollback Commands

Rollback this report commit after it exists:

```bash
git -C /home/tony/mission-control revert <agent-zero-commander-cutover-report-commit>
```

If future commander surface changes are made, each should be reverted by its specific commit hash rather than with a broad reset.

## 20. OpenCloud / Old Agent Destruction Safety

It is not safe to destroy OpenCloud or old agents yet.

Reasons:

- Agent Zero production chat is not live.
- Tony still provides the active owner command fallback.
- OpenCloud still provides live Build-Wiki/Farmer functionality.
- Build-Wiki and Brain Sync depend on OpenCloud freshness.
- Agent Zero has not passed production commander live tests.
- Missing OpenCloud dependencies have not been formally waived by owner.

Safe next step:

Get an admin-authorized restart of `mission-control.service`, then rerun Agent Zero production `test-chat`. Only after `agent_zero_called: true` is verified in production should the Tony retirement UI/API changes begin.

## Final Cutover Status

Status: blocked at AZ-C1.

Agent Zero is not commander yet. Tony remains active as the safe fallback until production Agent Zero chat and live owner tests pass.
