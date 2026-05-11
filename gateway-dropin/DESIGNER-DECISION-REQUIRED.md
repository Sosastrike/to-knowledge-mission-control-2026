# DESIGNER_DECISION_REQUIRED — Gateway lane (2026-05-11 update)

## Resolved (kept for record)

```
DDR-Gateway-001 RESOLUTION: C    (<button type="button"> for tabs)
DDR-Gateway-002 RESOLUTION: C    (three compensating CSS declarations)
Approved by:  Luis Sosa + Designer Department
Date:         2026-05-11
Notes:        "C+C approved. Ship it. Then move on. Don't hold the
              build for accessibility wins."
```

## Open — production audit raised these (2026-05-11 second update)

Luis reported the live `/gateway` does not match the approved designer
screenshots. Production-truth audit found that the designer's own
v1-FINAL package contains two competing navigations and three broken
top-rail links. CloudCode cannot pick between them alone — the DAG
makes this the Designer Department's call.

Design-lock status: PASS. SMB v1-FINAL source byte-identical to
CloudCode staged copy (31/31 sha256 match).

---

## DDR-Gateway-003 — TWO competing navigations in v1-FINAL

**Page / route:** `/gateway` and every `/gateway/<segment>` page.

**File involved:**
- `src/gateway/GatewayShell.jsx`  (designer-authored, 10-tab left rail)
- `design/gateway/shared/render.js`  (designer-authored, 15-tab top rail injected into every mock by `GW.topbar()`)

**Issue:**
The designer's package ships two navigations that target different sets
of pages and live in different positions. Luis's approved screenshots
show the 15-tab top-rail (each mock rendered standalone). Production
currently renders the 10-tab left-rail wrapper AROUND the iframed mock,
which already has its own 15-tab top-rail inside it — so users see
both navs simultaneously, which does NOT match the screenshots.

**Evidence:**

| Surface | Tabs | Position | Targets |
| --- | --- | --- | --- |
| `GatewayShell.jsx` (10 tabs) | Overview, Agent Hub, Paperclip, Dispatcher, Token Governor, Bridge Session, Health, Routes, Registry, Policies | LEFT rail | `Gateway Overview.html`, `Agent Hub.html`, `Paperclip.html`, `Dispatcher.html`, `Token Governor.html`, `Bridge Session Flow.html`, `Gateway Health.html`, `Gateway Routes.html`, `Gateway Registry.html`, `Gateway Policies.html` |
| `render.js` `NAV_ITEMS` (15 tabs) | Index, Overview, Routes, Registry, Policies, Health, Agent Zero, Hermes, OpenCloud, OpenClaw+, Brain, Connectors, Node spec, Legend, Mobile | TOP rail (inside every mock) | `index.html`, `Gateway Overview.html`, `Gateway Routes.html`, `Gateway Registry.html`, `Gateway Policies.html`, `Gateway Health.html`, `Agent Zero Commander.html`, `Hermes Lieutenant.html`, `OpenCloud Workers.html`, `OpenClaw+ Skills.html`, `Brain Systems.html`, `Delivery Connectors.html`, `node-card-spec.html`*, `color-status-legend.html`*, `mobile-tablet.html`* |

\* = three top-rail targets reference filenames that don't exist in the v1-FINAL package — see DDR-Gateway-004 below.

The two navigations agree on five tabs (Overview, Routes, Registry,
Policies, Health). They diverge on everything else.

**Engineering diagnosis:**
This is a designer-side inconsistency, not an engineering bug.
CloudCode shipped the GatewayShell.jsx the designer included. Stripping
it requires designer approval.

**Options:**

| | Choice | Engineering work |
| --- | --- | --- |
| A | **The 15-tab top-rail is canonical. Strip the 10-tab GatewayShell wrapper from production.** `/gateway` serves `Gateway Overview.html` (or `index.html`) directly via Next; `/gateway/<segment>` serves the matching `*.html` mock directly. The top-rail inside each mock becomes the production navigation. | CloudCode rewrites the `/gateway` route to serve the static mock directly (Next `rewrites` from `/gateway` → `/design/gateway/Gateway Overview.html`, plus per-segment rewrites). Removes `GatewayShell.tsx` + `src/app/gateway/page.tsx`. Per-route metadata updated. No mock HTML/CSS/JS change. |
| B | **The 10-tab GatewayShell wrapper is canonical. The top-rail in mocks is dead chrome.** Production keeps the GatewayShell wrapper; designer accepts that the top-rail inside each mock is visible but inert. | No engineering change. CloudCode files DDR-Gateway-005 asking designer if the top-rail should be hidden via CSS injection (designer change) or accepted as visible-but-noop. |
| C | **Both navs coexist.** Production keeps both the 10-tab left-rail (GatewayShell) AND the 15-tab top-rail (inside mocks). Both are functional. | CloudCode keeps current architecture. This is what's deployed. Luis confirms it's acceptable. |
| D | **Designer respec.** The designer re-delivers a v2 package with a single canonical navigation. | CloudCode waits for the new package. Production stays as-is or is rolled back to a pre-Gateway state. |

