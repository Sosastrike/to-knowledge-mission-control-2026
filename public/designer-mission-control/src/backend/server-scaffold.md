# Backend scaffold — endpoint reference

Companion to `schema.jsx` + `api-client.jsx`. This file describes
the HTTP surface a real backend must implement to replace the
local adapter. The API client method names map 1:1 to routes.

## Conventions

- Auth: bearer session cookie, rotated on every reauth.
- **Reauth cap: 72 hours (3 days), enforced server-side** — `security.policy.reauthHours` is clamped to `[1, 72]` on write. The UI cannot bypass.
- All `security.*` and `users.*` mutations MUST append to `audit_events`.
- Destructive actions (`users.delete`, `token.revoke`, `session.revoke_all`, `ip.remove`) require role=`owner` OR explicit capability grant.
- Agent Zero commander and archived legacy records are structurally protected. Any attempt to delete, suspend, or change their role returns `409 INVARIANT_PROTECTED_USER` / `INVARIANT_PROTECTED_ROLE`.

## Routes

### Users
| Method | Path | Role | Audit action | Notes |
|---|---|---|---|---|
| GET    | `/api/users`              | admin+ | — | Join users + role_assignments + user_security |
| POST   | `/api/users/invite`       | admin  | `user.invite` + `mail.send.pending` | Dispatch SMTP invite |
| PATCH  | `/api/users/:id`          | admin  | `user.role.change`, `user.2fa.change`, `user.suspend`, `user.reactivate` | Rejects owner role writes |
| DELETE | `/api/users/:id`          | owner  | `user.delete` | Cascade to role_assignments + user_security |
| POST   | `/api/mail/send`          | admin  | `mail.send` | SMTP dispatch; backend-required |

### Agent 0 · brain-oversight specialist (owner-only)
Agent Zero is the first-class ecosystem commander responsible for Mission Control, Bridge, and Brain coordination. Hermes is the lieutenant for skills and workflows. Protected actions require Bridge Session approval.

Enforcement:
- Schema capability `agent_zero.request` is `true` **only for role=owner** in `ROLE_PERMISSIONS` (`src/backend/schema.jsx`).
- Schema capability `agent_zero.scope` (view/adjust oversight scope) is also owner-only.
- UI reads the capability via `window.permitted(role, 'agent_zero.request')` and disables the action for non-owners.
- Server MUST gate the endpoints below against the same capability.

| Method | Path | Role | Audit action | Notes |
|---|---|---|---|---|
| POST   | `/api/agent-zero/request`       | owner  | `agent_zero.request` | Body: `{ task, context }`. Returns task handle. Rejects every non-owner with `403 OWNER_ONLY_AGENT_ZERO`. |
| GET    | `/api/agent-zero/scope`         | owner  | — | Returns current oversight scope (indexed sources, graph regions). |
| PUT    | `/api/agent-zero/scope`         | owner  | `agent_zero.scope.update` | Update what Agent 0 supervises. |
| GET    | `/api/agent-zero/audit`         | owner  | — | Agent 0's own action log, separate from workspace audit. |

### Security
| Method | Path | Role | Audit action |
|---|---|---|---|
| GET  | `/api/security/policy`          | admin+ | — |
| PUT  | `/api/security/policy`          | owner  | `security.policy.update` |
| GET  | `/api/security/sso`             | admin+ | — |
| PUT  | `/api/security/sso`             | owner  | `security.sso.update` |
| POST | `/api/security/sso/callback`    | public | `security.sso.callback` |
| GET  | `/api/security/ip`              | admin+ | — |
| POST | `/api/security/ip`              | owner  | `security.ip.add` |
| DELETE | `/api/security/ip/:id`        | owner  | `security.ip.remove` |
| GET  | `/api/security/tokens`          | admin+ | — |
| POST | `/api/security/tokens`          | admin  | `security.token.create` (raw returned once) |
| DELETE | `/api/security/tokens/:id`    | admin  | `security.token.revoke` |
| GET  | `/api/sessions`                 | admin+ | — |
| DELETE | `/api/sessions/:id`           | admin  | `security.session.revoke` |
| POST | `/api/sessions/revoke_all`      | admin  | `security.session.revoke_all` |

### Audit
| Method | Path | Role |
|---|---|---|
| GET  | `/api/audit?limit=N` | admin+ |
| POST | `/api/audit/export`  | admin+ |

