# Space Agent Service Plan

Generated: 2026-05-06
Scope: Phases 081-090. Planning only. No persistent service was created, enabled, started, or exposed.

## Executive Summary

Space Agent should start as a local-only Gateway research worker candidate. It must not be publicly exposed, must not receive production secrets, and must not run as a persistent service until the dependency audit finding, sandbox test failures, Gateway read-only adapter, auth proxy, and policy tests are resolved.

Recommended service state: planned, inactive.

## Phase 081 - Service Mode Decision

Initial service mode: local-only.

Allowed initial runtime shape:

- Loopback bind only.
- Gateway/Mission Control proxy preferred for owner access.
- Read-only Research Packet mode only.
- External writes disabled.
- Browser/web/YouTube/Firecrawl research gated by Gateway policy.

Disallowed initial runtime shape:

- Public internet bind.
- Direct unauthenticated UI.
- Production secret injection.
- Admin mode exposed to owner traffic without Gateway policy.
- Persistent service before tests and audit gates pass.

## Phase 082 - Systemd Service Plan, Not Active Yet

No service unit was installed in this phase.

Draft user-service shape for future review only:

```ini
[Unit]
Description=Space Agent Gateway Research Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=<approved-space-agent-install-dir>
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=31991
Environment=SINGLE_USER_APP=false
Environment=CUSTOMWARE_WATCHDOG=false
Environment=CUSTOMWARE_GIT_HISTORY=false
Environment=CLOUD_SHARE_ALLOWED=false
ExecStart=<node-path> space serve HOST=127.0.0.1 PORT=31991 SINGLE_USER_APP=false CUSTOMWARE_WATCHDOG=false CUSTOMWARE_GIT_HISTORY=false CLOUD_SHARE_ALLOWED=false
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=<approved-space-agent-runtime-dir>

[Install]
WantedBy=default.target
```

Future hardening requirements before activation:

- Replace placeholder install/runtime dirs with approved paths.
- Use a dedicated low-privilege runtime owner if practical.
- Keep writable runtime paths narrow.
- Confirm service cannot read production secret stores directly.
- Confirm Gateway proxy can authenticate and authorize all owner traffic.

## Phase 083 - Port Plan

Reserved sandbox/test port: `31991`.

Port policy:

- Bind to `127.0.0.1` by default.
- Do not bind to `0.0.0.0`.
- Do not expose through public Cloudflare or public reverse proxy.
- Tailnet exposure is not needed initially if Mission Control proxies the route.
- If Tailnet access is ever approved, it must still require auth and be explicitly documented.

## Phase 084 - Localhost/Tailnet Preference

Preferred access path:

1. Owner uses Mission Control.
2. Gateway route authenticates owner.
3. Gateway policy decides whether Space Agent research is allowed.
4. Gateway calls local Space Agent adapter on loopback.
5. Space Agent returns a Research Packet.
6. Agent Zero, Hermes, Pi, or the responsible specialist receives the packet.

Direct Tailnet access should remain optional and blocked until there is a clear need.

## Phase 085 - No Public Exposure

Public exposure status: not approved.

Blocked exposure paths:

- Public HTTP port.
- Public HTTPS reverse proxy.
- Public desktop/browser UI.
- Unauthenticated direct Space Agent endpoint.
- Direct Space Agent admin surface.

Any future public exposure requires a separate owner approval and auth/security review.

## Phase 086 - Auth Required for UI

Auth rule:

- Owner-facing UI access must go through Mission Control/Gateway auth.
- Space Agent UI must not be directly exposed without authenticated owner access.
- Gateway proxy should redact secrets, raw local paths, task IDs, and internal logs.

Allowed owner-facing surface:

- Gateway page or Space Agent detail panel inside Mission Control.

Blocked owner-facing surface:

- Standalone Space Agent UI without auth.

## Phase 087 - Admin Mode Disabled or Protected

Admin mode decision:

- Disabled for normal Space Agent Gateway research mode.
- Protected behind Gateway policy if ever needed for maintenance.

Rationale:

- Space Agent single-user mode grants local `_admin` behavior for sandbox convenience.
- That convenience must not become production authority.
- File, module, Git rollback, and admin operations are protected actions, not research actions.

Production default:

- `SINGLE_USER_APP=false` unless a reviewed auth proxy design explicitly allows another shape.
- Admin routes are not owner-facing through the Space Agent node.

## Phase 088 - Gateway Proxy Preferred

Gateway proxy is preferred over direct UI exposure because it can provide:

- Owner authentication.
- Route classification.
- Read/write/execute policy decisions.
- Bridge Session enforcement.
- Secret and raw-path redaction.
- Audit trail.
- Research Packet normalization.
- Blocked-reason reporting.

Space Agent should not bypass Gateway.

## Phase 089 - Rollback Plan

Because no persistent service was installed, current rollback is documentation-only:

- Revert this report commit if needed.
- Remove temporary sandbox clones if desired.
- Do not touch production services.

Future service rollback, if a service is later installed:

```bash
systemctl --user stop space-agent-gateway.service
systemctl --user disable space-agent-gateway.service
systemctl --user reset-failed space-agent-gateway.service
```

If a unit file is later created, rollback should also remove or archive that unit only after confirming no runtime data needs preservation.

## Phase 090 - Persistent Service Gate

Persistent service activation remains blocked until all gates pass:

- High-severity dependency audit finding resolved or formally risk-accepted.
- Focused tests pass under an approved runner profile or failures are documented and waived.
- Gateway read-only Research Packet adapter exists.
- Space Agent node has no-write/no-secret/no-public-bind policy tests.
- Mission Control auth proxy is proven.
- Admin/file/module/Git mutation surfaces are blocked by default.
- External writes require Bridge Session scope.
- No raw local paths or secrets appear in owner-facing output.

Final decision for this phase:

- Do not start a persistent service yet.
- Continue with Gateway adapter and policy implementation first.

## No-Secrets Confirmation

- No credentials were read or printed.
- No `.env` file was opened, changed, or copied.
- No service was installed, enabled, or started.
- No public port was opened.
- No external write was executed.
- No OpenCloud, Build-Wiki, farmer, Zapier, HeyGen, SMB, Drive, OneDrive, or AgentMail action was run.
