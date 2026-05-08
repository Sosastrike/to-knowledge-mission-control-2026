# Mission Control + Gateway — Full Package (v3)

**Date:** 2026-05-08
**Status:** Design-only. Nothing in production touched.

---

## ⚠️ Important — read first

The Gateway / Agent Hub design is **ADDITIVE**.
It does **NOT** replace Mission Control.
Nothing in the existing Mission Control gets removed, deleted, or rewritten.

When the owner opens `design/gateway/Agent Hub.html` by itself,
the rest of Mission Control is not visible — that is expected.
That file is **one slide**. It is meant to be **mounted inside** the
existing Mission Control shell as a new tab under Gateway.

---

## What stays exactly as it is (do NOT remove)

Everything in `Mission Control.html` + `src/` keeps working:

- Dashboard
- **Brain Sync** (`src/replicas/BrainSyncPage.jsx`)
- MiroFish
- Meetings Hub
- Channels
- Alerts
- Email Profiles
- Agent Network (existing prototype)
- Ops Intel
- Web Ops
- Schedule
- Settings · Credentials · Governance · Skills
- Search + Notifications drawer
- Login

None of those files were modified by the design sprint.

---

## What is new (additive)

Under `design/gateway/`:

- `Gateway Overview.html` — Nucleus primary
- `Gateway Routes.html`, `Gateway Registry.html`, `Gateway Policies.html`,
  `Gateway Health.html`, `Gateway Node Detail.html`, `Gateway Mobile Tablet.html`
- `Agent Zero Commander.html`, `Hermes Lieutenant.html`
- `OpenClaw+ Skills.html`, `OpenCloud Workers.html`
- `Brain Systems.html`, `Delivery Connectors.html`
- `Dispatcher.html`, `Token Governor.html`, `Bridge Session Flow.html`
- **`Agent Hub.html`** ← unified 5-agent control center
- **`Paperclip.html`** ← Workforce Control Plane drill-down
- `Mission Control + Gateway.html` — integration mockup
- `shared/agent-data.js`, `shared/gateway-data.js`,
  `shared/tokens.css`, `shared/node-card.css`, `shared/render.js`
- `developer-handoff.md` — full engineering brief, hard rules, 18-phase plan
- `components.md`, `open-questions.md`, `00-design-brief.md`

---

## How the integration should work

Add a **Gateway** entry to the Mission Control left rail (same pattern
as Brain Sync / Agent Network / Meetings). Inside Gateway, expose tabs:

```
Mission Control
├── Dashboard                 (existing)
├── Brain Sync                (existing)
├── Agent Network             (existing — keep)
├── MiroFish                  (existing)
├── Meetings Hub              (existing)
├── Channels                  (existing)
├── Alerts                    (existing)
├── Schedule                  (existing)
├── Settings                  (existing)
└── Gateway                   (NEW)
    ├── Overview              → Gateway Overview.html (Nucleus)
    ├── Routes                → Gateway Routes.html
    ├── Registry              → Gateway Registry.html
    ├── Policies / Bridge     → Gateway Policies.html
    ├── Health                → Gateway Health.html
    ├── Dispatcher            → Dispatcher.html
    ├── Token Governor        → Token Governor.html
    └── Agent Hub             → Agent Hub.html
        └── Paperclip         → Paperclip.html
```

The owner reaches Agent Hub via:
**Mission Control → Gateway → Agent Hub / Control Center**

---

## Implementation checklist (summary — full version in `design/gateway/developer-handoff.md`)

1. Add `/gateway/agent-hub` and `/gateway/agent-hub/paperclip` routes.
2. Add read-only API endpoints:
   - `GET /api/gateway/agent-hub/status`
   - `GET /api/gateway/agent-hub/agents`
   - `GET /api/gateway/agent-hub/agents/:id`
   - `GET /api/gateway/agent-hub/agents/:id/health`
   - `GET /api/gateway/agent-hub/agents/:id/routes`
   - `GET /api/gateway/agent-hub/agents/:id/audit`
3. Replace mock `shared/agent-data.js` with real Gateway registry data.
4. Add per-agent fields: `local_ui_url`, `tailnet_url`, `ui_mode`,
   `iframe_allowed`, `auth_required`.
5. Show honest status — gray until proven, yellow when gated, green when live.
6. Bridge Session modal: read-only visual first, real execution later.
7. Protected routes return 401/403 unauthenticated.

---

## Production truth at deploy time

- **Agent Zero** — commander, partial GO.
- **Hermes** — yellow/gated until `hermes_called:true` proven.
- **Pi-mono** — pending until installed/proven.
- **SpaceAgent** — pending until installed/proven.
- **Paperclip** — pending until localhost/Tailnet UI proven.
- **Playwright MCP** (under SpaceAgent → Browser Automation) — gray until installed; yellow/gated for interactive actions until Bridge Session is open.
- **OpenCloud / Fork 2 SMB** — Fork 2 red/blocked.
- **Build-Wiki Run Now** — scoped to `opencloud-docs-farmer.service` only.

---

## Hard rules (no exceptions)

- No secrets printed.
- No `.env` changes.
- No auth weakening.
- No public exposure of local UIs.
- Do not bypass each agent's own auth.
- No Zapier writes · No HeyGen generation · No SMB mount.
- No broad connector execution · No OpenCloud deletion.
- No fake live status — if not proven, show gated/blocked honestly.
- No raw local paths in owner UI.
- Dangerous actions Bridge-Session-gated server-side, not just visually.

---

## Folder layout in this package

```
Mission-Control-Gateway-FULL-v3/
├── DEVELOPER-INTEGRATION-NOTE.md  ← you are here
├── Mission Control.html           (existing — unchanged)
├── Login.html                     (existing — unchanged)
├── styles.css                     (existing — unchanged)
├── src/                           (existing — unchanged)
└── design/gateway/                (NEW — design files for Gateway + Agent Hub)
    ├── developer-handoff.md       ← full engineering brief
    ├── components.md
    ├── open-questions.md
    ├── 00-design-brief.md
    └── *.html + shared/
```

Open `Mission Control.html` to see the existing system.
Open `design/gateway/index.html` to browse the new Gateway design files.
