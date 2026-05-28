# OpenClaw / OpenCloud Dependency Map

Generated: 2026-05-28

Scope: Phase 1 read-only inventory. Secret-bearing files such as `.env*`, cookies, tokens, auth files, and raw credentials were excluded from value inspection.

| Dependency | File / route / service | Current role | Risk | Classification | Migration target | Rollback note | Secret involved |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenClaw gateway runtime | `openclaw-gateway.service`; loopback listeners `127.0.0.1:18789`, `[::1]:18789`, `127.0.0.1:18791` | Legacy local gateway/runtime service | Could remain hidden dispatcher if any owner message route still depends on it | keep_as_explicit_tool_only | Nuclear Gateway direct-line registry and certified adapter registry | Do not stop until Phase 10 dependency cutover; rollback is service restart only if later disabled | Unknown, values redacted |
| OpenClaw daily helper | `openclaw-daily.service` | Inactive helper unit | Unknown operational dependency | unknown_dependency | Inventory then either migrate scheduled function or disable after rollback proof | Leave untouched during Phase 1 | Unknown, values redacted |
| OpenClaw health helper | `openclaw-health.service` | Inactive helper unit | Health UI may still reference it | migrate_to_nuclear_gateway | Nuclear Gateway health/status routes | Leave untouched during Phase 1 | Unknown, values redacted |
| OpenClaw NAS backup helper | `openclaw-nas-backup.service` | Inactive helper unit | Could touch production backups if restarted unsafely | unknown_dependency | Separate backup governance task, not command path | Leave untouched during Phase 1 | Unknown, values redacted |
| OpenCloud docs farmer | `opencloud-docs-farmer.service`; `opencloud-docs-farmer.service_only` scope text | Build-Wiki/Farmer append-only docs runtime | Naming implies OpenCloud ownership; execution must stay Bridge-gated | migrate_to_nuclear_gateway | Brain Bridge / Build-Wiki direct-line routes | Preserve service until Brain Bridge route proof exists | Unknown, values redacted |
| ClaudeClaw transport | `claudeclaw.service` | Agent Zero Telegram transport | Name can be confused with OpenClaw; must be verified transport-only | unknown_dependency | Jarvis direct-line trace kit and Telegram identity proof | Leave service untouched; verify route ownership | Unknown, values redacted |
| Agent routing registry | `src/lib/agent-routing-lines.ts`; `/api/bridge/agent-routing/*` | Early direct-line registry | Stale Mission Control Gateway wording and Hermes canonical ID could obscure Nuclear Gateway path | migrate_to_nuclear_gateway | Nuclear Gateway direct-line registry | Code rollback via `git revert <commit-hash>` | No secret values |
| Authority policy | `src/lib/opencloud-authority-policy.ts` | OpenCloud/OpenClaw demotion policy | Allowed-role names were too broad and missing credential/default-gateway refusals | migrate_to_nuclear_gateway | OpenClaw supporting-runtime-only policy | Code rollback via `git revert <commit-hash>` | No secret values |
| Agent line trace kit | `src/lib/agent-line-trace.ts`; `scripts/agent-line-trace.sh` | Direct-line proof tool | Legacy route trace used `mission_control_gateway`; aliases still needed | migrate_to_nuclear_gateway | Direct Agent Line Trace Kit | Code rollback via `git revert <commit-hash>` | No secret values; script does not print auth values |
| Gateway Agent Hub source | `src/lib/gateway-agent-hub.ts` | Owner-facing status payload | UI can imply Gateway/OpenClaw hierarchy incorrectly if stale wording persists | migrate_to_nuclear_gateway | Nuclear Gateway graph/cards | Code rollback via `git revert <commit-hash>` | No secret values |
| Credential status surface | `/api/bridge/credentials/*` | New name-only credential broker routes | Must never expose values | migrate_to_nuclear_gateway | Nuclear Gateway Credential Broker | Remove new route files if rollback needed | Names only; values redacted |
| Gateway graph OpenClaw node | `src/lib/gateway-model.ts` and graph consumers | OpenClaw appears as supporting runtime node | Could be misread as agent/dispatcher if UI is stale | migrate_to_nuclear_gateway | Nuclear Gateway central broker node; OpenClaw supporting runtime node | Code rollback via `git revert <commit-hash>` | No secret values |
| OpenClaw adapter files | `src/lib/adapters/openclaw.ts`; OpenClaw doctor/status helpers | Diagnostics/adapter bridge | Adapter use must be explicit, exact-scope, audited | keep_as_explicit_tool_only | Certified adapter registry under Nuclear Gateway | Leave adapter until Phase 6 migration completes | Unknown, values redacted |
| Package scripts / e2e checks | `package.json` OpenClaw script names | Test helpers | Test wording can imply OpenClaw is central if not renamed | migrate_to_nuclear_gateway | Nuclear Gateway tests with OpenClaw demotion cases | Code rollback via `git revert <commit-hash>` | No secret values |
| Docs/reports mentioning OpenCloud/OpenClaw | `docs/*`, `runtime/*`, release notes | Historical and owner-facing status | Owner-facing docs must not claim OpenClaw is commander/default gateway | migrate_to_nuclear_gateway | Updated migration docs and historical labels | Docs rollback via `git revert <commit-hash>` | No secret values |

