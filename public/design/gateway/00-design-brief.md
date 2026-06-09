# Gateway Design Brief
**Project:** To Knowledge Mission Control — Gateway
**Date:** 2026-05-04
**Author:** Claude Design (24-hour autonomous sprint)
**Status:** Design complete. Hand off to development.

---

## 1. The sentence

> Everything enters the Gateway. The Gateway applies policy, checks capability, routes the request to Agent Zero / Hermes / tools / models / skills / APIs, and returns the result with audit and status.

This single sentence is the entire architecture. Every screen in this folder makes that sentence visible.

---

## 2. The pivot

We are no longer designing an *Agent Network* org chart. We are designing an **AI/API Gateway**.

| Old worldview (deprecated)        | New worldview (locked)                                        |
|-----------------------------------|----------------------------------------------------------------|
| Tony in the center                | **Gateway Core in the center**                                 |
| Org-chart hierarchy               | **Operational gateway** — routing, policy, audit               |
| "Who reports to whom"             | **"What can route through what, with which permission"**       |
| Agent Network                     | **Gateway**                                                    |
| Tony as active conductor          | **Tony retired, archive only**                                 |
| Hermes implied                    | **Hermes explicit lieutenant — gated until live chat proven**  |
| OpenCloud as vague                | **OpenCloud parent + named children, runtime engine**          |
| Fork 2 / SMB ambiguous            | **Fork 2 / SMB explicitly red/blocked**                        |

---

## 3. Locked structure

```
Owner ─▶ Gateway ─▶ Agent Zero ─▶ Hermes / OpenClaw+ / Brain / MCP / APIs / Tools / Skills / Models / OpenCloud
```

- **Owner** issues commands.
- **Gateway** is the single layer every request crosses.
- **Agent Zero** is **Commander** (purple/active).
- **Hermes** is **Lieutenant** (yellow/gated — live chat unproven).
- **Tony** is retired/archive only — never active commander, never on the canvas.
- **OpenCloud** is a runtime engine (orange) with named children: Build-Wiki, Farmer Sync, Skills, Tools, Agent Runtime (future), Fork 1, Fork 2 (red/blocked).
- **OpenClaw+** is the shared skills / adapters / reports / governance runtime (orange).
- **Brain systems** (Obsidian, MemPalace, Graphify, Brain Sync, Build-Wiki) form the top layer.
- **Models** (OpenRouter, OpenAI, Claude, Ollama, NVIDIA, Gemini, Groq) form the bottom layer.

---

## 4. Visual influences

- **Kong AI Gateway** — clean routing, policy, observability, control. Single layer with explicit policy.
- **n8n** — visual node canvas, simple connected blocks, easy integrations, drag-able feel.
- **CData Connect AI** — governed live data layer, **discovery first, execution second**, existing-permission enforcement, full audit, no fake access.

The **main** Gateway design balances all three. Two alternate hero treatments are exposed as Tweaks:
- **Alternate 1:** more Kong-style — emphasizes routing lanes, policy chips, observability bars.
- **Alternate 2:** more n8n-style — emphasizes the canvas, draggable blocks, edge animations.

The final direction is **one design**, not three products.

---

## 5. Status grammar (LOCKED)

| Color   | Meaning                                                        |
|---------|----------------------------------------------------------------|
| Green   | Connected — live, healthy, all enabled flags pass              |
| Yellow  | Gated — owner approval, governed execution, RBAC challenge |
| Blue    | Read-only                                                      |
| Red     | Blocked                                                        |
| Gray    | Standby — registered but idle, no recent heartbeat, or waiting for runtime events |
| Purple  | Agent / commander layer marker (status grammar still applies)  |
| Orange  | Runtime / worker engine marker (status grammar still applies)  |

A node renders the **lowest** state across `connected / configured / read_enabled / write_enabled / execution_enabled / requires_bridge_session`.

Every node card surfaces:
- name, type, role
- status dot (color)
- **R / W / X** pills (read / write / execute — filled if enabled, hollow if not)
- 🔐 lock badge if `requires_bridge_session=1`
- last-success relative timestamp
- one-line owner-visible summary
- blocker reason (if any)

---

## 6. Discovery contract (LOCKED)

Default discovery TTL: **5 minutes**.
- Critical health/status: **30–60s**
- Expensive scans (full MCP inventory, large connector scans): **10–15min**
- Owner "Refresh now" bypasses cache.
- Every node surfaces `last_checked_at` and `cache_age`.
- Stale data is **labeled stale**, never rendered as live.

