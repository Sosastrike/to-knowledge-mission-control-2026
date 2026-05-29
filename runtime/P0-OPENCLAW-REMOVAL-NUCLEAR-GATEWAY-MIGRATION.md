# P0 OpenClaw Removal / Nuclear Gateway Migration

Status: Phase 1 inventory complete; Phase 2 direct-line enforcement and Phase 3 route-trace refusal proof in progress.

Architecture target:

Owner -> Mission Control -> Nuclear Gateway -> Direct Agent Line -> Certified Adapter / MCP / API Tool

Non-goals for this hop:

- No OpenClaw repair.
- No OpenClaw shutdown.
- No `.env` edits.
- No credential injection.
- No public exposure, DNS, Caddy, Tailscale, or firewall changes.
- No destructive Paperclip or production data changes.

## Owner-Visible Task

Task title: OpenClaw Removal / Nuclear Gateway Migration

Required metadata:

- assigned_agent: agent-zero-jarvis
- current_phase: Phase 2 / Phase 3 Nuclear Gateway direct-line enforcement
- progress_percent: 84
- blocker: live authenticated external-agent receive proof remains pending before Phase 10 cutover
- next_safe_lane: continue Direct Agent Line Trace Kit live proof and remove remaining non-canonical owner-facing gateway wording
- project_continues: true
- audit_id: audit_openclaw_inventory_phase1
- rollback_id: no_state_openclaw_inventory_phase1

## Phase 1 Inventory Result

Dependency map: `runtime/openclaw-dependency-map.md`

Live read-only observations:

- `openclaw-gateway.service` is present as a user service and was observed active/running.
- OpenClaw loopback listeners were observed on `127.0.0.1:18789`, `[::1]:18789`, and `127.0.0.1:18791`.
- Inactive user service units include OpenClaw daily, health, and NAS backup helpers.
- `opencloud-docs-farmer.service` is present but inactive/dead and remains a Build-Wiki/Farmer dependency to migrate under Brain Bridge/Gateway proof.
- `claudeclaw.service` is present as Agent Zero Telegram transport and must be verified as transport only, not OpenClaw command authority.

No `.env` contents were read or printed for this inventory.

## Phase 2 Source Changes Started

Direct-line registry now names the intended routing path as:

Owner -> Mission Control -> Nuclear Gateway -> target agent

Canonical direct-line IDs moved toward:

- `agent-zero-jarvis`
- `ron-weasley` with `hermes` / `hermans` legacy aliases
- `pi`
- `paperclip`
- `spaceagent`
- `brain-bridge` with `brain` / `brain-sync` legacy aliases
- `ron-mini-agent.*` with `hermes-mini-agent.*` legacy aliases
- `openclaw` as inactive supporting runtime, not a conversation owner

## Phase 2 / Phase 3 Update - 2026-05-29

The Ron/Jarvis legacy direct-line parity surface now reports the direct transport as Nuclear Gateway-owned:

- `transport_mode: nuclear_gateway_direct`
- `mode: nuclear_gateway_direct_agent_lines`
- `gateway_node: nuclear-gateway`
- `route_trace: owner -> mission-control -> nuclear-gateway -> target agent`

Legacy `/api/bridge/hermes/*` route IDs remain intact as Ron Weasley aliases; owner-facing authority remains Jarvis final authority with Ron delegated under Jarvis. OpenClaw/OpenCloud is not in the route trace, not a conversation owner, not an intermediary, and not a commander.

Fresh targeted proof:

- `src/lib/hermes-direct-line-parity.test.ts`
- `src/lib/agent-routing-lines.test.ts`
- `src/lib/agent-line-trace.test.ts`
- `src/lib/nuclear-gateway-cutover-certification.test.ts`

Result: 48 tests passed.

## Phase 5 Source Changes Started

Credential broker source/routes were added as name-only status surfaces:

- `GET /api/bridge/credentials/status`
- `GET /api/bridge/credentials/:system/status`
- `POST /api/bridge/credentials/broker-check`

These routes report credential names and boolean presence only. They do not return values.

## Phase 6 Dispatch Transport Addendum - 2026-05-29

The Nuclear Gateway tool migration map now explicitly tracks Mission Control task dispatch surfaces that still depend on OpenClaw/OpenCloud-compatible transport:

- `openclaw.task_dispatch.new_session`
- `openclaw.task_dispatch.target_session`
- `openclaw.task_review.aegis`
- `openclaw.task_broadcast`

All four are classified as `WRITE_GATED` with `openclaw_allowed_role: not_allowed`, `writes_enabled: false`, and `execution_enabled: false` in the migration map. This hop does not change runtime dispatch behavior; it makes the remaining dependency owner-visible and blocks fake cutover until direct-line task dispatch, target-session handoff, Aegis review, and broadcast adapters have route-trace/audit/rollback proof.

## Current Safety Proof

- Secrets exposed: false
- Raw `.env` values exposed: false
- OpenClaw stopped/disabled: false
- OpenClaw repaired or made smarter: false
- Public exposure changed: false
- Production data deleted: false
- Broad connector execution: false

## Rollback

Before commit:

```bash
git restore --staged src/lib/hermes-direct-line-parity.ts src/lib/hermes-direct-line-parity.test.ts runtime/P0-OPENCLAW-REMOVAL-NUCLEAR-GATEWAY-MIGRATION.md runtime/openclaw-dependency-map.md
git restore src/lib/hermes-direct-line-parity.ts src/lib/hermes-direct-line-parity.test.ts runtime/P0-OPENCLAW-REMOVAL-NUCLEAR-GATEWAY-MIGRATION.md runtime/openclaw-dependency-map.md
```

After commit:

```bash
git revert <commit-hash>
```