## Hidden Routing Risks Found

- Any owner-to-agent path that lists OpenClaw/OpenCloud as `conversation_owner`, hidden intermediary, default gateway, credential broker, or commander must be refused.
- OpenClaw can remain only in explicit `tools_called` / supporting-runtime roles with visible task, audit, rollback/no-state proof, and exact scope.

## Credential Risks Found

- Credential names may exist across Mission Control, Paperclip, Ron legacy aliases, Brain Bridge, and OpenClaw runtime config, but values were not inspected or printed.
- Broker status must remain name-only and owned by Nuclear Gateway, not OpenClaw.

## Next Safe Lane

Continue Phase 2 direct-line registry enforcement and Phase 3 message envelope refusal tests before any runtime cutover.

## Phase 6 Tool / MCP Migration Addendum

Generated: 2026-05-28

Phase 6 adds an owner-safe Nuclear Gateway tool migration map at:

- `src/lib/nuclear-gateway-tool-migration.ts`
- `GET /api/bridge/nuclear-gateway/tool-migration`

The map classifies OpenClaw/OpenCloud tool dependencies without inspecting secret values:

- `READ_ONLY`: session transcript reads, skill inventory, cron inventory, runtime health/version diagnostics.
- `WRITE_GATED`: session send/control, skill activation, cron run/update/delete.
- `CREDENTIAL_REQUIRED`: integration credential-name catalog, brokered by Nuclear Gateway by name only.
- `PERMISSION_REQUIRED`: backup creation or other production-sensitive actions.
- `UNSAFE_DISABLED`: OpenClaw update/doctor repair surfaces under the owner directive to not repair OpenClaw.

Safety proof:

- OpenClaw is not the tool broker of record.
- Nuclear Gateway is the tool broker of record.
- OpenClaw cannot be conversation owner, hidden intermediary, credential broker, default gateway, or commander.
- All writes/execution remain disabled in this map until exact-scope adapter, Jarvis concurrence, audit, and rollback proof exist.
- Credential names are listed only when needed; values are not inspected or exposed.

## Phase 6 Tool / MCP Migration Addendum

Generated: 2026-05-28

Phase 6 adds an owner-safe Nuclear Gateway tool migration map at:

- `src/lib/nuclear-gateway-tool-migration.ts`
- `GET /api/bridge/nuclear-gateway/tool-migration`

The map classifies OpenClaw/OpenCloud tool dependencies without inspecting secret values:

- `READ_ONLY`: session transcript reads, skill inventory, cron inventory, runtime health/version diagnostics.
- `WRITE_GATED`: session send/control, skill activation, cron run/update/delete.
- `CREDENTIAL_REQUIRED`: integration credential-name catalog, brokered by Nuclear Gateway by name only.
- `PERMISSION_REQUIRED`: backup creation or other production-sensitive actions.
- `UNSAFE_DISABLED`: OpenClaw update/doctor repair surfaces under the owner directive to not repair OpenClaw.

Safety proof:

- OpenClaw is not the tool broker of record.
- Nuclear Gateway is the tool broker of record.
- OpenClaw cannot be conversation owner, hidden intermediary, credential broker, default gateway, or commander.
- All writes/execution remain disabled in this map until exact-scope adapter, Jarvis concurrence, audit, and rollback proof exist.
- Credential names are listed only when needed; values are not inspected or exposed.