Every action follows:
1. Authn → 2. Discovery freshness → 3. Node status → 4. Operation flag (R/W/X) → 5. RBAC (existing-permission) → 6. Bridge Session (if `requires_bridge_session=1` and action ∈ {write, execute}) → 7. Audit pre-write → 8. Execute → 9. Audit post-write.

Any failure short-circuits with an explicit `result_code` and `blocked_reason`. Never a silent stub. Never a fake success.

---

## 7. Bridge Session model

- Default: **30 minutes**
- Owner can extend: **2h / 8h / 12h** — explicit, audited request only
- Required for: external writes (delivery channels, uploads, Build-Wiki Run Now, AgentMail send, Drive upload, Zapier write, HeyGen, Brain writes)
- Expired session immediately re-renders affected nodes yellow
- Bridge Session pill is the **single most visible UI element** in the Gateway header

---

## 8. Pages delivered

| #  | File                            | Purpose                                                                |
|----|---------------------------------|------------------------------------------------------------------------|
| 1  | `index.html`                    | Sprint index — links to every page                                     |
| 2  | `Gateway Overview.html`         | Full canvas — Kong × n8n × CData. Main + 2 alternate treatments (Tweaks) |
| 3  | `Gateway Node Detail.html`      | Click any node → full detail panel                                     |
| 4  | `Gateway Routes.html`           | Owner → Gateway → Agent Zero → tool flow                              |
| 5  | `Gateway Registry.html`         | Searchable table of every node                                         |
| 6  | `Gateway Policies.html`         | Bridge Session, approvals, R/W/X policies                              |
| 7  | `Gateway Health.html`           | Service status, last checks, degraded nodes                            |
| 8  | `Agent Zero Commander.html`     | What Agent Zero can see, command, delegate, execute                    |
| 9  | `Hermes Lieutenant.html`        | Skill design, workflow design, gated state                             |
| 10 | `OpenCloud Workers.html`        | Parent + Build-Wiki, Farmer, Forks; Fork 2/SMB red                     |
| 11 | `OpenClaw+ Skills.html`         | Shared skills runtime                                                  |
| 12 | `Brain Systems.html`            | Obsidian, MemPalace, Graphify, Brain Sync, Build-Wiki                  |
| 13 | `Delivery Connectors.html`      | AgentMail, Telegram, Drive, OneDrive, Zapier, HeyGen, Firecrawl        |
| 14 | `node-card-spec.html`           | Component spec — every state of the node card                          |
| 15 | `color-status-legend.html`      | Locked color/status legend                                             |
| 16 | `mobile-tablet.html`            | Mobile/tablet behavior                                                 |
| 17 | `developer-handoff.md`          | Implementation notes for development                                   |
| 18 | `open-questions.md`             | Decisions still pending                                                |

---

## 9. What this design does NOT do

- **No backend calls.** All pages are hi-fi clickable mocks driven by `shared/gateway-data.js`.
- **No production code touched.** `server/`, `runtime/`, `proof/`, `.env` untouched.
- **No deletions.** Tony, OpenCloud, Build-Wiki, Farmer all preserved.
- **No new secrets.** No real credentials referenced anywhere.
- **No claims of live access.** Anything unproven (Hermes live chat, Fork 2 SMB) renders gated/blocked with explicit reason.

---

## 10. What dev should do next

See `developer-handoff.md` for the phased implementation map:
- Phase 0 — Migration + seed (additive, non-destructive)
- Phase 1 — Discovery surface (read-only)
- Phase 2 — Read execution
- Phase 3 — Write/execute + Bridge Session integration
- Phase 4 — Visual rebuild (fork `AgentNetworkCanvas.jsx` → `GatewayCanvas.jsx`)
- Phase 5 — Agent Zero / Hermes prompt + behavior alignment
- Phase 6 — OpenCloud worker registration

Each phase is independently shippable, with proof scripts (`proof/test/26–40-*.sh`).

---

## 11. Confidence statement

This design is grounded in:
- The locked CData architecture report (`runtime/cdata-gateway-architecture-research-report.md`)
- The five owner decisions (5-min TTL, 30-min Bridge Session, OpenCloud parent+children, hybrid credential model, Tony behind admin flag)
- The locked structure pivot (Gateway center, Agent Zero commander, Hermes lieutenant gated, Tony retired)
- The locked status grammar (green/yellow/blue/red/gray + purple/orange markers)

Nothing in this folder is speculative. Every node, edge, policy, and audit row maps to a real entity in the project today, with its current honest status reflected.
