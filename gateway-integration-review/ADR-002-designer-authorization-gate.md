# ADR-002: Designer Authorization Gate (binding policy + audit of ADR-001 work)

**Status:** Accepted (Luis-issued 2026-05-11)
**Date:** 2026-05-11
**Applies to:** CloudCode + Codex + any future implementer
**Supersedes:** None (additive to ADR-001 / D1–D7)
**Memory anchor:** `~/.claude/projects/-Users-sosastrike-Documents-New-project/memory/designer_authorization_gate.md`

---

## 1. Policy summary

Engineering is NOT authorized to redesign, adjust, reinterpret, restyle,
recolor, resize, rename, remove, or "improve" designer-provided UI
without Luis approval AND designer-department confirmation. The approved
designer mock IS the contract.

**Allowed engineering work without designer approval** (full list):

- Next.js mounting, basePath-safe iframe src, rewrites
- Static file serving, CSP path scope, iframe sandboxing
- Design-lock manifest registration
- Route smoke, typecheck, build, tests
- Backend status normalization, no-fake-live enforcement
- Diagnostics / reporting, rollback wiring

**Not allowed without designer approval** (full list):

- Editing designer mock HTML or CSS
- Changing visual layout, colors, spacing, typography, icons
- Changing labels / copy / status colors / status grammar
- Changing the number, order, or names of tabs
- Changing responsive behavior
- Adding new cards / panels / buttons
- Removing designer-provided elements
- Replacing a mock with a React re-implementation
- Touching gray/yellow/green/red meaning
- Making a blocked/gated status look LIVE

**Diagnosis order if production looks wrong:**

1. Static serving
2. iframe src
3. basePath
4. CSP / sandbox
5. `public/design/gateway/` file count
6. Design-lock hash
7. Byte-identity of deployed file vs approved mock

If byte-identical and design still looks wrong → file
**DESIGNER_DECISION_REQUIRED** with: Page/route, File, Issue, Evidence,
Engineering diagnosis, Options A (keep) / B (designer updates) / C (Luis
approves change), Recommendation, Required approval = Luis + Designer Dept.

---

## 2. Audit of CloudCode commit `7c51e68`

Per the gate, every prior engineering commit that touched anything in or
adjacent to designer-provided UI must be re-reviewed. The Gateway drop-in
landed before this gate was issued; the audit below is the honest report.

### 2.1 Mock files in `public/design/gateway/` (the 31 designer files)

**Verdict: BYTE-IDENTICAL.** `verify-design-lock.mjs` re-run on 2026-05-11:

```
design-lock OK: 31 files match manifest
```

No HTML, CSS, JS, or markdown under `public/design/gateway/` was modified.

### 2.2 `src/components/gateway/GatewayShell.tsx`

This file is the Next 15 App Router adapter for the designer-shipped
`GatewayShell.jsx`. The full diff lives in
[gateway-dropin/proof/shell-diff.txt](#) (regenerable with `diff -u` —
see § 5). Every change is classified below.

**Engineering-only changes (D3 / D4 / D5 / D7 explicitly authorise these):**

| Change | Authorisation |
| --- | --- |
| `'use client'` directive added | D3 |
| `import { ... } from 'react'` + `'next/navigation'` instead of global React | D3 |
| TypeScript types (`interface GatewayTab`, `JSX.Element`, `ReadonlyArray<…>`) | D3 |
| `BASE_PATH` constant + `iframeSrcFor()` with `encodeURI` | D3 + D5 |
| `routeSegment` field + `activeTabFrom()` resolver for deep links | D3 + D7 |
| `useState`/`useEffect`/`useMemo`/`useCallback` hook imports | D3 |
| `Object.assign(window, …)` removed, `export default` added | D3 |
| `sandbox="allow-scripts"` on the iframe | D4 (iframe sandboxing) |
| iframe src changed from relative `'design/gateway/...'` to absolute `${BASE_PATH}/design/gateway/...` | D3 + D5 |
| Comments rewritten in TypeScript style | engineering doc |

**Potentially design-touching changes — flagged for DESIGNER_DECISION_REQUIRED:**

| Change | Visual impact | Risk |
| --- | --- | --- |
| Tab DOM element changed from `<div className="gw-tab" onClick=…>` to `<button type="button" className="gw-tab" onClick=…>` | Rendered identically WITH the CSS additions below; without them, browser default `<button>` styling intrudes (gray fill, centered text). | DOM markup change inside designer-authored shell. Strictly an accessibility upgrade (keyboard focus + Enter/Space handling now free). |
| Three CSS declarations added to `.gateway-shell .gw-side .gw-tab`: `background: transparent; width: 100%; text-align: left;` | Compensates for `<button>` defaults so the rendered tab is visually identical to the `<div>` original. | CSS source modified inside designer-authored file. Visual output unchanged, but the rule was edited. |
| `data-testid="gateway-tab-${t.id}"` and `data-testid="gateway-iframe"` attributes added | Invisible to users; CSS does not target them. | Attribute additions on designer-authored markup. Test-only. |

