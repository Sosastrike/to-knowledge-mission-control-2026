# Agent Hub — Playwright MCP update (v2)

**Date:** 2026-05-07
**Scope:** Design-only. No production code changed.

## What's new

Added a **Browser Automation** section to the SpaceAgent panel inside
Agent Hub. Section renders only when SpaceAgent is the active agent.

### Files touched
- `Agent Hub.html` — added Browser Automation block + CSS for `.ba-*` classes
- `shared/agent-data.js` — added `browserAutomation` mock; updated SpaceAgent role/tools to mention Playwright MCP

## Source of truth (unchanged)
- SpaceAgent stays **pending until installed/proven**
- Playwright MCP stays **gray / not installed** until developer proves the service
- If installed but no Bridge Session open, **interactive actions are yellow / gated**
- Playwright MCP is **not the agent**. SpaceAgent is the agent. Playwright MCP is the browser automation tool used by SpaceAgent through Gateway policy.

## Primary tools shown on the SpaceAgent panel
| Tool | Role |
|---|---|
| Firecrawl | search / scrape / crawl / extract |
| Playwright MCP | live browser automation · UI verification · screenshots · console · network · forms |
| YouTube research | transcript / metadata / summary / evidence packet |

## Playwright MCP card — fields rendered
- Installed (yes/no)
- MCP endpoint (localhost only)
- Browser mode (headless / headed / isolated)
- Last browser job
- Last screenshot
- Last accessibility snapshot
- Last console capture
- Last network capture
- Requires Bridge Session (yes/no)
- Blocked reason (if any)
- Gated reason (if any)

## Status state legend
- **green** — connected
- **yellow** — gated · Bridge Session required
- **blue** — read-only
- **red** — blocked
- **gray** — not installed

## Buttons (UI only — none wired to live calls)
**Safe owner actions**
- Check Playwright MCP status
- Open last browser evidence packet
- Run Mission Control UI smoke

**Gated · Bridge Session required**
- Start browser session
- Interactive browser action
- Authenticated browsing (owner approval required)

## What developer needs to do (when ready)
1. Stand up Playwright MCP locally; expose health endpoint.
2. Wire the three **safe** buttons to read-only checks (status + last evidence packet + UI smoke).
3. Wire the three **gated** buttons through the existing Bridge Session flow already in `Bridge Session Flow.html`.
4. Flip `browserAutomation['space-agent'].primary_tools[1].installed` to `true` and `status` to `'yellow'` once the service is proven; auto-promote to `'green'` while a Bridge Session is open.

## How to load
Open `Agent Hub.html` in any modern browser. No build step.
The page is an HTML mock — `shared/agent-data.js` is the data source.
