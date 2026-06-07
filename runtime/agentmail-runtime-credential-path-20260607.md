# AgentMail Runtime Credential Path

Generated: 2026-06-07
Active runtime: `/home/tony/mission-control`
Service: `mission-control.service`

## Result

Runtime credential path chosen: existing encrypted Mission Control Provider Vault table (`provider_secrets`) plus service-visible reference name `AGENTMAIL_API_KEY_REF`.

`AGENTMAIL_API_KEY_REF` support: implemented.

Approved runtime secret storage exists: yes, the existing Provider Vault schema and master-key resolver are reused. No second vault was created.

Current live runtime visibility result: not connected yet.

Current primary blocker: `agentmail_owner_sso_or_api_key_required` because no AgentMail bootstrap credential or credential reference is currently visible to `mission-control.service`.

If `AGENTMAIL_API_KEY_REF` is configured but the Provider Vault master key or AgentMail vault row is unavailable, status now reports `agentmail_runtime_secret_store_required` or `agentmail_api_key_ref_unresolved` instead of pretending the hosted browser login is enough.

## Runtime Truth After Deployment

Service-level names checked from runtime shell:

- `AGENTMAIL_API_KEY`: missing
- `AGENTMAIL_API_KEY_REF`: missing
- `AGENTMAIL_CREDENTIAL_REF`: missing
- `AGENTMAIL_WS_URL`: missing
- `AGENTMAIL_ORGANIZATION_ID`: missing
- `AGENTMAIL_ORG_ID`: missing

Database counts:

- `agentmail_inboxes`: 6
- active `provider_secrets` rows for provider `agentmail`: 0
- `agentmail_scoped_credentials`: 0

AgentMail organization visibility result: not visible to `mission-control.service` yet.

## Behavior Added

AgentMail status now exposes sanitized runtime credential metadata:

- `runtime_credentials.agentmail_api_key`
- `runtime_credentials.agentmail_api_key_ref`
- `runtime_credentials.agentmail_credential_ref`
- `runtime_credentials.agentmail_org_id`
- `runtime_credentials.agentmail_ws_url`
- `runtime_credentials.credential_source`
- `runtime_credentials.masked_preview`
- `runtime_credentials.exact_blocker`

Secret safety flags:

- `raw_secret_exposed: false`
- `client_exposed: false`
- `credential_values_exposed: false`
- `tokens_exposed: false`
- `env_values_exposed: false`

The `/agentmail` UI now tells the owner that browser login succeeds only for the hosted AgentMail site and that Mission Control still needs a server-side credential reference that `mission-control.service` can read.

## Inbox Sync Preview

No real AgentMail organization is visible yet, so inbox sync remains preview-only.

Proposed inbox addresses:

- Pi -> `pi@agentmail.to`
- Agent Zero -> `agent-zero@agentmail.to`
- Gateway -> `gateway@agentmail.to`
- Bridge Unit -> `bridge-unit@agentmail.to`
- Mission Control Monitor -> `agentmail-monitor@agentmail.to`
- Audit Archive -> `agentmail-audit@agentmail.to`

Missing inboxes:

- Pi
- Agent Zero
- Gateway
- Bridge Unit
- Mission Control Monitor
- Audit Archive

Required scoped credentials:

- Pi: inbox-scoped credential required
- Agent Zero: inbox-scoped credential required

Required future send permissions for Pi and Agent Zero:

- `inbox_read`
- `thread_read`
- `message_read`
- `message_send`
- `message_update`
- `draft_read`
- `draft_create`
- `draft_update`
- `draft_send`

Control-plane/no-send identities remain restricted:

- Gateway: control-plane only
- Bridge Unit: dispatch/control-plane only
- Mission Control Monitor: no-send
- Audit Archive: no-send

## Safety Proof

No email was sent.
No inboxes were provisioned.
No scoped credentials were created.
No `.env` or `.env.local` values were modified.
No second vault was created.
No browser cookies, Google credentials, OAuth tokens, AgentMail API keys, authorization headers, or webhook secrets were exposed.
No Zapier, HeyGen, broad connector, SMB, or external farmer action was run.
Gateway policy, owner approval, and AgentMail Action Bridge Session were not bypassed.

## Checks

- Targeted AgentMail tests: passed, 52/52.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `mission-control.service`: restarted and active.
- Runtime cwd: `/home/tony/mission-control/.next/standalone`.
- `/login`: HTTP 200.
- AgentMail protected routes returned HTTP 401 unauthenticated.
- Production source secret scan: clean.
- Client bundle AgentMail secret scan: clean.
- `.env` / `.env.local` diff lines: 0.

## Files Changed

- `src/lib/agentmail-credential-resolver.ts`
- `src/lib/agentmail-local-control.ts`
- `src/lib/agentmail-local-control.test.ts`
- `src/app/agentmail/page.tsx`
- `runtime/agentmail-runtime-credential-path-20260607.md`

## Next Hop

Add an approved AgentMail bootstrap key into existing encrypted runtime secret storage under provider id/reference `agentmail` / `AGENTMAIL_API_KEY`, then make `mission-control.service` aware of `AGENTMAIL_API_KEY_REF=AGENTMAIL_API_KEY` through an approved service-level secret injection path. Do not put the raw key in `.env` or the browser.

After that:

1. Run AgentMail connection test.
2. Confirm `agentmail_connection_visible_to_runtime`.
3. Confirm organization selected / inbox sync ready.
4. Run inbox sync preview only.
5. Request owner approval before provisioning inboxes.
6. Do not create scoped credentials until approved runtime secret storage is confirmed for one-time returned scoped keys.
7. Do not send email.

## Rollback

```bash
cd /home/tony/mission-control
git revert <commit-sha>
sudo systemctl restart mission-control.service
```