### Models (provider routing)
| Method | Path | Role | Audit action | Notes |
|---|---|---|---|---|
| GET    | `/api/models`                     | admin+ | — | Returns `provider_models` rows + assignments |
| POST   | `/api/models/:id/keys`            | owner  | `model.keys.set`    | Body holds raw key; server writes vault, returns `key_ref` only |
| DELETE | `/api/models/:id/keys`            | owner  | `model.keys.rotate` | Clears `key_ref` → flips `wired=false`, `status=needs_key` |
| PUT    | `/api/models/routing`             | admin  | `model.routing.set` | Body: `{ agent_id, model_id, role }`; upserts `agent_model_routing` |

### Integrations
| Method | Path | Role | Audit action | Notes |
|---|---|---|---|---|
| GET    | `/api/integrations`               | admin+ | — | |
| POST   | `/api/integrations/:id/connect`   | admin  | `integration.connect`    | OAuth/device flow; backend stores refresh token in vault → `credential_ref` |
| POST   | `/api/integrations/:id/keys`      | admin  | `integration.keys.set`   | For non-OAuth providers (access keys) |
| DELETE | `/api/integrations/:id/keys`      | admin  | `integration.keys.rotate`| Sets `credential_status=missing`, force-disables row |
| PATCH  | `/api/integrations/:id/enable`    | admin  | `integration.enable` / `integration.disable` | Invariant: cannot enable with `credential_status=missing` |
| POST   | `/api/integrations/:id/assign`    | admin  | `integration.assign`     | Body: `{ scope, target_id }` |
| POST   | `/api/integrations/:id/test`      | admin  | `integration.test`       | Dry ping against the provider |

### Agents (supervisor)
| Method | Path | Role | Audit action | Notes |
|---|---|---|---|---|
| GET    | `/api/agents`                     | admin+ | — | Read-through of `agent_runtime` |
| POST   | `/api/agents/:id/restart`         | admin  | `agent.restart`   | Destructive — requires live supervisor |
| POST   | `/api/agents/:id/reconnect`       | manager| `agent.reconnect` | Soft reconnect |
| GET    | `/api/agents/:id/logs`            | admin  | `agent.logs.view` | Streaming (SSE or WS) |

### Email / SMTP
| Method | Path | Role | Audit action | Notes |
|---|---|---|---|---|
| GET    | `/api/email/profiles`                | admin+ | — | |
| POST   | `/api/email/profiles`                | admin  | `email.profile.create` | Body excludes raw creds |
| PATCH  | `/api/email/profiles/:id`            | admin  | `email.profile.update` | Rejects `password`, `api_key`, `secret` keys |
| DELETE | `/api/email/profiles/:id`            | admin  | `email.profile.delete` | Cascades to `email_routing` → `unassigned` |
| POST   | `/api/email/profiles/:id/keys`       | owner  | `email.profile.keys.set`    | Raw SMTP password / API key → vault; returns `credential_ref` |
| DELETE | `/api/email/profiles/:id/keys`       | owner  | `email.profile.keys.rotate` | Clears `credential_ref` → `status=needs_credentials` |
| POST   | `/api/email/profiles/:id/test`       | admin  | `email.profile.test`   | Requires real SMTP service; until then returns `BACKEND_REQUIRED` |
| POST   | `/api/email/profiles/test-all`       | admin  | `email.profile.test`   | Iterates |
| GET    | `/api/email/addresses`               | admin+ | — | |
| POST   | `/api/email/addresses`               | admin  | `email.address.create` | |
| POST   | `/api/email/addresses/:id/verify`    | admin  | `email.address.verify` | Requires DNS probe service; returns `BACKEND_REQUIRED` |
| GET    | `/api/email/routing`                 | admin+ | — | |
| PATCH  | `/api/email/routing/:id`             | admin  | `email.routing.update` | Invariant: null profile_id → status=unassigned, from_address=null |

## Vault-dependent fields

These fields must be opaque refs in the DB, not raw secrets:
- `user_security.twoFA_secret_ref`
- `user_security.backup_codes_ref`
- `workspace_api_tokens.hash_ref`
- `workspace_sso_connections.metadata_ref`
- provider credentials (OpenRouter, Twilio, SMTP passwords, OAuth refresh tokens)

The vault service owns encryption at rest + key rotation. The API never returns raw secret material except the one-time raw token shown at creation.
