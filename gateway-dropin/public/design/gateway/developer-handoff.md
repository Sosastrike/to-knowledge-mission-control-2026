# Gateway — Developer Handoff

**Sprint:** Gateway architecture (CData-shape, Kong-discipline, n8n-clarity)
**Status:** Design complete · packaged for developer handoff
**Owner:** Luis · **Designer:** Claude Design
**Date accepted:** 2026-05-05

---

## 0. Scope of this handoff

This document packages the **design output** of the Gateway sprint for engineering execution. It is **design-only**.

**The designer did NOT:**
- Run any migration SQL (Phase 0a or otherwise).
- Change any production code.
- Modify any backend routes.
- Touch any services.
- Modify `.env` or any credentials.
- Install any package.
- Delete any file from the running system.

Migrations, route changes, service edits, env changes, installs, and deletions are **developer-owned**. The design package below specifies the target shape; engineering decides when and how to land it.

---

## 1. Recommended primary design — **Nucleus**

The **Nucleus** treatment in `design/gateway/Gateway Overview.html` is the **recommended primary direction**.

Nucleus shows the Gateway Core as a living center: a Dispatcher engine sits inside the core, orbital mini-agent satellites circle it, live request beams animate from input nodes into the core, and an engine ledger tracks token + USD spend per model in real time.

### Why Nucleus is primary
- It makes the central thesis visible: **everything routes through one governed nucleus**.
- It surfaces the **Dispatcher** — the budget-aware fan-out planner that splits big tasks into small ones and routes by remaining tokens, capability, and latency.
- It exposes **token + cost telemetry** as a first-class surface, not a sub-tab.
- It shows **mini-agent worker satellites** with their own thin token allowances — the right metaphor for cost-aware fan-out.

### Alternate treatments (reference only)
The other three hero variants in the Tweaks panel are **alternates**, not co-primaries:
- **Kong** — emphasis on policy strip + API-gateway framing.
- **Balanced** — softest visual; good for screenshots / docs.
- **n8n** — flow-canvas vocabulary with node ports.

Engineering should build Nucleus first. Kong/Balanced/n8n stay in the file as Tweak toggles for stakeholder review and future skinning, but are **not** required for v1 ship.

---

## 2. Architectural commitments (locked)

These are the design decisions accepted in the sprint. They are inputs to engineering, not subjects to revisit.

| # | Commitment |
|---|---|
| 1 | **Gateway is the center.** Not Hermes, not Agent Zero. Every owner intent passes through the Gateway. |
| 2 | **Agent Zero is Commander.** Sole commander. All intents land here. Inherits Tony memory read-only. |
| 3 | **Hermes is Lieutenant** — skill + workflow builder. Read-biased. Cannot delegate further. |
| 4 | **Mini-agents are worker satellites.** Sandboxed runners with thin token allowances per task. |
| 5 | **OpenClaw+ is the runtime / skills engine.** Hosts shared skills, adapters, reports, governance. |
| 6 | **OpenCloud / Build-Wiki / Farmer are worker/runtime systems.** Not deletion targets. Represented as orange (runtime) status. |
| 7 | **Brain systems are the knowledge layer.** Obsidian, MemPalace, Graphify, Brain Sync, Build-Wiki — all behind Gateway. |
| 8 | **Bridge / MCP / tools / models / integrations are routed Gateway nodes** — peers, not separate surfaces. |
| 9 | **Tony is retired / archive only.** His memory is inherited read-only by Agent Zero. No live Tony loop in the Gateway view. |

---

## 3. State / status grammar (locked)

Engineering must use these exact statuses. Do not invent new ones; do not collapse them.

| Status | Color token | Meaning |
|---|---|---|
| `green`  | `--st-green`  | Connected. Live, healthy, all enabled flags pass. |
| `yellow` | `--st-yellow` | Gated. Bridge Session required, approval pending, or RBAC challenge. |
| `blue`   | `--st-blue`   | Read-only. Discovery + read OK. Writes refused. |
| `red`    | `--st-red`    | Blocked. Credential failure, policy denial, or upstream down. |
| `gray`   | `--st-gray`   | Not configured. No credentials/config registered yet. |
| `purple` | `--st-purple` | Agent / commander layer marker. Status grammar applies on top. |
| `orange` | `--st-orange` | Runtime / worker engine marker. Status grammar applies on top. |