**Recommendation:** None. CloudCode does not choose between A/B/C/D.
The DAG explicitly assigns this to the Designer Department.

If forced to flag a leaning purely from the visual evidence Luis shared:
his screenshots show **standalone mocks with the top-rail visible and no
left-rail visible**, which is consistent with Option A. But the
designer's own `GatewayShell.jsx` ships the left-rail, so the designer
must confirm before any code moves.

**Required approval:** Luis + Designer Department.

---

## DDR-Gateway-004 — three top-rail tabs point to files that don't exist

**Page / route:** Top-rail inside every mock (rendered by `render.js`).

**File involved:**
- `design/gateway/shared/render.js`  (`NAV_ITEMS` array, last three entries)

**Issue:**
The designer's `render.js` top-rail nav includes three entries whose
target filenames are not present anywhere in the v1-FINAL package:

| Top-rail label | Linked-to filename | Present in package? |
| --- | --- | --- |
| Node spec | `node-card-spec.html` | NO |
| Legend | `color-status-legend.html` | NO |
| Mobile | `mobile-tablet.html` | NO |

These same three top-rail links also appear in `index.html`:

```
<a class="card" href="color-status-legend.html"> ...
<a class="card" href="node-card-spec.html"> ...
<a class="card" href="mobile-tablet.html"> ...     (assumed by parity)
```

The package DOES contain `Gateway Node Detail.html` and
`Gateway Mobile Tablet.html` — plausibly the intended targets — but
the link text and href don't match.

**Engineering diagnosis:**
Designer-side naming inconsistency. The links are wrong OR the files
are missing OR there are intended new files the designer hasn't shipped.

**Options:**

| | Choice |
| --- | --- |
| A | Designer updates `render.js` + `index.html` so the hrefs point to existing files (`Gateway Node Detail.html`, `color-status-legend.html` → some existing CSS-tokens page or remove, `Gateway Mobile Tablet.html`). Files unchanged. |
| B | Designer ships the three missing pages (`node-card-spec.html`, `color-status-legend.html`, `mobile-tablet.html`) in a v1-FINAL.1 or v2 drop. |
| C | Designer removes the three broken entries from `NAV_ITEMS`. |
| D | CloudCode adds Next `rewrites` so broken hrefs redirect to existing pages (engineering workaround). This is also a design-touching change because it changes the navigation behavior; flagged for designer ack. |

**Recommendation:** None. CloudCode prefers A or C purely on
maintainability grounds, but the call is the designer's.

**Required approval:** Luis + Designer Department.

---

## Until DDR-Gateway-003 + DDR-Gateway-004 resolve

CloudCode does NOT:
- modify mock HTML/CSS/JS
- modify `shared/render.js`
- modify `shared/topbar.html`
- modify `GatewayShell.tsx` (the C+C-approved state stays)
- pick A/B/C/D for either DDR
- ship further design-adjacent changes

CloudCode DOES (engineering-only, DAG-allowed):
- keep design-lock passing
- preserve the package as-is
- update HANDOFF/DELIVERY status to FAILED-IN-PRODUCTION pending decision
- prepare Option A engineering scaffolding so it can ship in <30 min once
  approved (a sibling branch with the GatewayShell removal + per-segment
  rewrites, byte-untouched mock files)
- run the production audit script the moment Luis hands over a domain

---

## What CloudCode is asking Luis to do next

1. Resolve DDR-Gateway-003: A, B, C, or D.
2. Resolve DDR-Gateway-004: A, B, C, or D.
3. (Independent) Hand over the production domain so CloudCode can run
   `audit-production.mjs --base https://<domain>` and produce the JSON
   proof of which navigation is currently winning in production.
