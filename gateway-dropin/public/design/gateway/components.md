# Gateway · Component Inventory

**Project:** To-Knowledge Gateway
**Scope:** Every reusable visual unit across the Gateway sprint, with the screens that own it, the data shape it expects, and the states it must support.
**Audience:** Developer building `GatewayCanvas.jsx` and the surrounding screens. Designer iterating on individual components in isolation.
**Status:** Sprint complete. Component inventory locked.

---

## How to read this doc

For each component:

- **What it is** — one sentence of intent.
- **Where it appears** — the screens that mount it (so a change ripples consistently).
- **Anatomy** — the parts you must implement.
- **Props / data** — the shape it consumes. Source of truth is `shared/gateway-data.js` until backend lands.
- **States** — every visual state, including failure and empty.
- **Tokens** — which CSS variables drive it. Source: `shared/tokens.css`.
- **Implementation notes** — gotchas, accessibility, motion.

The status grammar (green / yellow / blue / red / gray + purple / orange markers) and the discovery contract are locked in `00-design-brief.md`. This doc does not redefine them — it only references them.

---

## 1. Node card

The atomic unit of the Gateway. Every registered entity (agent, runtime, brain, channel, model, tool) renders as a Node card.

- **Where it appears**
  Gateway Overview · Gateway Registry · Gateway Node Detail (large variant) · Gateway Routes (compact variant) · Brain Systems · Delivery Connectors · OpenCloud Workers · OpenClaw+ Skills · Hermes Lieutenant · Agent Zero Commander · Mobile/Tablet (stacked variant).

- **Anatomy**
  - Status dot (top-left, 8px)
  - Name + role label
  - Type chip (`agent` · `runtime` · `brain` · `model` · `channel` · `tool` · `skill`)
  - R / W / X capability pills (filled = enabled, hollow = not enabled)
  - 🔒 lock badge if `requires_bridge_session = 1`
  - Last-success relative timestamp (`14s ago` · `2m ago` · `stale 11m`)
  - One-line owner-visible summary
  - Blocker reason chip (only when status ∈ {yellow, red})

- **Props**
  ```ts
  type NodeCardProps = {
    id: string;                 // 'agent_zero', 'hermes', 'build_wiki', ...
    name: string;
    role: 'commander' | 'lieutenant' | 'runtime' | 'brain' | 'channel' | 'model' | 'tool' | 'skill';
    status: 'green' | 'yellow' | 'blue' | 'red' | 'gray';
    marker?: 'purple' | 'orange'; // visual layer hint, not a status
    capabilities: { read: boolean; write: boolean; execute: boolean };
    requiresBridge: boolean;
    lastCheckedAt: string;       // ISO
    lastSuccessAt?: string;      // ISO
    cacheAge: number;            // seconds since last_checked_at
    summary: string;             // one-line owner-visible
    blockedReason?: string;      // present iff status ∈ {yellow, red}
    size?: 'compact' | 'default' | 'large';
  };
  ```

- **States**
  | State | Trigger | Visual |
  |---|---|---|
  | green | all enabled flags pass | green dot, full text |
  | yellow / gated | owner approval, governed execution, or RBAC challenge | yellow dot, guarded lock if writes/execution require policy, blocker reason chip |
  | blue / read-only | discovery clean, no write/execute | blue dot, R filled · W/X hollow |
  | red / blocked | hard block (e.g. Fork 2 / SMB) | red dot, blocker reason chip |
  | gray / standby | registered but idle, no recent heartbeat, or waiting for a runtime event | gray dot, "Standby" label |
  | stale | `cacheAge > ttl` | green/yellow/blue dot dimmed 60%, "stale 11m" pill |
  | hover | pointerenter | border `--line-strong`, slight raise |
  | focus | keyboard | 2px focus ring `--brand-cyan` |
  | dragging | canvas reorder | `cursor: grabbing`, drop shadow |

