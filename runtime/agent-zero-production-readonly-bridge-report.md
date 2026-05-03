# Agent Zero Production Read-only Bridge Report

Generated: 2026-05-03

## Purpose

Make the current Agent Zero read-only onboarding live in production Mission Control and verify the production routes.

## Repo Checks

- Repository: `/home/tony/mission-control`
- Branch: `to-knowledge-mc`
- HEAD before report commit: `d4f3212`
- Tracked dirty files before report: none
- Existing untracked parked artifacts: present, unchanged
- `git diff --check`: passed
- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- `pnpm test`: passed, 85 files and 946 tests

## Service Checks

- `mission-control.service`: active
- `claudeclaw.service`: active
- `opencloud-docs-farmer.timer`: active
- Agent Zero Docker container: running
- Agent Zero health endpoint: HTTP 200

## Production Restart

Production restart was attempted through:

```bash
systemctl restart mission-control.service
```

Result: blocked by interactive admin authorization.

No auth weakening was attempted. No service auth was bypassed. Production `mission-control.service` remains active, but it has not loaded the newly built Agent Zero ecosystem routes from the latest code.

## Production Route Smoke

Production listener identified as `http://127.0.0.1:3337`.

- Unauthenticated `/api/bridge/agent-zero/status`: 401
- Authenticated `/api/bridge/agent-zero/status`: 200
- Authenticated status health: Agent Zero health HTTP 200
- Authenticated status payload includes latest ecosystem endpoint: no
- Authenticated `/api/bridge/agent-zero/test-chat` POST: 405

Conclusion: production is active, but not yet running the latest Agent Zero read-only onboarding build. The admin-authorized restart is still required.

## Temporary Local Validation

Because the production restart was admin-blocked, a temporary standalone server was started on `127.0.0.1:3457` from the freshly built artifact and then stopped after validation.

Results:

- Temporary server stopped after validation: yes
- Port `3457` clear after validation: yes
- Unauthenticated `/api/bridge/agent-zero/status`: 401
- Unauthenticated `/api/bridge/agent-zero/test-chat`: 401
- Authenticated `/api/bridge/agent-zero/status`: 200
- `agent_zero_api_key_configured`: true
- Agent Zero runtime health through status: HTTP 200
- Status includes ecosystem endpoint: true
- Authenticated `/api/bridge/agent-zero/ecosystem`: 200
- Ecosystem provider count: 9
- Ecosystem model count: 15
- Ecosystem skill count: 23
- Ecosystem execution enabled: false
- Authenticated `/api/bridge/agent-zero/test-chat` POST: 200
- `agent_zero_called`: true
- `ok`: true
- Execution enabled: false
- Writes enabled: false

## Safety

- Agent Zero API key printed: no
- Agent Zero API key committed: no
- Agent Zero API key exposed in UI/status/report: no
- `.env` changed: no
- Mission Control auth weakened: no
- Tailscale bypassed: no
- Zapier writes: not run
- HeyGen generation: not run
- SMB mount: not run
- External farmers: not run
- Agent Zero execution access: not enabled

## Current State

Agent Zero read-only onboarding is code-complete, tested, committed, pushed from prior work, and validated on a temporary local server. It is not live in production Mission Control until `mission-control.service` is restarted through an admin-authorized path.

## Required Next Step

Perform an admin-authorized restart of:

```bash
systemctl restart mission-control.service
```

Then rerun:

- Authenticated `GET /api/bridge/agent-zero/status`
- Authenticated `POST /api/bridge/agent-zero/test-chat`
- Unauthenticated route smoke for 401/403
