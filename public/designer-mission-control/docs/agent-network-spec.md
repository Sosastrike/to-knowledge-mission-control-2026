# Gateway — Developer Handoff Spec

> **Version:** 2026-04-28 · **Status:** Prototype only · No production calls
> **Owner:** Design (Claude) → Engineering (Luis / Mission Control team)

This spec describes everything required to take the Gateway prototype
(legacy-compatible files under `src/agent-network/*`) to production. The prototype is fully wired in-browser
through `window.AgentRegistry` (in-memory store). Engineering must implement
the equivalent server-side records, mutations, and event streams.

---

## 1. Concepts

| Concept | Meaning |
|---|---|
| **Agent** | A running entity (LLM-backed or scripted) with a tier, owner, perms, and engines. |
| **Engine** | A non-agent capability node — REST/MCP/webhook/queue/script/cloud — that an agent can call. |
| **Tier** | One of `commander · lieutenant · specialist · worker`. Affects routing/scope. |
| **Brain Sync** | The learning ledger. Append-only event stream describing memory updates, flags, confidence shifts. |
| **Harness** | The routing layer. Append-only event stream of `route(actor → target, kind, ticket)`. |
| **Approval** | A protected action (severity `low/medium/high`) that pauses until granted. |
| **Cost** | Per-agent token + dollar spend, with severity badges. |

---

## 2. Data model (canonical)

### `agents`
```ts
type Agent = {
  id: string;                    // slug, immutable
  display_name: string;
  kind: 'agent' | 'engine';
  tier: 'commander' | 'lieutenant' | 'specialist' | 'worker';
  cluster: string | null;        // e.g. "ClaudeClaw"
  status: 'online' | 'idle' | 'degraded' | 'offline' | 'retired';
  health_pct: number;            // 0..100
  sync_state: 'synced' | 'syncing' | 'stale' | 'flagged';
  confidence_pct: number;
  protected: boolean;            // tony / agent_zero are true
  owner: string;                 // user id
  reports_to: string | null;     // agent id
  perms: string[];               // see §5
  cost_today_usd: number;
  tokens_today: number;
  last_seen_at: string;          // ISO
  created_at: string;
  retired_at: string | null;
  retired_reason: string | null;
};
```

### `engines` (capability nodes)
Same shape as Agent with `kind:'engine'` plus:
```ts
transport: 'local' | 'rest' | 'mcp' | 'webhook' | 'queue' | 'script' | 'cloud';
endpoint: string | null;
auth_kind: 'none' | 'bearer' | 'basic' | 'oauth' | 'mtls';
budget_usd_day: number | null;
```

### `connections`
```ts
{ from_agent_id, to_engine_id, scope:string[], created_at }
```

### `tickets`
```ts
{ id, title, owner_agent_id, route:string[], status:'queued'|'running'|'awaiting_approval'|'done'|'failed', cost_usd, created_at, closed_at }
```

### `approvals`
```ts
{ id, action, severity:'low'|'medium'|'high', requested_by, target, reason, status:'pending'|'granted'|'denied'|'expired', requested_at, resolved_at, resolves_in_min }
```

### `brain_sync_events`  (append-only)
```ts
{ id, at, actor:string, target:string, kind:'memory_proposal'|'confidence_shift'|'source_of_truth'|'flag'|'review', note:string, severity?:'low'|'medium'|'high' }
```

### `harness_events`  (append-only)
```ts
{ id, at, route:string, kind:'handoff'|'escalate'|'flag'|'approval_request'|'broadcast', ticket:string|null, payload:object }
```

### `cost_warnings`
```ts
{ id, at, target:string, severity:'warn'|'crit', note:string }
```

---

## 3. APIs (proposed)

All routes are **server-authoritative**. The prototype's `window.AgentRegistry`
exposes the equivalent client-side surface; replace it with a thin HTTP wrapper.

```
GET    /api/network                          → { agents, tickets, approvals, brain_sync, harness, cost }
POST   /api/agents                           → create agent
PATCH  /api/agents/:id                       → rename / setStatus / setTier (non-protected)
POST   /api/agents/:id/retire                → soft-delete (Tony / Agent 0 → 423 Locked)
POST   /api/agents/:id/restore
POST   /api/agents/:id/promote               → toTier (commander promotion ⇒ approval)
POST   /api/agents/:id/connect-engine        → engineId, scope[]
DELETE /api/agents/:id/connections/:engineId

POST   /api/engines                          → create engine (transport, endpoint, auth_kind)
POST   /api/engines/:id/test                 → health probe (warn-only)

POST   /api/tickets                          → create + route
PATCH  /api/tickets/:id                      → status / owner

POST   /api/approvals                        → request
POST   /api/approvals/:id/grant
POST   /api/approvals/:id/deny

GET    /api/events?stream=brain_sync         → SSE
GET    /api/events?stream=harness            → SSE
GET    /api/cost?window=today                → snapshot
```

### Auth + RBAC
Reuse existing `requireRole()` from `server/middleware/auth.js`. Required roles:

| Action | Role |
|---|---|
| Read network | `viewer+` |
| Create / rename agent | `editor+` |
| Promote (non-commander) | `editor+` |
| Promote to commander | `admin` + approval |
| Retire / restore | `admin` |
| Edit Tony / Agent 0 | **forbidden** (HTTP 423) |
| Grant high-severity approval | `owner` |