- **Tokens**
  Status backgrounds: `--st-{green|yellow|blue|red|gray}-bg`
  Status borders: `--st-{...}-bd`
  Status text: `--st-{...}`
  Card surface: `--bg-2` → hover `--bg-3`
  Border: `--line-2` → hover `--line-strong`
  Radius: `--r-3`

- **Implementation notes**
  - Status is **derived**, not stored: render the lowest of `(connected, configured, read_enabled, write_enabled, execution_enabled, requires_bridge_session)`.
  - R / W / X pills are visual only; the actual gate runs at the 9-step pipeline (see brief §6).
  - `compact` variant drops summary + last-success row, keeps name / status dot / R-W-X / 🔒.
  - `large` variant adds a metrics strip (req/min, p95, error %) — used in Node Detail.

---

## 2. Status dot

A single colored disc that signals node state at a glance. Atom under `NodeCard`.

- **Where**
  Everywhere a node is referenced — cards, registry rows, dispatcher pipeline rows, audit timeline, beam endpoints.

- **Sizes**
  `xs` 6px (audit row) · `sm` 8px (card) · `md` 10px (header active session) · `lg` 14px (Node Detail hero).

- **Behavior**
  - Solid fill at full saturation when fresh.
  - Drop to 60% opacity when `cacheAge > ttl`.
  - Pulse animation only on `yellow` (Bridge requested) and `red` (just-failed) — never on green; green should look calm.
  - Pulse uses CSS keyframe `pulse-ring` already defined on Bridge Session Flow.

---

## 3. Capability pills (R / W / X)

Three uppercase letters indicating which operations the node permits.

- **Behavior**
  - Filled background = enabled and proven.
  - Hollow border-only = not enabled (or not yet proven).
  - Yellow filled = bridged in this session.
  - Tooltip on hover names the scope: `read · brain.obsidian.read`, `write · wiki:write (10/window)`, `execute · zapier:exec (per-call)`.

- **Tokens**
  Filled: `--st-green-bg` / `--st-green` text · `--st-yellow-bg` / `--st-yellow` text when bridged.
  Hollow: transparent bg, `--line-3` border, `--t-4` text.

---

## 4. Bridge lock badge

The 🔒 glyph that flags `requires_bridge_session = 1`.

- **Where**
  Node card · Registry row · Dispatcher pipeline rows · Bridge Session Flow header · Telegram preview header.

- **States**
  - Locked, no active proof → outlined lock, `--t-3`.
  - Locked, active proof inherits → filled lock, `--st-yellow`.
  - Locked, just expired → outlined lock + small "expired 0:14 ago" caption, `--st-orange`.

- **Implementation note**
  Always rendered next to the name, not on the status dot. Clicking it on any screen routes to `Bridge Session Flow.html`.

---

## 5. Beam (animated edge)

The flowing line that connects a source node to a target node on the live Nucleus canvas.

- **Where**
  Gateway Overview · Mission Control + Gateway · Hermes Lieutenant (specialist routing).

- **Anatomy**
  - SVG `<path>` with `stroke-dasharray` animation.
  - Color = source node's status color (resolved at draw time, not stored).
  - Endpoints: source dot (16px), target dot (16px).
  - Optional payload chip mid-path (`req_8c41a92f · 412 KB`).

- **States**
  | State | Visual |
  |---|---|
  | active green | solid green stroke, dash flow ~1.2s loop |
  | bridging | yellow stroke, slower flow ~2s, with 🔒 mid-chip |
  | denied | red stroke, single fade-in/out flash, then removed |
  | hover-pause | flow paused, payload chip expanded with route summary |

- **Implementation note**
  Hover-pause is implemented; it tints the beam slightly brighter and freezes the dash offset. Pointer-leave resumes.

---

## 6. Empty state

Shown on Live Nucleus when there is no traffic in the last 60s.

