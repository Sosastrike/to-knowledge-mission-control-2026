# Task 2 — Mission Control Visibility Verification

Generated: 2026-05-02 14:52 America/New_York
Scope: activate and verify the read-only Mission Control visibility release from commit `3284b7eaa0ca0b4576cc19262c6858e40a7df60f`.

## Restart Result

Restart was attempted and blocked by system authentication:

```text
sudo: a password is required
Failed to restart mission-control.service: Interactive authentication required.
```

`mission-control.service` remains `active`, but the active process has not yet picked up the newly built standalone bundle.

## Verification Results

| Check | Result |
|---|---|
| Mission Control service | `active` |
| Git HEAD | `3284b7e` |
| `https://tkmc.knowledge-vs-ai.com/login` | HTTP `200` |
| `https://tkmc.knowledge-vs-ai.com/agents` | Auth-gated; browser/session request can load, unauth terminal request redirects to login |
| `/api/bridge/providers` with API key | HTTP `200` |
| `/api/bridge/button-contracts` with API key | HTTP `200` |
| `/api/bridge/brain-sync/status` | HTTP `307` until restart |
| `/api/bridge/harness/status` | HTTP `307` until restart |
| `/api/bridge/agent-zero/status` | HTTP `307` until restart |
| `/api/bridge/hermes/status` | HTTP `307` until restart |

## Current Blocker

Task 2 is blocked only by restart authorization. No code change is required.

Owner or an authorized sudo session should run:

```bash
sudo systemctl restart mission-control.service
systemctl is-active mission-control.service
```

## Post-Restart Checks To Run

```bash
cd /home/tony/mission-control
export PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:$PATH
API_KEY=$(sqlite3 .data/mission-control.db "SELECT value FROM settings WHERE key='security.api_key' LIMIT 1;")

curl -sS -o /dev/null -w 'login=%{http_code}\n' https://tkmc.knowledge-vs-ai.com/login
curl -sS -o /dev/null -w 'agents=%{http_code}\n' https://tkmc.knowledge-vs-ai.com/agents
for p in \
  /api/bridge/providers \
  /api/bridge/brain-sync/status \
  /api/bridge/harness/status \
  /api/bridge/agent-zero/status \
  /api/bridge/hermes/status
do
  curl -sS -o /dev/null -w "$p=%{http_code}\n" -H "x-api-key: $API_KEY" "http://127.0.0.1:3337$p"
done
```

## Safety Confirmation

- No route or Cloudflare/Caddy change was made.
- No `.env` file was edited.
- No protected action was enabled.
- No DB migration was run.
- No push was run.
