# Agent Zero and Hermes Post Live-Proof Baseline

Generated: 2026-05-04, America/New_York

## Phase 1 - Current Block Status

- Agent Zero percentage: 89%.
- Hermes percentage: 42%.
- Overall ecosystem percentage: 84%.
- Decision: NO-GO for the next deep connector block.
- Reason: Agent Zero is callable live, but production Mission Control has not restarted onto the latest code and Hermes production test-chat still returns 405.

## Phase 2 - Production Mission Control Process

- `mission-control.service`: active.
- MainPID: `2077627`.
- ActiveEnterTimestamp: `Sun 2026-05-03 22:33:02 EDT`.
- Restart status: not new; production still appears to be the old process.
- Previous restart attempt blocker: interactive admin authorization required.

## Phase 3 - Production HEAD And Route Behavior

- Repository HEAD: `d6e1350`.
- Latest commits:
  - `d6e1350 docs(agents): update agent zero hermes live blocker report`
  - `cae486f docs(agents): add agent zero hermes 24h operational report`
  - `6c45ed0 feat(skills): finalize agent zero hermes shared skill registry`
- Route behavior does not fully match latest code because Hermes POST still returns 405 and production process timestamp is stale.

## Phase 4 - Agent Zero Route Proof

Authenticated:

- `GET /api/bridge/agent-zero/status`: 200.
- `POST /api/bridge/agent-zero/test-chat`: 200.
- `agent_zero_called`: true.
- `execution_enabled`: false.
- `writes_enabled`: false.
- Live response: Agent Zero said he queried `GET /api/bridge/agent-zero/status` and got HTTP 200.

Result: Agent Zero production route is live.

## Phase 5 - Hermes Route Proof

Authenticated:

- `GET /api/bridge/hermes/status`: 200.
- `POST /api/bridge/hermes/test-chat`: 405.

Expected acceptable results were either:

- 200 with `hermes_called:true`, or
- 503 with a safe blocker such as `hermes_safe_live_chat_adapter_not_configured`.

Actual result is still 405, so Hermes is not live-proven.

## Phase 6 - Unauthenticated Protection

Unauthenticated checks:

- Agent Zero status: 401.
- Agent Zero test-chat: 401.
- Hermes status: 401.
- Hermes test-chat: 401.

Result: protected routes remain auth-protected.

## Phase 7 - External Action Safety

No external actions were run in this baseline.

Observed service state:

- `opencloud-docs-farmer.service`: inactive.
- `opencloud-docs-farmer.timer`: active.
- `claudeclaw.service`: active.
- `hermes-gateway.service`: active.
- Agent Zero container: running.

Confirmed not performed:

- No email send.
- No farmer execution.
- No Zapier write.
- No HeyGen generation.
- No SMB mount.
- No OpenCloud destruction.
- No `.env` changes.
- No secrets printed.

## Phase 8 - Baseline Conclusion

Current block result is NO-GO for deep connector work.

Agent Zero is production-callable, but the production restart blocker keeps the newest route behavior from loading. Hermes remains blocked because `POST /api/bridge/hermes/test-chat` returns 405.

## Phase 9 - Next Required Action

Owner/admin must restart production Mission Control through the approved admin method:

```bash
sudo systemctl restart mission-control.service
systemctl is-active mission-control.service
systemctl show mission-control.service -p MainPID -p ActiveEnterTimestamp
```

After the process timestamp changes, rerun:

1. `GET /api/bridge/agent-zero/status`
2. `POST /api/bridge/agent-zero/test-chat`
3. `GET /api/bridge/hermes/status`
4. `POST /api/bridge/hermes/test-chat`

Do not proceed to deep connector work until Hermes POST is no longer 405.