- **Anatomy**
  - Centered icon (faded gateway glyph)
  - Headline: "Quiet line"
  - Sub: "No requests in the last 60 seconds. Ready when the owner is."
  - One subtle tip: "Press G then O on Mission Control to send a sample request."

- **Token**
  Background: `--bg-1`, text: `--t-3`, glyph: `--t-5`.

---

## 7. Dispatcher pipeline row

A row in the 9-step execution gate visualization on `Dispatcher.html`.

- **Anatomy**
  - Step number (01..09)
  - Step name (Authn · Discovery · Status · Op flag · RBAC · Bridge · Audit pre · Execute · Audit post)
  - Status icon (✓ pass · 🔒 prove · ✕ fail · — skipped)
  - Latency (`12 ms`)
  - Result code (`OK` · `BRIDGE_REQUIRED` · `RBAC_DENIED` · `STALE_DISCOVERY` · `BLOCKED`)
  - Expand affordance for failed steps (shows reason)

- **States**
  - All-green run: 9 ✓, total latency in header.
  - Mid-run pause at step 6 (Bridge): row 6 shows 🔒 + "awaiting Telegram tap", subsequent rows greyed.
  - Failed run: failed row red with reason; later rows skipped.

---

## 8. Audit row

A single line in any audit timeline (Bridge Session, Token Governor, Dispatcher trace, Node Detail).

- **Anatomy**
  Timestamp (mono) · Event tag (mono uppercase, color by event class) · What (with optional sub-line for `req_…` or path) · Via (origin: dispatcher, telegram:@user, archivist) · Latency (right-aligned mono).

- **Event classes & colors**
  | Class | Token | Examples |
  |---|---|---|
  | granted | `--st-green` | REQUESTED · GRANTED · APPROVED |
  | used | `--brand-cyan` | USED · PROOF ATTACHED · ROUTED |
  | denied | `--st-red` | DENIED · BLOCKED · RBAC_FAIL |
  | extended | `--st-orange` | EXTENDED · SOFT-CAP HIT · RETRY |
  | expired | `--t-4` | EXPIRED · STALE · IDLE_TIMEOUT |

- **Implementation note**
  Use a CSS `display: contents` row pattern over a 5-column grid so dividers and column widths stay aligned across rows of varying content.

---

## 9. Telegram prompt preview

Faithful mock of the owner-side approval card.

- **Where**
  Bridge Session Flow (side panel) · Gateway Policies (preview).

- **Anatomy**
  - Bot avatar + handle + "just now" timestamp.
  - Message body with bolded scopes / TTL / caller.
  - Two-button row: green Approve · red Deny.
  - Background hex `#17212b` (Telegram dark surface) — kept fixed regardless of app theme.

- **State**
  Static. Not interactive in the mock — clicking the buttons in the preview does nothing.

---

## 10. Active session pill

The header badge that announces "Bridge is open right now."

- **Where**
  Bridge Session Flow header · Gateway Overview header (when active) · Mission Control header (when active).

- **Anatomy**
  - Lock icon block (38px, yellow tint)
  - Label "ACTIVE SESSION" (uppercase, mono, t-4)
  - Session id `bs_4f12 · owner=luis` (mono, yellow)
  - Live timer `MM:SS` (mono, t-1)

- **Behavior**
  - Updates every second from the parent's session state.
  - Switches to orange when `< 5 min` remain.
  - Hidden entirely when no active session — never render an empty pill.

---

## 11. Timer ring

Circular SVG indicating remaining TTL on a Bridge Session.

- **Anatomy**
  - 160×160 SVG. Track circle (`--bg-4`) + arc circle (`--st-yellow`).
  - Stroke arc length = `circumference × (remaining / total)`.
  - Center: big mono `MM:SS` + small "REMAINING" caption.
  - Surrounding meta grid: Granted · Expires · Total TTL · Idle reset.

- **State transitions**
  - `> 5 min`: arc yellow (`--st-yellow`).
  - `≤ 5 min`: arc orange (`--st-orange`), label color flips with it.
  - `≤ 30 s`: arc pulses once per second.