Defined once in `design/gateway/shared/tokens.css`. Every Gateway page reads from this file.

### Specific node states
- **Hermes is yellow / gated** until `hermes_called:true` is proven (live chat heartbeat). Engineering must not promote Hermes to green without that flag.
- **Fork 2 / SMB is blocked (red).** SMB connector unavailable / SMB mount not proven. Do not surface as gray ("not configured") — it is explicitly blocked with a known fix path.
- **NVIDIA NIM is gray.** Reserved slot, no API key registered. Do not auto-create a green path.

---

## 4. Files in this design package

All files live under `design/gateway/`. Engineering reads from these; nothing here is production code.

```
design/gateway/
├── 00-design-brief.md              Architecture principles + CData influences
├── index.html                      Sprint index (entry point)
│
├── Gateway Overview.html           ★ Primary canvas — Nucleus default
├── Gateway Overview v1.html        Pre-Nucleus snapshot (kept for diff)
├── Gateway Routes.html             9-step execution gate
├── Gateway Registry.html           All registered nodes, filterable
├── Gateway Node Detail.html        Drill-down per node
├── Gateway Policies.html           Bridge Session + policy catalog
├── Gateway Health.html             Live status across nodes
├── Gateway Mobile Tablet.html      Phone Bridge-approve, tablet collapse
│
├── Agent Zero Commander.html       Commander surface
├── Hermes Lieutenant.html          Lieutenant surface (yellow / gated)
├── OpenCloud Workers.html          Parent → child workers
├── OpenClaw+ Skills.html           Skill registry
├── Brain Systems.html              Brain layer (Tony R/O)
├── Delivery Connectors.html        Mail / voice / files / web
│
└── shared/
    ├── tokens.css                  ★ Locked design tokens (status, type, spacing)
    ├── node-card.css               Node card component
    ├── topbar.html                 Header partial
    ├── render.js                   Render primitives (vanilla JS)
    └── gateway-data.js             ★ Mock data — engines, mini-agents,
                                     dispatcher rules, request stream,
                                     token ledger, edges, audit
```

★ = files engineering will reference most often during integration.

---

## 5. Integration target — Mission Control

The Gateway is **not** a standalone app. It integrates into the existing Mission Control React shell at `Mission Control.html` → `src/shell.jsx`.

### Recommended integration shape (engineering-owned)

1. New top-level tab `Gateway` in `src/shell.jsx`, peer to Dashboard / Agent Network / Brain Sync.
2. Port `design/gateway/*.html` into `src/gateway/*.jsx`:
   - `GatewayOverview.jsx` (Nucleus canvas)
   - `GatewayRegistry.jsx`
   - `GatewayNodeDetail.jsx`
   - `GatewayRoutes.jsx`
   - `GatewayPolicies.jsx`
   - `GatewayHealth.jsx`
   - `AgentZeroCommander.jsx`
   - `HermesLieutenant.jsx`
3. `shared/tokens.css` rules already match Mission Control's `styles.css` status grammar — the same `--st-*` variables exist. No new CSS framework is introduced.
4. Replace `shared/gateway-data.js` (mock) with live calls to `/api/gateway/*` endpoints. Endpoints are **engineering-owned** to design and ship.

### Endpoints implied by the design (engineering decides shape + names)

The design assumes these reads exist; specific paths and contracts are developer-owned:

