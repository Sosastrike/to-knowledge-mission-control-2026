# Hermes Live Access Proof

Generated: 2026-05-04, America/New_York

## Phase 10 - Hermes Runtime Audit

- User service: `hermes-gateway.service`.
- Status: active/running.
- MainPID: `1359718`.
- Active since: `Wed 2026-04-29 08:36:59 EDT`.
- Working directory: `/home/tony/.hermes/hermes-agent`.
- ExecStart: `/home/tony/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace`.
- Root service: not installed/active; Hermes is a user service.
- Process: running as user `tony`.
- Log check: journal access returned no visible recent entries; a secret-pattern scan over recent accessible logs returned 0 matches.

## Phase 11 - Hermes Safe Local Endpoint Discovery

No Hermes-specific local API/chat listener was found from the running Hermes gateway process.

Observed:

- The Hermes gateway process is active, but no listening socket is attributed to `hermes`.
- Hermes CLI exposes `--oneshot`, but the CLI help says tools, memory, rules, and `AGENTS.md` are loaded and approvals are auto-bypassed. That is not safe for this read-only Mission Control adapter.
- Therefore, no safe local/API chat endpoint is proven yet.

## Phase 12 - Public UI Exposure

No Hermes dashboard or Hermes-specific public UI exposure was proven.

Important observation:

- A listener on `0.0.0.0:9876` exists, but its process is `/usr/bin/python3 /home/tony/smtp-relay-webhook.py`; it is not Hermes.
- Hermes should not be exposed publicly. Keep any future Hermes owner UI behind authenticated Mission Control or Tailnet-only controls.

## Phase 13 - Hermes POST Route Status

Production route:

- `POST /api/bridge/hermes/test-chat`: 405.

Reason:

- Production `mission-control.service` is still running the stale process from `Sun 2026-05-03 22:33:02 EDT`.
- The repository and latest standalone build contain `src/app/api/bridge/hermes/test-chat/route.ts` with a POST handler.
- Production restart is still required before the live route can load.

Latest standalone route smoke:

- `GET /api/bridge/hermes/status`: 200.
- `POST /api/bridge/hermes/test-chat`: 503.
- `hermes_called`: false.
- `execution_enabled`: false.
- `writes_enabled`: false.
- blocker: `hermes_safe_live_chat_adapter_not_configured`.

## Phase 14 - Safe Blocker Behavior

Safe blocker behavior is implemented in the latest standalone build.

Expected blocker:

`hermes_safe_live_chat_adapter_not_configured`

Actual latest-build behavior:

- Returns 503.
- Does not claim `hermes_called:true`.
- Does not execute tools.
- Does not write.
- Does not expose secrets.

Production still returns 405 only because the latest code has not been loaded by a service restart.

## Phase 15 - Hermes Safe Live Adapter

No live adapter was built in this phase because no safe Hermes local/API chat endpoint was proven.

The CLI one-shot path was rejected as unsafe for this adapter because it can load tools and auto-bypass approvals according to its own help text.

## Phase 16 - Hermes Adapter Auth Source

No adapter auth source was configured because no safe adapter was built.

No secrets were printed. No auth files were read. No `.env` changes were made.

## Phase 17 - Hermes Live Adapter Guardrails

The latest Mission Control route guardrails are present:

- No tool execution.
- No writes.
- No uploads.
- No provider one-shot execution.
- No direct dashboard exposure.
- No secret values.
- No raw paths in replies.
- No fake completion.

## Phase 18 - Hermes Test-Chat Live Proof

Hermes live proof is not complete.

- Production: 405, stale process.
- Latest standalone: safe 503 blocker, `hermes_called:false`.

GO condition not met:

- `hermes_called:true` is not proven.

## Phase 19 - Hermes Owner-Facing UI Proof

Mission Control source includes Hermes status/test-chat routes, and latest standalone route behavior is safe.

Owner-facing UI proof is still blocked until production Mission Control is restarted and the POST route no longer returns 405.

## Phase 20 - Conclusion

Hermes status remains:

- Runtime: active.
- Mission Control status route: available.
- Production test-chat route: blocked by stale process, 405.
- Latest standalone test-chat route: safe 503 blocker.
- Live Hermes call: not proven.
- GO/NO-GO: Hermes remains NO-GO live.

## Required Next Step

Restart production Mission Control through approved admin authorization:

```bash
sudo systemctl restart mission-control.service
systemctl is-active mission-control.service
systemctl show mission-control.service -p MainPID -p ActiveEnterTimestamp
```

Then rerun:

```bash
POST /api/bridge/hermes/test-chat
```

Expected after restart, if no live adapter is configured:

- 503.
- `hermes_called:false`.
- blocker `hermes_safe_live_chat_adapter_not_configured`.

Do not claim Hermes GO until a safe adapter returns `hermes_called:true`.
