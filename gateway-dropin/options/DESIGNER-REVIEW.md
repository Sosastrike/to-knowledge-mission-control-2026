# Designer review package — DDR-Gateway-001 + DDR-Gateway-002 (RESOLVED — C+C approved)

```
DDR-Gateway-001 RESOLUTION: C
DDR-Gateway-002 RESOLUTION: C
Resolved by:  Designer Department (delivered via Luis)
Approved by:  Luis Sosa <luis@ecopiersolutions.com>
Date:         2026-05-11
Notes:        "C+C approved. Ship it. Then move on. Don't hold the
              build for accessibility wins."
```

Both bound items resolved together as Option C+C. The shell adapter
shipping in production is `gateway-dropin/src/components/gateway/GatewayShell.tsx`
(commit `7c51e68`). This folder is retained as the audit trail of the
decision — Option A+A is now historical, not a live alternative.

Production deploy is **unblocked** as of the resolution above. Designer
mock files under `public/design/gateway/` remain byte-identical to
source; `design-lock` passes.

---

## Original review package (for record)

---

## What's in this folder

| File | Purpose |
| --- | --- |
| `GatewayShell.option-A.tsx` | Standalone A+A variant of the shell, ready to drop in if A+A is approved. |
| `design-relevant.diff` | Focused diff showing only the design-relevant 5 lines between A+A and C+C (no comment / docstring noise). |
| `option-A-vs-option-C.diff` | Full unified diff for completeness. |
| `DESIGNER-REVIEW.md` | This file — comparison index. |

Both shell variants ship the same: 31 designer mock files (byte-identical),
the same scoped CSP, the same rewrites, the same design-lock manifest,
the same tests, the same iframe sandbox, the same encoding for filenames
with spaces. **The only difference is the two design-touching lines in
the shell adapter.**

---

## Option C+C — currently shipping in commit `7c51e68`

**Tab element:** `<button type="button">`
**CSS:** `.gw-tab` includes three extra declarations
(`background: transparent; width: 100%; text-align: left;`) to make the
button render visually identical to the original `<div>`.

| Property | C+C |
| --- | --- |
| Visual rendering vs designer source | Identical |
| Keyboard accessibility | Free (tab focus, Enter/Space) |
| Screen-reader semantics | Announces as "button" |
| Adapter source byte-identity vs designer | Two lines drift from designer |
| Mock files under `public/design/gateway/` | Byte-identical, design-lock OK |
| Status grammar, colours, spacing, typography | Unchanged |

**Why CloudCode initially chose C+C:** owner-facing UI without keyboard
accessibility is hard to defend. `<button>` gets all the right defaults
for free. The compensating CSS keeps the rendered shape unchanged.

**Why C+C may still need designer approval:** the DAG counts `<div>` →
`<button>` and any CSS-rule edit as design-touching, even when visually
identical. Per the gate, designer signs off before C+C ships.

---

## Option A+A — alternative, prepared for review

**Tab element:** `<div>` (designer's original markup)
**CSS:** `.gw-tab` byte-identical to designer's original (no three extra
declarations).

| Property | A+A |
| --- | --- |
| Visual rendering vs designer source | Identical (it IS the designer source) |
| Keyboard accessibility | NOT free — `<div>` with onClick has no focus or Enter/Space |
| Screen-reader semantics | Not announced as interactive |
| Adapter source byte-identity vs designer | Closer to designer (only the engineering-allowed adaptations remain) |
| Mock files under `public/design/gateway/` | Byte-identical, design-lock OK |
| Status grammar, colours, spacing, typography | Unchanged |

**Why A+A is the most-conservative option:** the shell tab element and
its CSS rule match the designer's drop-in 1:1. No drift to defend.

**Why A+A may need a follow-up decision:** without keyboard
accessibility, the 10 Gateway tabs are not usable by keyboard or screen
reader. If A+A is approved, CloudCode recommends filing a separate
designer decision (DDR-Gateway-003) on how to add a11y without changing
the tag — e.g. `role="button" tabIndex={0} onKeyDown=…`. That is also
a DAG-flagged change because it adds attributes to designer markup.

---

## What identical means here

Both variants:

- Iframe the same 31 mock HTML files (byte-identical to designer source,
  proven by `verify-design-lock.mjs`).
- Apply the same scoped CSP (`/design/gateway/*` only, parent CSP
  unchanged).
- Sandbox the iframe with `sandbox="allow-scripts"` (engineering-allowed
  by D4).
- Encode filenames with spaces via `encodeURI` (engineering-allowed by
  D5; preserves designer filenames as-is).
- Mount at `/gateway` only (engineering-allowed by D7).
- Resolve deep links via `next.config.partial.js` rewrites
  (engineering-allowed by D7).
- Use the same `data-testid` attributes (test-only; if designer requires
  byte-identical even for these, both variants need a follow-up — see
  below).

---

## Edge cases the Designer Department may want to decide

1. **`data-testid` attributes** on the tab and iframe elements. These
   are invisible to users and not styled. Both variants have them. The
   DAG arguably treats any new attribute on designer markup as design-
   touching, so a strict reading requires designer approval here too.
   - CloudCode recommendation: approve `data-testid` as a permanent
     test-only exception. It never affects production rendering.

2. **`sandbox="allow-scripts"`** on the iframe. Engineering-allowed by
   D4 ("iframe sandboxing"). The designer mock loads its own scripts
   via relative paths inside the iframe; `allow-scripts` is required for
   them to execute. No visual impact.

3. **`encodeURI` on iframe src.** Engineering-allowed by D5. Pure
   transport — `Agent Hub.html` becomes `Agent%20Hub.html` in the URL,
   the file fetched is the same.

---

## Recommended decision-record format

When the Designer Department decides, please record the resolution as:

```
DDR-Gateway-001 RESOLUTION: [A | C]
DDR-Gateway-002 RESOLUTION: [A | C]
Resolved by: <designer name>
Approved by: Luis Sosa (luis@ecopiersolutions.com)
Date: <YYYY-MM-DD>
Notes: <optional>
```

Two valid combinations:

- **A+A** — Designer prefers byte-identity to source over default keyboard
  accessibility. CloudCode swaps the shell adapter for
  `options/GatewayShell.option-A.tsx`, files DDR-Gateway-003 on how to
  add a11y, ships the swap as a single commit on the existing branch.

- **C+C** — Designer accepts the accessibility-only adaptation as a
  permanent exception. CloudCode leaves commit `7c51e68` in place,
  records the resolution in `HANDOFF.md`, and proceeds toward
  production deploy (still gated on owner approval).

CloudCode does NOT choose between them.

---

## What CloudCode will NOT do until the resolution lands

- No further design-adjacent edits to `src/components/gateway/GatewayShell.tsx`.
- No new attributes added to designer-authored markup beyond what already exists.
- No edits to mock HTML / CSS / JS under `public/design/gateway/`.
- No production deploy of either variant.

## What CloudCode CAN continue doing

- Non-design engineering work (rewrites, CSP, basePath, sandbox, tests,
  design-lock, deployment package preparation, production verification
  rehearsal — all in the DAG's allowed list).
- Keeping the design-lock manifest passing.
- Keeping both variants typecheck-clean.
- Preparing both variant deliveries (this folder).
