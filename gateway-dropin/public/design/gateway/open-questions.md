# Gateway · Open Questions

**Project:** To-Knowledge Gateway
**Status:** Sprint design complete. These are the decisions still owed before/during implementation.
**Read-with:** `00-design-brief.md`, `developer-handoff.md`, `components.md`.

Each question lists: **what's at stake**, **owner / decider**, **default we'd fall back to if unanswered**, and any **dependency** on other questions.

The brief locks the structural decisions (Gateway center · Agent Zero commander · Hermes lieutenant gated · Tony retired · 5-min TTL · 30-min Bridge default). Everything below sits inside those locks.

---

## A. Bridge Session

### A1. Should TTL extend on use, or only on owner action?
- **At stake:** Whether actively-used sessions auto-renew, or always require an explicit owner tap to extend.
- **Current mock:** "+5 min idle reset" shown on the Timer Ring as if usage extends TTL.
- **Default if unanswered:** Owner-action only. Usage does not extend; sessions are time-boxed at the original TTL or a manual `+30 min` tap.
- **Decider:** Owner.

### A2. Per-scope sub-TTLs?
- **At stake:** Whether `email:send` (sensitive outbound) can have a shorter TTL than `wiki:write` inside the same Bridge session.
- **Current mock:** Single TTL covers all granted scopes.
- **Default if unanswered:** Single TTL, scope-uniform.
- **Decider:** Owner. Worth revisiting after first month of audit data.

### A3. Multi-device sessions
- **At stake:** Can two devices (Telegram + Web) hold concurrent active sessions for the same owner?
- **Current mock:** One active session pill at a time.
- **Default if unanswered:** Single active session per owner. Granting on a new device revokes the previous.
- **Decider:** Owner.

### A4. Approve-on-behalf
- **At stake:** Eventually, can a designated trusted operator (not the owner) approve specific scopes?
- **Current mock:** Owner-only approval, hardcoded to `@luis`.
- **Default if unanswered:** Owner-only forever. Out of scope for v1.
- **Decider:** Owner. Defer.

### A5. What happens to a request mid-flight when its session is revoked?
- **At stake:** Hermes is composing; owner taps "Revoke now." Does the in-flight request finish, error out, or roll back?
- **Current mock:** Audit row implies hard stop, but the behavior isn't visualized.
- **Default if unanswered:** Hard stop. Any in-flight write that hadn't reached step 8 (Execute) is denied. Step-8-and-after rolls forward to completion but the result is flagged "session-revoked-during-execute" in the audit.
- **Decider:** Engineering, with owner sign-off on the audit phrasing.

---

## B. Token Governor

### B1. Hard-cap behavior
- **At stake:** When per-window hard cap is reached, do we (a) block all subsequent requests until the window rolls, (b) require owner override per request, or (c) auto-degrade to cheaper models?
- **Current mock:** "Auto-locked" badge shown — implies (a).
- **Default if unanswered:** (a) — block until window rolls. Reasoning: predictability beats clever degradation when budget is the entire point.
- **Decider:** Owner.

### B2. Window granularity
- **At stake:** Per-day, per-hour, per-15-min, or rolling-window (e.g. last 60 min)?
- **Current mock:** Per-day window assumed.
- **Default if unanswered:** Per-day, with a rolling-60-min secondary cap to absorb spikes.
- **Decider:** Owner + engineering.

### B3. Multi-budget by purpose
- **At stake:** Should "Hermes specialist work" carry a different cap than "background brain sync"?
- **Current mock:** Single global budget.
- **Default if unanswered:** Single budget for v1; revisit after one month of usage data.
- **Decider:** Owner. Defer.

---

## C. Discovery & registry

### C1. How is a new tool registered?
- **At stake:** Self-registering MCP servers vs. owner-curated allowlist.
- **Current mock:** Registry assumes a curated allowlist; no self-registration UI shown.
- **Default if unanswered:** Owner-curated allowlist. New entries land in `pending` (gray) until the owner promotes them.
- **Decider:** Owner.

### C2. TTL overrides per node
- **At stake:** The brief sets default TTL = 5 min. Some nodes (Build-Wiki, Brain Sync) might warrant a longer TTL.
- **Current mock:** Overrides are referenced ("critical health 30–60s, expensive scans 10–15min") but never surfaced in UI.
- **Default if unanswered:** Hardcoded per-node overrides in `shared/gateway-data.js` for v1. UI to edit them is post-v1.
- **Decider:** Engineering.

### C3. "Refresh now" cost protection
- **At stake:** Owner clicks "Refresh now" 50 times. Do we let them, or rate-limit?
- **Current mock:** Refresh always allowed.
- **Default if unanswered:** Rate-limit at 1 refresh per 10 s per node. Silent UX (button disables) — never an error.
- **Decider:** Engineering.

---

## D. Hermes lieutenant

### D1. When does Hermes graduate from "gated" to "live"?
- **At stake:** The brief says Hermes is "yellow / gated until live chat proven." Where is the proof captured?
- **Current mock:** Hermes stays yellow indefinitely; there's no path to green.
- **Default if unanswered:** Hermes turns green only after `proof/test/30-hermes-live-chat.sh` passes ten consecutive runs across a week. Until then, every Hermes invocation re-prompts (Bridge Session) regardless of an active session.
- **Decider:** Engineering.