---

## 4. Events (Brain Sync + Harness)

Both streams are append-only. The UI subscribes via SSE; reconnects with
last-seen-id. The prototype keeps the last 200 events in memory; production
should retain ≥30 days for audit.

Brain Sync `kind` values: `memory_proposal · confidence_shift · source_of_truth · flag · review`.
Harness `kind` values: `handoff · escalate · flag · approval_request · broadcast`.

Every protected mutation on the server **must** emit at least one Brain Sync
record AND one Harness record (so the audit trail stays joinable).

---

## 5. Permissions catalogue

```
agents:create
agents:rename
agents:retire
agents:promote
agents:promote_commander          // gated by approval
engines:connect
engines:rotate_secret
tickets:create
tickets:close
approvals:grant_low
approvals:grant_medium
approvals:grant_high              // owner-only
brain_sync:write
harness:write
cost:override_budget
```

Tony and Agent 0 carry `protected:true` and are immune from `retire`,
`promote`, `setTier`, and any direct mutation. UI shows a lock chip and
disables the destructive controls.

---

## 6. Component states (for QA)

| Component | States to verify |
|---|---|
| Canvas node | online · idle · degraded · offline · retired · selected · dragged · protected |
| Inspector | Overview · Permissions · Engines · Tickets · Audit · empty (no agent) |
| Add Agent wizard | step 1 of 6 (Identity) → 6 (Review) · validation error · success |
| Engine Connect modal | transport switcher × 7 · endpoint required · scope checkboxes · save · cancel |
| Approval modal | low (auto-grantable) · medium (single-approver) · high (owner-only + reason required) · granted · denied · expired |
| Brain Sync feed | empty · streaming · paused · severity high (red flash) |
| Harness lanes | idle · active route · flagged route |
| Cost panel | ok · warn · crit · over-budget banner |
| Header pills | 0 approvals (muted) · pending (warn) · pending high (err pulse) |

---

## 7. What is mock vs production

| Surface | Today | For production |
|---|---|---|
| `window.AgentRegistry` | In-memory + seeds | Replace with HTTP client; same method names |
| Brain Sync feed | Locally generated | Subscribe to SSE `/api/events?stream=brain_sync` |
| Harness lanes | Locally generated | Subscribe to SSE `/api/events?stream=harness` |
| Cost panel | Random walk seed | Read from existing `cost_ledger` table (todo #170) |
| Approvals | Local timer | Persist in `approvals` table; expire job |
| Add agent wizard | Local create | POST `/api/agents` |
| Engine connect | Local link | POST `/api/agents/:id/connect-engine` + secret vault |
| Promote → commander | Triggers local approval | Server-side approval + audit |
| Drag-to-tier | `setTier` | PATCH `/api/agents/:id` |
| Tony / Agent 0 lock | UI-only | Server **must** also enforce HTTP 423 |

---

## 8. Files in this prototype

```
src/agent-network/
  registry.jsx              ← mock AgentRegistry (replace with HTTP client)
  AgentNetworkCanvas.jsx    ← tier-laned canvas
  AgentInspector.jsx        ← right-side panel
  AgentNetworkModals.jsx    ← Add agent · Connect engine · Approval · Assign ticket · Context menu
  AgentNetworkPage.jsx      ← page shell
  agent-network.css         ← extends styles.css tokens

docs/
  agent-network-spec.md     ← this file
  agent-network-spec.html   ← printable annotated version
```

Wired into:
- `Mission Control.html` (script + stylesheet tags)
- `src/replicas/WorkspaceRail.jsx` (rail entry)
- `src/app.jsx` (canonical page route `gateway`; legacy `agent-network` remains an alias)

---

## 9. Error states

- **Network down** → registry surfaces `status:'offline'`; canvas dims node, inspector shows banner "Last seen <relative>".
- **Engine probe fails** → `engines.test` returns `{ ok:false, reason }`; inspector engine row turns red, tooltip carries reason.
- **Approval expired** → `approvals.status='expired'`; modal shows reason and disables grant.
- **Protected mutation attempted** → server returns 423; UI shows toast "Tony / Agent 0 cannot be modified".
- **Cost over budget** → cost panel banner; harness emits `flag`; brain_sync emits `confidence_shift` for offending agent.

---

## 10. Responsive behavior

- ≥1280px: canvas + 320px inspector + 240px dock (default).
- 1024–1279px: inspector collapses to overlay (toggled from canvas selection).
- ≤1023px: prototype is **not optimized**; show "Open on desktop" banner.

---

## 11. Production cutover checklist

1. Implement §3 routes; mirror the mutation surface of `registry.jsx`.
2. Replace `registry.jsx` with an HTTP-backed equivalent (same exports).
3. Wire SSE for `brain_sync` + `harness` streams; keep the same event shape.
4. Persist approvals with TTL job for `expired` transitions.
5. Add server-side enforcement of Tony / Agent 0 protection (HTTP 423).
6. Add audit-log writes on every mutation (already partial via Brain Sync).
7. Smoke test all 12 component states from §6 against live data.
