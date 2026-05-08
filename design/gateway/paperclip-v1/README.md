# Agent-Hub-Paperclip-v1-FINAL

Design package for Mission Control → Gateway → Agent Hub / Control Center.

## Files

- **Agent Hub.html** — unified 5-agent control center (Paperclip · Agent Zero · Hermes · SpaceAgent · Pi-mono).
- **Paperclip.html** — Workforce Control Plane drill-down. Sits before OpenClaw+.
- **shared/agent-data.js** — MOCK data driving both pages. Engineering replaces with real Gateway registry/status data.
- **shared/tokens.css** — locked Gateway design tokens. Do not modify.
- **shared/node-card.css** — node-card styles shared with the rest of the Gateway sprint.
- **developer-handoff.md** — full engineering brief: scope, API routes, hard rules, 18-phase rollout plan.
- **index.html** — sprint index (entry page).

## Status
Design complete and accepted. Package ready for engineering implementation.
Repo grounding pending — public repo access not available in design environment.

## Architecture order (locked)
Owner → Gateway → Agent Zero / Pi / Hermes → **Paperclip** → OpenClaw+ → mini-agents · skills · tools.

## Hard rules
See `developer-handoff.md` Appendix A.
