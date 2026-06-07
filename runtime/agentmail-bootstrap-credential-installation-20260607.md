# AgentMail Bootstrap Credential Installation Report - 2026-06-07

## Summary

Implemented the secure AgentMail bootstrap credential intake path for the active Mission Control runtime at `/home/tony/mission-control`.

The runtime now has source support for:

- owner-only hidden terminal prompt for the AgentMail bootstrap API key
- encrypted storage in the existing Mission Control Provider Vault as provider `agentmail`, ref `AGENTMAIL_API_KEY`
- service runtime lookup by reference only through `AGENTMAIL_API_KEY_REF=AGENTMAIL_API_KEY`
- server-side AgentMail connection test using a safe inbox-list probe only
- no email sending, no inbox provisioning, no scoped per-agent credentials, and no auto-send enablement

## Current Runtime Result

The key itself was not installed during this hop because no approved non-chat AgentMail key source was available to Codex, and the plan forbids pasting keys in chat or passing raw keys through CLI flags.

Current exact blockers:

- `provider_vault_row_created:false`
- `agentmail_provider_vault_row_count:0`
- `approved_secret_intake_required` until the owner runs the hidden prompt on the server
- `sudo_password_required` for systemd drop-in install and service restart
- `mission-control.service` is active but current cwd is `/home/tony/mission-control/.next/standalone (deleted)` after the build refreshed standalone; restart is required

## Files Changed

- `package.json`
- `scripts/agentmail/store-bootstrap-key.mjs`
- `src/lib/agentmail-credential-resolver.ts`
- `src/app/api/agentmail/connect/test/route.ts`
- `src/lib/agentmail-bootstrap-store-script.test.ts`
- `src/lib/agentmail-credential-resolver.test.ts`
- `runtime/agentmail-bootstrap-credential-installation-20260607.md`

## Script Behavior

Command added:

```bash
pnpm run agentmail:store-bootstrap-key
```

Behavior:

- requires an interactive TTY
- hides terminal input with `stty -echo`
- restores terminal state with `stty sane`
- rejects raw key CLI arguments
- reads existing Provider Vault master key from approved runtime env/key-file path
- writes encrypted secret only to the existing `provider_secrets` table
- creates/updates custom `provider_configs` row for `agentmail`
- prints only masked preview, fingerprint, length, and exposure flags

Safe failure proof:

- non-interactive run returns `approved_secret_intake_required`
- raw CLI key attempt returns `raw_secret_cli_argument_rejected`
- no raw value is printed

## Service Reference Path

Required service reference after owner stores the key:

```bash
sudo mkdir -p /etc/systemd/system/mission-control.service.d
printf '%s\n' '[Service]' 'Environment=AGENTMAIL_API_KEY_REF=AGENTMAIL_API_KEY' | sudo tee /etc/systemd/system/mission-control.service.d/agentmail-reference.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart mission-control.service
```

This exposes only the ref name to `mission-control.service`; it does not expose the AgentMail API key.

## Next Owner Command

Run this on `srv1568353` in the server shell:

```bash
cd /home/tony/mission-control
export PATH=/home/tony/.nvm/versions/node/v24.14.1/bin:/home/tony/bin:$PATH
pnpm run agentmail:store-bootstrap-key
sudo mkdir -p /etc/systemd/system/mission-control.service.d
printf '%s\n' '[Service]' 'Environment=AGENTMAIL_API_KEY_REF=AGENTMAIL_API_KEY' | sudo tee /etc/systemd/system/mission-control.service.d/agentmail-reference.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl restart mission-control.service
sudo systemctl status mission-control.service --no-pager
```

Then verify:

```bash
curl -I http://127.0.0.1:3337/login
curl -i http://127.0.0.1:3337/api/agentmail/status

## Post-Owner Verification - 2026-06-07T17:35Z

Owner completed the hidden prompt and service restart.

Runtime proof:

- `mission-control.service`: active
- service cwd: `/home/tony/mission-control/.next/standalone`
- drop-in: `/etc/systemd/system/mission-control.service.d/agentmail-reference.conf`
- process env: `AGENTMAIL_API_KEY_REF` present
- process env: no raw `AGENTMAIL_API_KEY` detected by sanitized env-name scan
- Provider Vault: active `agentmail / AGENTMAIL_API_KEY` row present, masked `am_****78f6`
- `/login`: `200`
- `/api/agentmail/status` unauthenticated: `401`
- `/api/agentmail/connect/test` unauthenticated: `401`

Safe runtime probe:

- endpoint: `https://api.agentmail.to/v0/inboxes`
- auth header: present, value not printed
- HTTP status: `200`
- inbox count: `2`
- exact blocker: `null`
- credential values exposed: `false`
- tokens exposed: `false`
- env values exposed: `false`

Still not enabled:

- no email sent
- no inboxes provisioned by Mission Control
- no scoped per-agent credentials created
- no auto-send enabled
- Bridge/Gateway/owner approval gates remain required

## Live Inbox Preview Hydration Follow-up - 2026-06-07T13:58Z

### Source/UI/API change
- Added sanitized live AgentMail inbox listing helper in `src/lib/agentmail-credential-resolver.ts`.
- Updated protected preview routes to use the live helper when runtime credentials are visible:
  - `POST /api/agentmail/connect/provision-preview`
  - `POST /api/agentmail/connect/sync`
- Updated `/agentmail` action summary to show `live_inboxes=<count>` after a successful protected preview/test action.

### Runtime proof after service restart
- `mission-control.service`: active
- Runtime cwd: `/home/tony/mission-control/.next/standalone`
- Runtime env reference: `AGENTMAIL_API_KEY_REF` present
- Runtime raw AgentMail key env: absent
- `/login`: `200`
- `GET /api/agentmail/status` unauthenticated: `401`
- `POST /api/agentmail/connect/provision-preview` unauthenticated: `401`
- `POST /api/agentmail/connect/sync` unauthenticated: `401`

### Safe AgentMail model after owner key install
- Safe endpoint: `https://api.agentmail.to/v0/inboxes`
- HTTP status: `200`
- Auth header present: yes, value not printed
- Provider Vault masked preview: `am_****78f6`
- Live inbox count: `2`
- Live inbox previews:
  - `i***@agentmail.to` / `ITT_AGENT`
  - `t***@agentmail.to` / `Chief-Tony88`
- `credential_values_exposed:false`
- `tokens_exposed:false`
- `env_values_exposed:false`

### Safety state unchanged
- Email sent: no
- Inbox provisioning performed: no
- Scoped per-agent credentials created: no
- Auto-send enabled: no
- Bridge/Gateway/owner approval bypassed: no
- `.env` diff lines: `0`
- Client bundle AgentMail key references: `0`

### Verification
- `pnpm exec vitest run src/lib/agentmail-credential-resolver.test.ts src/lib/agentmail-api-routes.test.ts`: pass, 29 tests.
- `pnpm exec vitest run src/lib/agentmail-bootstrap-store-script.test.ts src/lib/agentmail-credential-resolver.test.ts src/lib/agentmail-local-control.test.ts src/lib/agentmail-send-adapter.test.ts src/lib/agentmail-api-routes.test.ts`: pass, 59 tests.
- `pnpm run typecheck`: pass.
- `pnpm run build`: pass; standalone static/public sync completed.
- `git diff --check` on touched files/report: pass.
- Touched diff secret scan: clean for raw Bearer/API/token/cookie/password-looking values.