---

## 12. Path-comparison card

Two side-by-side cards explaining what changes when the owner bridges.

- **Where**
  Bridge Session Flow (canvas mid-section).

- **Anatomy**
  - Left: locked / read-only path · blue header · check/dot list of allowed and disallowed surfaces.
  - Right: bridged path · yellow header · same list with previously-disallowed items now ✓.

- **Implementation note**
  Built from the same scope source-of-truth as the Active proof card so divergence is impossible.

---

## 13. Token Governor: budget bar

Horizontal stacked bar showing per-window spend against soft and hard caps.

- **Where**
  Token Governor · Mission Control mini-strip · Gateway Health.

- **Anatomy**
  - Track (`--bg-3`) full width.
  - Filled segment colored by zone: green `< 70%`, orange `70–95%`, red `≥ 95%`.
  - Two tick marks: soft cap + hard cap.
  - Right-aligned: `$2.41 / $3.50` (mono).

- **States**
  Healthy · Soft-cap warning (orange + tooltip) · Hard-cap reached (red + auto-locked badge).

---

## 14. Empty / quiet panel

Used when a panel has nothing to show right now (no recent sessions, no pending bridges, no active beams).

- **Anatomy**
  - Subtle border-dashed surface (`--line-2` dashed).
  - 24×24 muted glyph centered.
  - One-line t-3 caption.
  - Optional one-tap action (e.g. "Open registry").

- **Rule**
  Never substitute fake placeholder data. Empty panels say "empty," not "demo content."

---

## 15. Crumbs row

Page-top breadcrumb strip on every secondary screen.

- **Anatomy**
  Section root link (e.g. Gateway design) · ›  · parent screen (e.g. Nucleus) · › · current page · spacer · monospaced route on far right (`/gateway/bridge`).

- **Tokens**
  Background `--bg-1`, separators `--t-5`, here-segment `--t-1`.

- **Implementation note**
  Every screen exposes its own canonical route in the right-most slot — this is the link a developer copies into a routing table.

---

## 16. Section header (`.sec-head`)

The 12px uppercase tracked label that introduces a canvas section, plus a mono meta string and a thin filler line.

- **Used by**
  Every canvas page in the sprint.

- **Anatomy**
  `<H3>` uppercase 12px / 0.14em letterspacing · mono meta · thin `--line-2` 1px filler that fills remaining width.

- **Rule**
  Never use a generic `<h2>`/`<h3>` for canvas sections — use `.sec-head` so the rhythm stays consistent.

---

## 17. Side-panel card (`.panel`)

The right-rail container with a 12px uppercase header, mono meta on the right, and a 12-14px padded body.

- **Used by**
  Bridge Session Flow side · Token Governor side · Dispatcher side.

- **Anatomy**
  `header` row (12px tracked uppercase title + mono meta) · `body` block (12-14px padding, gap-driven children).

- **Rule**
  Side panels are never wider than 380px and never deeper than the canvas; they scroll independently when content overflows.

---

## 18. Step badge / stepper

Numbered chip used in linear flows (Bridge Session lifecycle, Dispatcher 9-step gate as a top summary).

- **States**
  - **done** — green check, green tag color, full opacity.
  - **active** — yellow ring pulse, yellow chip, slight elevation.
  - **future** — gray dot, t-4 tag, 55% opacity.

- **Anatomy of a step card**
  Number badge · short ALL-CAPS label · short title · 1-line description.

- **Connector**
  An arrow between steps drawn as a CSS clip-path. Hides on the last step. Faints at low opacity for future steps.

---

## 19. Active proof card (Bridge)

The hero card on Bridge Session Flow that summarizes the in-flight proof.

- **Anatomy**
  Header strip (lock glyph + session id + timestamps + actions) · Body grid (Scopes-granted list on the left, Timer ring on the right with TTL meta).

