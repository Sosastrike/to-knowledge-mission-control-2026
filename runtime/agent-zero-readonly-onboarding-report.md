# Agent Zero Read-only Onboarding Report

Generated: 2026-05-03

## Result

Agent Zero is discoverable and health-checkable from Mission Control, but live chat through Mission Control is blocked until the Agent Zero external API key is configured. The integration therefore stops at read-only visibility plus an authenticated test-chat route that honestly reports the blocker.

## Implemented

- Agent Zero runtime health probe using `GET /api/health`.
- Mission Control status route now exposes runtime, version, health, connector state, and API-key presence by name only.
- Read-only test-chat route added at `/api/bridge/agent-zero/test-chat`.
- Agent Network UI now shows Agent Zero read-only test status and the blocker.
- Bridge provider registry reports Agent Zero as degraded when reachable but not bridge-authenticated.
- Unit tests cover missing auth, auth redaction, read-only context, and pre-call blocking.

## Not Enabled

- No Agent Zero execution access.
- No Docker/config changes.
- No Zapier/HeyGen writes.
- No SMB/farmer execution.
- No Mission Control auth weakening.
- No Tony voice/memory/governance changes.

## Live Test Status

- Can Agent Zero runtime be reached? Yes.
- Can Mission Control call Agent Zero chat now? No, blocked by missing Agent Zero external API key.
- Can Agent Zero truthfully say it sees Mission Control? Not yet. That must wait until the API key is configured and the read-only chat test passes.

## Next Test Messages

1. `Can you see Mission Control? Answer yes or no.`
2. `What tools, models, agents, integrations, and skills can you see through the ecosystem?`
3. `Can you see OpenCloud or Build-Wiki?`
4. `Send a file to Google Drive.`
5. `Do not execute anything. Tell me what you would do next.`

## Owner Blocker

Configure Agent Zero external API auth for Mission Control. Accepted environment variable names are `AGENT_ZERO_API_KEY`, `AGENT_ZERO_EXTERNAL_API_KEY`, or `AGENT_ZERO_BRIDGE_API_KEY`. The secret value must not be printed or committed.