### D2. Hermes failure isolation
- **At stake:** Hermes crashes mid-plan. Does Agent Zero retry, fall back to its own composer, or surface an error to the owner?
- **Current mock:** Not depicted.
- **Default if unanswered:** Surface to owner with a "Retry / Compose without Hermes / Cancel" prompt. Never silent retry.
- **Decider:** Owner.

### D3. Hermes scope minimization
- **At stake:** Today, granting `hermes:invoke` is unlimited inside the session window. Should we throttle Hermes calls per session?
- **Current mock:** "unlimited / window."
- **Default if unanswered:** Cap at 8 Hermes calls per Bridge Session. Soft cap with owner-tap to extend.
- **Decider:** Owner.

---

## E. Audit and observability

### E1. Audit retention
- **At stake:** How long do we keep audit rows?
- **Current mock:** Implicit "forever" in the timeline UI.
- **Default if unanswered:** Hot store 30 days; cold archive (compressed, append-only) for 12 months; everything older purged unless flagged for legal hold.
- **Decider:** Owner + engineering.

### E2. PII redaction in audit
- **At stake:** Outbound email payloads, Obsidian note content — does the audit row store the body or just a hash + size?
- **Current mock:** Audit row shows file path, not content.
- **Default if unanswered:** Path + size + sha256 only. Body never logged. Out-of-band sampling for debugging requires a separate, opt-in trace flag.
- **Decider:** Owner.

### E3. Audit export format
- **At stake:** Owner wants to share an incident audit with a third party. Format?
- **Current mock:** Not addressed.
- **Default if unanswered:** Signed JSONL with a sidecar `manifest.json` (sha256 of each row, monotonic counter). CSV export available but unsigned.
- **Decider:** Engineering.

---

## F. Mobile / tablet

### F1. Telegram-only on mobile?
- **At stake:** Is the mobile experience the Telegram bot, the responsive web Gateway, or both?
- **Current mock:** `Gateway Mobile Tablet.html` shows responsive web.
- **Default if unanswered:** Both. Telegram is the primary owner surface for approvals; the responsive web view is for monitoring.
- **Decider:** Owner.

### F2. What's the smallest screen we support?
- **Current mock:** 360px assumed.
- **Default if unanswered:** 360px wide minimum. Below that, render a "open on a larger device" landing.
- **Decider:** Engineering.

---

## G. Failure modes still ungeometrized

These are states the brief acknowledges but the screens don't fully render yet. Each will need its own component variant when implemented:

| State | Screens missing it | Note |
|---|---|---|
| Discovery cache stale + node otherwise healthy | Gateway Overview, Registry | Need a "stale 11m" pill on top of the existing status dot dim. |
| Hard-cap reached AND active Bridge session | Token Governor, Bridge Session Flow | What does the active proof card look like when budget is gone but the session is technically alive? |
| Owner offline > 24h | Gateway Health | Should everything yellow-out? Or only active workflows? |
| Tool deprecated upstream | Gateway Registry | We need a "deprecated upstream" red variant distinct from "blocked." |
| Brain write conflict (concurrent edits) | Brain Systems, Bridge Session Flow audit | Today the audit shows USED but doesn't show conflicts. |

---

## H. Naming we are still not sure about

- **"Bridge Session"** — accurate but jargon-heavy. Considered: "Approval window," "Owner pass," "Lift." Owner has signed off on Bridge Session for now.
- **"Nucleus"** — internal only. Public copy says "Live activity." Make sure both are consistent in the final UI.
- **"Hermes lieutenant"** — works for engineering; owner-facing copy may want to drop "lieutenant" entirely and just call it Hermes.
- **"Agent Zero commander"** — same caveat.

If owner approves dropping the rank words from public copy, components.md and the canvas labels need a sweep.

---

## I. Things explicitly out of scope (do not re-open)

For sanity, these are decided and should NOT be reopened during implementation:

- **No Tony in any active capacity.** Archive only.
- **No Fork 2 / SMB unblocking** without a new owner decision. Today they are red.
- **No backend mutation by the design files.** All mocks are driven by `shared/gateway-data.js`.
- **No new colors.** The status grammar is locked. New states must reuse the existing palette.
- **No emoji proliferation.** Only 🔒 and ✓ are sanctioned in components.md.
- **No silent fallbacks.** Every failure has an explicit `result_code` and `blocked_reason`.

---

## Decision log

When a question above is resolved, append a row here with date, decider, decision, and which doc(s) were updated.

| Date | Question | Decision | Updated docs |
|---|---|---|---|
| _none yet_ | — | — | — |

---

## Hand-off note

Engineering should treat **A5, B1, C1, D1, E1, E2** as **must-decide-before-Phase-3** (the write/execute phase from the developer hand-off). Everything else can be deferred to Phase 4+ without blocking.

Designer (me) should be looped back when **G** items are picked up — those need new component variants, and the inventory in `components.md` needs an update at that point.