- **Actions**
  `+ 30 min` (extend) · `Revoke now` (red, danger).

- **State coupling**
  All scopes shown here must match the Path-comparison card and the Audit row "USED" entries; data flows from one source.

---

## 20. Triggers list

The "What triggers a Bridge" list on the Bridge Session Flow side panel.

- **Anatomy**
  Repeatable rows: 22×22 mono icon tile · title · 1-line "why" with inline `<code>` for the relevant scope.

- **Rule**
  Five entries, in this order: Hermes specialist · Brain/wiki write · Outbound channel · Workflow trigger w/o owner · Token Governor over soft-cap. Order is canonical — do not reshuffle without updating the brief.

---

## 21. Recent sessions list

Scrollable list of Bridge Sessions, alive or finished.

- **Where**
  Bridge Session Flow side · Gateway Policies (full list) · Gateway Health (last 24h).

- **Row anatomy**
  - id mono `bs_xxxx`
  - meta line: `<scopes>` · `<TTL>` · `<via>` · `<relative time>`
  - status pill: ACTIVE (yellow) · EXPIRED (gray) · REVOKED (red).

- **Rule**
  Latest active session always pinned at the top; finished sessions ordered by recency.

---

## Cross-cutting rules

1. **Status is derived, never stored.** Always re-derive from raw flags so a stale field can never lie about node health.
2. **Stale data is labeled stale.** Never silently render cached data as live.
3. **No bare cards.** Every card belongs to a section header (`.sec-head`) or a panel header — orphaned cards confuse the canvas.
4. **No emoji except for status icons (🔒, ✓) already in this inventory.** The brand stays calm.
5. **Mono for any identifier or numeric value (`bs_4f12`, `412 KB`, `24:18`).** Sans for prose.
6. **Spacing is tokens, not magic numbers.** Use the `--r-*` and `--bg-*` ladders. Do not introduce one-off pixel values.
7. **A node renders at the lowest of its flags** — see brief §5. This is the single most important rule in the whole product.

---

## File map

| Component | First defined in | Reused by |
|---|---|---|
| Node card | `Gateway Overview.html` | All canvas screens |
| Capability pills | `Gateway Overview.html` | Registry · Detail · Routes |
| Status dot | `shared/tokens.css` | Everywhere |
| Bridge lock badge | `Gateway Overview.html` | Registry · Dispatcher · Bridge |
| Beam | `Gateway Overview.html` | Mission Control · Hermes |
| Dispatcher pipeline row | `Dispatcher.html` | Node Detail (per-request trace) |
| Audit row | `Bridge Session Flow.html` | Token Governor · Dispatcher · Node Detail |
| Telegram preview | `Bridge Session Flow.html` | Gateway Policies |
| Active session pill | `Bridge Session Flow.html` | Mission Control · Gateway Overview header |
| Timer ring | `Bridge Session Flow.html` | (potential reuse: Token Governor window TTL) |
| Path-comparison card | `Bridge Session Flow.html` | — |
| Budget bar | `Token Governor.html` | Mission Control · Gateway Health |
| Empty panel | `Gateway Overview.html` (Live Nucleus) | All side panels |
| Crumbs | `Bridge Session Flow.html` | All secondary screens |
| `.sec-head` | `shared/tokens.css` | All canvas screens |
| `.panel` | `shared/tokens.css` | All side rails |
| Stepper | `Bridge Session Flow.html` | Dispatcher (top summary variant) |
| Active proof card | `Bridge Session Flow.html` | — |
| Triggers list | `Bridge Session Flow.html` | Gateway Policies |
| Recent sessions | `Bridge Session Flow.html` | Gateway Policies · Gateway Health |

---

When dev forks `AgentNetworkCanvas.jsx` → `GatewayCanvas.jsx`, this inventory is the parts list. Component-by-component parity with this doc is the bar; deviations need a written reason in the PR.
