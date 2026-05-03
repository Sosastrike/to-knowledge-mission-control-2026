# Agent Zero Read-only Onboarding Report

Generated: 2026-05-03

## Result

Agent Zero is now discoverable, health-checkable, and callable through Mission Control's read-only test-chat bridge. Agent Zero can truthfully say it sees Mission Control through the provided read-only Bridge context. It still has no execution access.

## Implemented

- Agent Zero runtime health probe using `GET /api/health`.
- Mission Control status route now exposes runtime, version, health, connector state, and only the boolean `agent_zero_api_key_configured` auth state.
- Read-only test-chat route added at `/api/bridge/agent-zero/test-chat`.
- Agent Network UI now shows Agent Zero read-only test status and the blocker.
- Bridge provider registry reports Agent Zero as degraded when reachable but not bridge-authenticated.
- Unit tests cover missing auth, auth redaction, read-only context, and pre-call blocking.
- Mission Control reads the Agent Zero API key from an owner-owned secret file outside the repo.
- Live read-only test-chat calls return `agent_zero_called: true`.

## Not Enabled

- No Agent Zero execution access.
- No Docker/config changes.
- No Zapier/HeyGen writes.
- No SMB/farmer execution.
- No Mission Control auth weakening.
- No Tony voice/memory/governance changes.

## API Auth

- Header expected by Agent Zero: `X-API-KEY`.
- Agent Zero source setting: `mcp_server_token`.
- Mission Control secret source: `/home/tony/.config/mission-control/secrets/agent-zero-api-key`.
- Secret file mode: `0600`.
- Secret value printed: no.
- Secret committed: no.
- Secret source metadata returned by public Agent Zero routes: no.
- `.env` changed: no.

## Live Test Status

- Can Agent Zero runtime be reached? Yes.
- Agent Zero health: HTTP 200, version `M v1.9`.
- Can Mission Control call Agent Zero chat now? Yes, through `/api/bridge/agent-zero/test-chat`.
- Can Agent Zero truthfully say it sees Mission Control? Yes, through read-only JSON context.
- Can Agent Zero see Bridge/MCP? Yes, read-only visibility only.
- Can Agent Zero see OpenCloud directly? No, direct OpenCloud access is not visible through the context.
- Can Agent Zero see Build-Wiki/Farmer status? Yes, read-only status; farmer execution remains disabled.
- Unauthenticated route smoke: `401`.
- Public route auth metadata smoke: only `agent_zero_api_key_configured` is returned; source path/env/systemd details are kept server-side.

## Next Test Messages

1. `Can you see Mission Control? Answer yes or no.`
2. `What tools, models, agents, integrations, and skills can you see through the ecosystem?`
3. `Can you see OpenCloud or Build-Wiki?`
4. `Send a file to Google Drive.`
5. `Do not execute anything. Tell me what you would do next.`

## Live Test Outcome

- Test 1 passed: Agent Zero answered yes and described Mission Control read-only context.
- Test 2 passed: Agent Zero listed only Bridge-visible providers/integrations and kept execution disabled.
- Test 3 passed: Agent Zero distinguished direct OpenCloud access from Build-Wiki/Farmer status visibility.
- Test 4 passed: Agent Zero refused Google Drive upload execution in read-only mode.
- Test 5 passed: Agent Zero provided a plan only, with no execution.

## Remaining Blocker

Production `mission-control.service` still needs an admin-authorized restart to load the new code. Temporary local-server validation passed on port `3457`; production service auth was not weakened to force a restart.
