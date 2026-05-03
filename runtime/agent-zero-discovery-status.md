# Agent Zero Discovery Status

Generated: 2026-05-03

## Summary

Agent Zero exists and is running as a Docker container on the Tailnet, but it is not yet live-connected to Mission Control as a chat-capable ecosystem agent.

## Evidence

- Deployment directory: `/home/tony/agent-zero-deploy`
- Source/staging directory: `/home/tony/staging/agent-zero`
- Docker container: `agent-zero`
- Image: `agent0ai/agent-zero:latest`
- Published Tailnet endpoint: `http://100.116.35.95:50080`
- Health endpoint: `http://100.116.35.95:50080/api/health`
- Health result: reachable, HTTP 200, Agent Zero v1.9 metadata returned
- Web UI: reachable at Tailnet endpoint
- External API endpoint: `POST /api/api_message`
- External API auth: requires `X-API-KEY`

## API Auth Source

Mission Control now reads Agent Zero's external API key from an owner-owned secret file outside the repo:

- Source type: secret file
- Source path: `/home/tony/.config/mission-control/secrets/agent-zero-api-key`
- File mode: `0600`
- Value printed: no
- Value committed: no
- `.env` changed: no

The unauthenticated API probe returned HTTP 401 from `/api/api_message`, confirming the endpoint exists and auth is required. Authenticated read-only bridge calls now return `agent_zero_called: true`.

## Safety State

- Agent Zero execution access: disabled
- Docker/config changes: not performed
- Mission Control auth: unchanged
- Zapier/HeyGen writes: not run
- SMB/farmers: not run
- Tony voice/memory/governance: unchanged

## Live Truth

Agent Zero previously answered that it could not see Mission Control. After the read-only bridge test-chat path was authenticated, Agent Zero correctly answered that it can see Mission Control through the provided read-only JSON context. This is not direct unrestricted access and does not grant execution.
