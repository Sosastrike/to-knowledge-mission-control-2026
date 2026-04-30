# MiroFish — Status Report

**Module:** Prediction & Simulation Lab
**Sibling of:** Brain Sync
**Owner agent:** Agent 0 (locked — sole runner)
**Backend repo:** `github.com/Sosastrike/To-Knowledge-MiroFish` — **NOT installed**

---

## 1. Exact files changed (this phase)

| File | Change |
|---|---|
| `src/replicas/MiroFishPage.jsx` | **NEW** — full page component (~830 lines): header strip, simulation console with stage track, live simulation map (canvas graph), live event feed (SSE preview), new-job form, data-sources table, prediction output card, reports history, control & safety panel, empty/install-pending state, error/degraded state |
| `src/replicas/mirofish.css` | already present (~810 lines, 27 KB) — `.mf-` prefix, inherits brain-sync tokens |
| `src/replicas/WorkspaceRail.jsx` | added `{ id:'mirofish', label:'MiroFish', icon:'Sparkle' }` between Brain sync and Email & SMTP |
| `src/app.jsx` | added `else if (p === 'mirofish') { setPage('mirofish'); }` route; added `{page === 'mirofish' && <MiroFishPage/>}` render branch |
| `Mission Control.html` | added `<link rel="stylesheet" href="src/replicas/mirofish.css?v=1"/>` and `<script type="text/babel" src="src/replicas/MiroFishPage.jsx"></script>` |
| `src/icons.jsx` | added `AlertCircle`, `Network`, `Save` glyphs (used by MiroFish surfaces) |

No other files were touched.

---

## 2. Exact route/path for MiroFish

- **In-app route key:** `mirofish`
- **Programmatic open:** `window.appGoTo('mirofish')`
- **User path:** Mission Control → workspace rail → **MiroFish** (between "Brain sync" and "Email & SMTP")
- **File entry point:** `Mission Control.html` → page state `mirofish` → renders `<MiroFishPage/>` from `src/replicas/MiroFishPage.jsx`

There is no separate URL/HTML — MiroFish is a page within the Mission Control SPA.

---

## 3. What is purely UI right now (no backend)

Every value on the page is a client-side mock. Nothing reads from a real service.

**Mocked / simulated:**
- Header KPIs (active jobs, last success, cost today, model, health)
- Connected-systems chip strip (Agent 0, LightRAG, Claude-Mem, Tools, n8n, OpenRouter, Pac-Man, Governance)
- Simulation console (job `mf-sim-2041`, stage track, progress %, elapsed time, "Agent 0 is calculating" indicator)
- Confidence ring + sparkline — drift via `Math.random()` on a 1.4 s interval
- Cost counter — increments by `Math.random() * 0.0035` on the same interval
- Live simulation map — canvas with 10 nodes + 11 edges, animated active-path pulse, hover tooltips, legend
- Live event feed — seeded events + 4 generators on a 3.2 s interval
- New simulation form — title/question/seed/horizon/rounds/cost/priority/approval (state held in component, **not posted**)
- Data sources table (6 rows) — names, trust, confidence contribution
- Prediction output card — recommendation, supporting evidence, risks/assumptions
- Reports history (5 rows) — IDs, confidence, cost, status pills
- Control & safety panel — pause/cancel/cost-limit/rounds/approval/lock/external-data toggles
- State-preview tabs in the install banner (Live · Not installed · Error)

**Honest disabled buttons** (each carries an explanatory tooltip):
- Start simulation, Save as draft (form)
- Pause, Cancel (console)
- View / PDF / Re-run (reports)
- Export JSON, Compare (reports header)
- Pan / Zoom in / Zoom out / Fit-to-view (map toolbar)
- Retry / View logs (error state)
- Export report (prediction side)
- Pause / Cancel / Clear queue / View error logs (control panel)

**Honest signals everywhere:**
- Permanent install banner at top: "MiroFish backend not installed yet — preview interface only"
- "demo · simulated" pills on every streaming surface
- Agent 0 runner field is a locked field with lock glyph, not a select

---

## 4. Backend install/wiring still required

**The repo has not been cloned, configured, or run yet.**

Five endpoints are documented in tooltips and the install banner — none exist:

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/mirofish/status` | service health + active job count |
| `GET`  | `/api/mirofish/jobs` | list jobs / queue |
| `POST` | `/api/mirofish/jobs` | create new simulation (form submit target) |
| `GET`  | `/api/mirofish/jobs/:id/events` | SSE — feed + stage transitions + confidence/cost ticks |
| `GET`  | `/api/mirofish/reports/:id` | finalised report payload |
| `POST` | `/api/mirofish/jobs/:id/cancel` | hard cancel (audit-logged) |

**Planned services per the install banner:**
- `:7400` api
- `:7401` sim-engine
- `:7402` graph

**Setup checklist (shown in the empty state):**
- ☐ Clone `github.com/Sosastrike/To-Knowledge-MiroFish`
- ☐ Configure `.env` (model keys via OpenRouter only — same policy as Mission Control)
- ☐ Index sources (LightRAG corpus mount)
- ☐ Boot Agent 0 supervisor (must be Agent 0 — Tony is requester/viewer only)

**Still needed beyond the repo install:**
- RBAC: same session-cookie + `requireRole` guard pattern Mission Control uses; only Agent 0 can `POST /jobs`, manager+ can read
- Audit-event emissions for: job start, cancel, cost-limit hit, error, report ready (severity per existing audit table)
- Cost ledger integration so the "Cost today" tile reads the real workspace ledger
- LightRAG indexer connection (the sources table currently shows demo file names)
- Tie-in to existing Pac-Man heartbeat for the Health pill
- An entry in `proof/test/` (e.g. `25-mirofish-jobs.sh`) covering: create → events stream → report fetch → cancel + the audit-event landings

---

## 5. Next step to make MiroFish operational for real

In order, smallest cut to honest-green:

1. **Clone the backend repo** into the workspace and wire it under `server/routes/mirofish.js` (same pattern as `broadcast.js` / `tickets.js`).
2. **Implement `GET /api/mirofish/status`** first — returns `{ installed, active_jobs, queue_depth, last_success_at, cost_today_cents, health }`. The header strip will switch from demo to real numbers as soon as this lands; the install banner code path checks `installed` and removes itself.
3. **Implement `POST /api/mirofish/jobs`** + queue table (mirror of `agent_tasks`). Form submit becomes live; `Start simulation` button enables.
4. **Implement `GET /api/mirofish/jobs/:id/events` (SSE)**. Replace the client mock generators in `useMfFeed` and `useMfStreams` with EventSource subscriptions keyed off the active job id.
5. **Implement `GET /api/mirofish/reports/:id` + `POST /api/mirofish/jobs/:id/cancel`**. Reports table View/PDF/Re-run + console Cancel button enable.
6. **Add `proof/test/25-mirofish-jobs.sh`** covering the full create → events → report → cancel cycle with audit-event verification, and add it to `proof/test/run-all.sh`.
7. **Flip the install banner to live**: page reads `/api/mirofish/status` once on mount; if `installed === true` the banner hides and the state-preview tabs collapse to a single "Live" indicator. Empty/error states stay reachable through real status responses, not fake tabs.

Until step 2 lands, MiroFish remains exactly what it is today: a labeled preview surface with no fake green and no fake live data.