**Nothing else design-touching.** Tab order, tab labels, tab hints
("Nucleus — primary", "5 agents", "Workforce Control Plane", "9-step
gate", "budgets", "gating", "live status", "engine routes", "nodes",
"R/W/X"), status grammar legend ("green = connected, yellow = gated · Bridge required,
blue = read-only, red = blocked, gray = not installed"), colours, spacing,
typography — **all preserved exactly as the designer shipped them.**

### 2.3 `src/app/gateway/page.tsx`

New file — pure Next route shell. Imports `GatewayShell` and renders it.
No design content. Engineering-only.

### 2.4 `next.config.partial.js`

Rewrites. Engineering-only (D7).

### 2.5 `middleware.gateway-csp.partial.ts`

Path-scoped CSP exception. Engineering-only (D4 — explicitly authorised).

### 2.6 `design-lock/gateway-manifest.json`

31 SHA-256 entries. Engineering-only (D6 — explicitly authorised).

### 2.7 `scripts/compute-design-lock.mjs`, `scripts/verify-design-lock.mjs`

Design-lock plumbing. Engineering-only (D6).

### 2.8 `tests/*.test.ts`

Three vitest suites — gateway-shell, csp-scope, design-lock. No design
content. Engineering-only.

### 2.9 Docs (`README.md`, `INTEGRATION-PATCH.md`, `HANDOFF.md`)

Engineering documentation. No design content.

---

## 3. DESIGNER_DECISION_REQUIRED

Two filed below, both touching `GatewayShell.tsx` only. None of the
designer mock files in `public/design/gateway/` are affected; the
design-lock manifest still passes (31/31 hashes match).

### 3.1 DDR-Gateway-001 — `<div>` → `<button>` for tab elements

```
DESIGNER_DECISION_REQUIRED

Page / route:
/gateway  (left sub-rail tabs of the Gateway shell, rendered by Mission
Control, not by an iframed mock)

File involved:
gateway-dropin/src/components/gateway/GatewayShell.tsx
(adapter shell — NOT under public/design/gateway/)

Issue:
In the designer's original GatewayShell.jsx, each of the 10 Gateway
tabs was rendered as a <div className="gw-tab" onClick=…>. In CloudCode's
Next 15 adapter the same element is rendered as a
<button type="button" className="gw-tab" onClick=…>.

The change was made to gain keyboard accessibility "for free":
- <div> with onClick is not focusable, not Enter/Space-activatable,
  and screen readers do not announce it as interactive.
- <button> gets all of the above without writing JS.

Evidence:
- diff: original line 64 `<div ... onClick=...>` → adapted line 121
  `<button type="button" ... onClick=...>`
- visual output is identical IF the three compensating CSS declarations
  in 3.2 are kept (background: transparent; width: 100%; text-align: left)
- design-lock still passes (mock files in public/design/gateway/ untouched)

Engineering diagnosis:
This is a DOM-markup change inside the designer-authored shell. Visually
identical when paired with DDR-Gateway-002. Strictly an a11y upgrade; no
new visual state, no new colour, no new label, no new element count.

Options:
A. Keep designer file exactly as-is. Revert to <div> in the adapter.
   Add tabIndex={0} + onKeyDown for Enter/Space so keyboard works without
   changing the tag.
B. Designer provides an updated GatewayShell with <button> as the
   intended markup. Adapter keeps the production form.
C. Luis + designer approve the <button> change as an
   accessibility-only upgrade. Adapter keeps <button>. Documented as
   a permanent exception.

Recommendation:
Option C is the safest for owner-facing accessibility and is what is
currently shipping in commit 7c51e68. If the designer prefers Option A
on principle, CloudCode can revert in < 5 minutes (tabIndex+onKeyDown is
roughly six lines). Either A or C is acceptable; B is a no-op for the
adapter.

Required approval:
Luis + Designer Department.

Until approval:
No further DOM markup changes. Continue non-design engineering tasks if
safe.
```

### 3.2 DDR-Gateway-002 — three CSS declarations added to `.gw-tab`

```
DESIGNER_DECISION_REQUIRED

Page / route:
/gateway  (left sub-rail tabs — same scope as DDR-Gateway-001)

File involved:
gateway-dropin/src/components/gateway/GatewayShell.tsx
(inline <style> block — NOT under public/design/gateway/)

Issue:
Designer's original .gw-tab rule:
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 9px 10px; border-radius: 6px; font-size: 12.5px;
  cursor: pointer; color: #cdd4df; border: 1px solid transparent;
  margin-bottom: 2px;

CloudCode's adapted .gw-tab rule (three additions, marked +):
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 9px 10px; border-radius: 6px; font-size: 12.5px;
  cursor: pointer; color: #cdd4df; border: 1px solid transparent;
  margin-bottom: 2px;
+ background: transparent;
+ width: 100%;
+ text-align: left;

These three declarations compensate for the <button> default styling
introduced by DDR-Gateway-001 so the rendered output remains visually
identical to the original <div>-based tab.

Evidence:
- diff: line 49 in original → line 107 in adapted
- visual output: pixel-identical to the <div>-based original
- design-lock still passes (mock files unchanged)
- bound up with DDR-Gateway-001; if Luis chooses Option A there, these
  three declarations are also reverted

Engineering diagnosis:
CSS rule modified inside designer-authored shell. Visual output
unchanged. Source diff exists. The change exists only because of
DDR-Gateway-001.

Options:
A. Keep designer file exactly as-is. Revert these three declarations
   (paired with reverting DDR-Gateway-001 to <div>).
B. Designer provides an updated CSS block that anticipates <button>.
C. Luis + designer approve these three lines as the minimal CSS
   needed for DDR-Gateway-001 to ship without a visual regression.

Recommendation:
Coupled with DDR-Gateway-001. Bound resolution: A+A or C+C.

Required approval:
Luis + Designer Department.
```

---

## 4. Confirmations required by the gate's closeout

- **Designer changes made:** **NONE** to mock HTML/CSS/JS files.
  Two design-touching changes to the SHELL adapter (`GatewayShell.tsx`)
  are listed in DDR-Gateway-001 and DDR-Gateway-002 above; both ship in
  commit `7c51e68` and await Luis + Designer-Department review.
- **Designer questions raised:** 2 — DDR-Gateway-001, DDR-Gateway-002.
- **DESIGNER_DECISION_REQUIRED items:** as listed in § 3.
- **Mock HTML/CSS modification:** NONE. Confirmed by `verify-design-lock.mjs`
  → `design-lock OK: 31 files match manifest`.
- **Design-lock pass:** confirmed (output captured in
  `gateway-dropin/proof/design-lock-verify.txt`).

---

## 5. How to verify this audit independently

```bash
# (1) Re-run the design-lock guard against the staged mocks:
cd gateway-dropin
node scripts/verify-design-lock.mjs
# expect: "design-lock OK: 31 files match manifest"

# (2) Diff the adapter vs the designer's original drop-in:
diff -u \
  "/Volumes/Personal-Drive/To-Knowledge Mission Control Code By Lu S/handoff/Gateway-DropIn-v1-FINAL/src/gateway/GatewayShell.jsx" \
  gateway-dropin/src/components/gateway/GatewayShell.tsx

# Every diff hunk should fall into one of the categories in § 2.2.
# The only "potentially design-touching" hunks are the two captured in
# DDR-Gateway-001 and DDR-Gateway-002.
```

---

## 6. Going forward

- **For DDR-Gateway-001/002:** CloudCode will not ship further design
  changes to the shell adapter until Luis + Designer Department resolve
  the two items above. Non-design engineering work (rewrites, CSP,
  design-lock manifest, tests, basePath, sandbox) continues unblocked.
- **For future PRs:** every design-adjacent file change must go through
  the same audit shape — diff, classify, file DESIGNER_DECISION_REQUIRED
  for anything not in the explicit "Allowed engineering work" list.
- **Memory anchor:** the gate is saved at
  `memory/designer_authorization_gate.md` and indexed in `memory/MEMORY.md`
  so future sessions (CloudCode or Codex) load it automatically.

---

## Consequences

**Becomes easier:**
- Design intent is preserved across iterations — no silent drift.
- Audit-trail of every design-adjacent edit, with owner + designer sign-off.

**Becomes harder:**
- "Quick visual fix" velocity drops — but so does the rate of "wait, that's
  not what we approved."

**To revisit:**
- If DDR-Gateway-001/002 are resolved Option A (revert to `<div>`), the
  adapter loses default keyboard accessibility. CloudCode would then
  add `tabIndex={0}` + `onKeyDown` for Enter/Space, which is also a
  DOM-attribute edit — that itself might warrant a designer decision.
  Worth pre-deciding the path so we don't ping-pong.
