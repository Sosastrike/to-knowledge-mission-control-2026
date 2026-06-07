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
