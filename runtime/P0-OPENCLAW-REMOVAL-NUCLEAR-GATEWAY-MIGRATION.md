# P0 OpenClaw Removal / Nuclear Gateway Migration

Status: Phase 1 inventory started; Phase 2 direct-line enforcement source work started.

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
- current_phase: Phase 1 OpenClaw dependency inventory
- progress_percent: 15
- blocker: none for source inventory
- next_safe_lane: Phase 2 direct-line registry enforcement
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

## Phase 5 Source Changes Started

Credential broker source/routes were added as name-only status surfaces:

- `GET /api/bridge/credentials/status`
- `GET /api/bridge/credentials/:system/status`
- `POST /api/bridge/credentials/broker-check`

These routes report credential names and boolean presence only. They do not return values.

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
git restore src/lib/agent-routing-lines.ts src/lib/opencloud-authority-policy.ts src/lib/gateway-agent-hub.ts scripts/agent-line-trace.sh
rm -f src/lib/credential-broker.ts src/lib/credential-broker.test.ts
rm -rf src/app/api/bridge/credentials
rm -f runtime/P0-OPENCLAW-REMOVAL-NUCLEAR-GATEWAY-MIGRATION.md runtime/openclaw-dependency-map.md
```

After commit:

```bash
git revert <commit-hash>
```