- **Nodes registry** — list every routable node with status, R/W/X, bridge flag, summary, last success, blocked reason.
- **Engines ledger** — list every model engine with `remaining_tokens`, `daily_budget_tokens`, `spent_usd`, `daily_budget_usd`, `p50_ms`, `caps[]`, `status`.
- **Mini-agents roll** — list each mini-agent with `load`, `allowance`, `used`, `status`.
- **Dispatcher decisions** — recent N decisions with `task`, `picked`, `reason`, `ts`.
- **Request stream** — SSE or WebSocket of `{from, asks, op, result, engine, bridge}` events for live beam animation.
- **Bridge sessions** — current owner Bridge Session(s).
- **Audit** — gateway audit append-only feed (already exists in some form per `OVERNIGHT_SUMMARY.md`).

---

## 6. Phase 0a migrations — **developer-owned**

The design references additive tables in `00-design-brief.md` (e.g. `gateway_nodes`, `gateway_audit`, `bridge_sessions`, etc.). These are **architectural targets**, not signed-off SQL.

**Design does NOT own:**
- Writing the migration SQL.
- Choosing migration ordering.
- Picking SQLite vs. Postgres specifics.
- Coordinating downtime.
- Backfilling existing rows.

**Engineering owns Phase 0a end-to-end.** The design package gives shape (column intent, R/W/X flags, status grammar); engineering writes, reviews, and runs migrations behind their normal process.

The designer **did not run** Phase 0a SQL during this sprint. No schema changed.

---

## 7. What's intentionally not in this sprint

- Backend implementation of the Dispatcher itself (the budget-aware fan-out planner).
- Real `/api/gateway/*` endpoints.
- SSE / WebSocket transport for the live request stream.
- The token-budget governor that sheds load when an engine hits 75%+.
- Mission Control React port of the Gateway pages.
- Auth / session changes.

These are the next sprints. The design above gives engineering a fixed target to build toward.

---

## 8. Acceptance checklist for engineering

When engineering picks this up, the design is "delivered correctly" if:

- [ ] Nucleus renders as the default `Gateway Overview` view.
- [ ] Status grammar matches the table in §3 exactly.
- [ ] Hermes is yellow until `hermes_called:true`.
- [ ] Fork 2 / SMB shows red with a fix path, not gray.
- [ ] Tony memory access is marked read-only and provenance-attributed.
- [ ] Gateway Core is the visual + logical center; Agent Zero and Hermes orbit it.
- [ ] OpenCloud / Build-Wiki / Farmer render as orange (runtime), not as deletion targets.
- [ ] Engine ledger surfaces token + USD spend per engine, with budget meters.
- [ ] Mini-agent strip shows per-worker load and token allowance.
- [ ] Dispatcher decision feed shows the last N routing picks with reasons.

---

## 9. Sign-off

- **Design:** complete and accepted.
- **Migrations:** not run. Developer-owned.
- **Production code:** not changed. Developer-owned.
- **Backend routes:** not changed. Developer-owned.
- **Services:** not touched. Developer-owned.
- **`.env`:** not touched. Developer-owned.
- **Installs:** none. Developer-owned.
- **Deletions:** none.

Package is ready for developer handoff.

---

## Appendix A. Agent Hub — engineering scope (Codex implementation brief)

Added after design acceptance. Source design files:
- `design/gateway/Agent Hub.html`
- `design/gateway/Paperclip.html`
- `design/gateway/shared/agent-data.js` (mock; replace with real registry data)

### Goal
Make Agent Hub visible inside production Mission Control under:
**Mission Control → Gateway → Agent Hub / Control Center**

### Engineering tasks
1. Add Agent Hub under Mission Control → Gateway.
2. Add `/gateway/agent-hub` route.
3. Add `/gateway/agent-hub/paperclip` route.
4. Replace mock `agent-data.js` with real Gateway registry/status data. Mock data is **not** live data.
5. Add status endpoints for Agent Zero, Hermes, Pi, SpaceAgent, Paperclip.
6. Add localhost/Tailnet URL fields per agent record.
7. Add safe “Open local UI” buttons (new-tab default; iframe only where proven).
8. Add iframe/proxy only where safe — same-origin or Gateway-proxied path with `embed_safe: true`.
9. Keep direct auth for each agent; do **not** bypass each agent’s login.
10. Show blocked / gated status honestly per Production Truth below.

