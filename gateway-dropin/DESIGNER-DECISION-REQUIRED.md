# DESIGNER_DECISION_REQUIRED — RESOLVED 2026-05-11 (C+C approved)

```
DDR-Gateway-001 RESOLUTION: C
DDR-Gateway-002 RESOLUTION: C
Resolved by:  Designer Department (delivered via Luis)
Approved by:  Luis Sosa <luis@ecopiersolutions.com>
Date:         2026-05-11
Notes:        "C+C approved. Ship it. Then move on. Don't hold the
              build for accessibility wins."
```

**Outcome:**
- `<button type="button">` for tab elements — **APPROVED**
- The three CSS declarations (`background: transparent; width: 100%;
  text-align: left;`) added to `.gw-tab` — **APPROVED**
- Combined as an accessibility-only exception. Rendered output is
  visually identical to the designer's `<div>`-based original. The
  `<button>` form additionally yields keyboard focus / Enter+Space
  activation / screen-reader semantics for free.
- Both changes ship as part of commit `7c51e68` (already in the
  delivery bundle); no further code change required.

Designer mock files under `public/design/gateway/` remain
byte-identical to source (`design-lock OK: 31 files match manifest`).

The Option A+A variant kept under `gateway-dropin/options/` is retained
as audit trail of the design decision, not as a live alternative.

---

## Original filing (for record)

Filed against commit `7c51e68` on `cloudcode/gateway-dropin-integration`
in compliance with the Designer Authorization Gate (issued by Luis
2026-05-11). Both items are bound; resolve as a pair.

Full audit + ADR live at
[gateway-integration-review/ADR-002-designer-authorization-gate.md](../gateway-integration-review/ADR-002-designer-authorization-gate.md).

Design-lock status: PASS — `31 files match manifest`. Mock HTML/CSS
under `public/design/gateway/` was NOT modified.

---

## DDR-Gateway-001 — `<div>` → `<button>` for tab elements

**Page / route:** `/gateway` (left sub-rail tabs of the Gateway shell)
**File involved:** `gateway-dropin/src/components/gateway/GatewayShell.tsx`
(the adapter shell — NOT a mock under `public/design/gateway/`)

**Issue:**
Designer's original `GatewayShell.jsx` rendered each tab as
`<div className="gw-tab" onClick=…>`. CloudCode's Next 15 adapter
renders it as `<button type="button" className="gw-tab" onClick=…>`.

**Why CloudCode made the change:**
`<div>` with an `onClick` is not keyboard-focusable, not Enter/Space-
activatable, and screen readers do not announce it as interactive.
`<button>` gets all of the above for free.

**Evidence:**
- diff hunk: original line ~64 → adapted line ~121.
- Visual output is identical when paired with DDR-Gateway-002.
- design-lock still passes (mock files in `public/design/gateway/`
  byte-identical to the designer's source).

**Engineering diagnosis:**
DOM markup change inside the designer-authored shell adapter. Strictly
an accessibility upgrade. No new visual state, no new colour, no new
label, no new element count.

**Options:**

| | Choice | Result |
| --- | --- | --- |
| A | Revert to `<div>`. CloudCode adds `tabIndex={0}` + `onKeyDown` for Enter/Space keyboard activation. | Keeps designer markup; needs tiny JS for keyboard. |
| B | Designer provides an updated `GatewayShell` with `<button>` as the intended markup. | Adapter keeps the current shape; no further change. |
| C | Luis + designer approve `<button>` as accepted accessibility-only upgrade. | Adapter keeps the current shape; treat as permanent exception, documented here. |

**Recommendation:** Option C. Currently shipping in commit `7c51e68`. If
the designer prefers A on principle, the revert is six lines and ships
the same day.

**Required approval:** Luis + Designer Department.

---

## DDR-Gateway-002 — three CSS declarations added to `.gw-tab`

**Page / route:** `/gateway` (same scope as DDR-Gateway-001)
**File involved:** `gateway-dropin/src/components/gateway/GatewayShell.tsx`
(inline `<style>` block — NOT a mock CSS file under
`public/design/gateway/shared/`)

**Issue:**
The `.gateway-shell .gw-side .gw-tab` rule has three declarations added:
```css
background: transparent;
width: 100%;
text-align: left;
```
These exist solely to keep the rendered tab visually identical to the
designer's `<div>`-based original once DDR-Gateway-001 changes the tag
to `<button>` (which has different browser defaults: gray background,
narrow width, centered text).

**Evidence:**
- diff hunk: original line ~49 → adapted line ~107.
- Visual output: pixel-identical to the `<div>` original.
- design-lock still passes.

**Engineering diagnosis:**
CSS rule modified inside designer-authored shell. Visual output
unchanged. Bound to DDR-Gateway-001 — if that one reverts, these three
lines also revert.

**Options:**

| | Choice | Result |
| --- | --- | --- |
| A | Revert these three declarations (paired with reverting DDR-Gateway-001 to `<div>`). | CSS source byte-identical to designer's original. |
| B | Designer provides an updated CSS block that anticipates `<button>`. | Adapter takes the new block verbatim. |
| C | Luis + designer approve the three lines as the minimal CSS needed for DDR-Gateway-001 to ship without a visual regression. | Keep as shipped. |

**Recommendation:** Coupled with DDR-Gateway-001. Bound resolution = A+A
or C+C.

**Required approval:** Luis + Designer Department.

---

## Until approval

- CloudCode will not ship further design changes to the shell adapter.
- Non-design engineering work (rewrites, CSP, design-lock manifest,
  tests, basePath, sandbox) continues unblocked.
- Mock HTML/CSS under `public/design/gateway/` is and remains
  byte-identical to the designer's source. Design-lock guard enforces
  this on every CI run.
- If Luis or the designer needs a side-by-side visual diff before
  deciding, CloudCode can prepare a screenshot pair (`<div>` form vs
  `<button>` form) on request.