### Required API routes
- `GET /api/gateway/agent-hub/status`
- `GET /api/gateway/agent-hub/agents`
- `GET /api/gateway/agent-hub/agents/:id`
- `GET /api/gateway/agent-hub/agents/:id/health`
- `GET /api/gateway/agent-hub/agents/:id/routes`
- `GET /api/gateway/agent-hub/agents/:id/audit`

### Agent roster (5)
1. **Paperclip** — Workforce Control Plane (sits before OpenClaw+)
2. **Agent Zero** — Commander
3. **Hermes** — Lieutenant / Skill + Workflow Builder
4. **SpaceAgent** — Browser / Firecrawl / YouTube Research Specialist
5. **Pi-mono** — Dispatcher / Route Optimizer Candidate

### Supporting runtime systems (not main agent slides)
- Gateway · OpenClaw+ · OpenCloud / Build-Wiki / Farmer · Brain systems · Bridge/MCP · Models/tools/integrations

### Production truth (status grammar at deploy time)
- **Agent Zero** — commander track, partial GO.
- **Hermes** — yellow/gated until `hermes_called:true` is proven.
- **Pi-mono** — candidate/pending until installed and live.
- **SpaceAgent** — pending until installed and live.
- **Paperclip** — pending until localhost/Tailnet UI is proven.
- **OpenCloud / Fork 2 SMB** — Fork 2 red/blocked.
- **Build-Wiki Run Now** — remains scoped to `opencloud-docs-farmer.service` only.

### Hard rules (carry-over from design contract)
- Do **not** run migrations.
- Do **not** change `.env`, secrets, or auth files.
- Do **not** bypass each agent’s own authentication.
- Do **not** expose any local UI publicly.
- Dangerous actions (stop, restart, redeploy, rollback, bridge open, external writes, connector execution) must be Bridge-Session-gated server-side, not just visually.

### Hard rules — absolute (no exceptions)
- No secrets printed in logs, UI, or responses.
- No `.env` changes.
- No auth weakening of any kind.
- No public exposure of local UIs.
- Do not bypass each agent’s own auth.
- No Zapier writes.
- No HeyGen generation.
- No SMB mount.
- No broad connector execution.
- No OpenCloud deletion.
- No fake live status — if not proven, show gated/blocked honestly.
- No raw local paths exposed in owner UI.

### Phased rollout plan (engineering, 18 phases)
1. **Baseline** — check Mission Control branch, HEAD, dirty files, tests, production service status.
2. **Import design safely** — confirm Agent Hub design files exist and are tracked or copied safely.
3. **Add route shell** — `/gateway/agent-hub` and `/gateway/agent-hub/paperclip` pages.
4. **Add API shell** — read-only status/registry APIs for Agent Hub.
5. **Real agent registry** — map Agent Zero, Hermes, Pi, SpaceAgent, Paperclip to real status objects.
6. **Localhost/Tailnet fields** — `local_ui_url`, `tailnet_url`, `ui_mode`, `iframe_allowed`, `auth_required`.
7. **Agent Zero panel** — use known Agent Zero UI + health; show commander role.
8. **Hermes panel** — use `hermes-gateway.service` + MC status; yellow/gated until `hermes_called:true`.
9. **Pi panel** — pending/candidate unless installed/proven.
10. **SpaceAgent panel** — pending unless installed/proven; Firecrawl/browser/YouTube specialist role.
11. **Paperclip panel** — pending until sandbox install and localhost/Tailnet URL are proven.
12. **Gateway lane** — real registry data if available; otherwise mark mock/pending honestly.
13. **Bridge Session modal** — read-only visual first; real execution later.
14. **Security/auth** — protected routes must return 401/403 unauthenticated.
15. **Tests** — typecheck, build, tests, route smoke.
16. **Production restart** — restart `mission-control.service` with approved admin auth only.
17. **Browser smoke** — owner sees Gateway → Agent Hub live in Mission Control.
18. **Report** — Agent Hub production deployment report with screenshots, routes, status, blockers.
