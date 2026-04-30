# Mission Control Internal Server Error Fix Report

Date: 2026-04-30

## Issue
The owner saw `Internal Server Error` at the TKMC designer route after login. Live logs showed repeated Next.js standalone errors:

- `InvariantError: The client reference manifest for route "/[[...panel]]" does not exist`
- fallback `/500` static page was also missing in the standalone bundle

## Root Cause
The authenticated root/catch-all route `src/app/[[...panel]]/page.tsx` used a server-component redirect. In the standalone runtime, that catch-all page path triggered a Next.js client-reference-manifest lookup failure. This affected `/`, `/mission`, and any catch-all panel alias that should have redirected into the designer Mission Control HTML.

The designer static file itself was healthy. Direct checks to `/designer-mission-control/Mission%20Control.html?page=mission` returned 200.

## Fix Applied
Replaced page-based redirects with route-handler redirects:

- `src/app/[[...panel]]/page.tsx` removed
- `src/app/[[...panel]]/route.ts` added
- `src/app/agents/page.tsx` removed
- `src/app/agents/route.ts` added

The new route handlers return clean 307 redirects with relative `Location` headers so public traffic stays on `https://tkmc.knowledge-vs-ai.com` instead of leaking `localhost:3337`.

## Verification
- `pnpm run build`: passed
- `pnpm run typecheck`: passed after build regenerated `.next/types`
- `mission-control.service`: active
- `GET https://tkmc.knowledge-vs-ai.com/login`: 200
- Authenticated `GET https://tkmc.knowledge-vs-ai.com/` follows to designer Mission Control: 200
- Authenticated `GET https://tkmc.knowledge-vs-ai.com/agents` follows to Agent Network designer page: 200
- Direct designer route: 200
- Local health: `GET /api/status?action=health`: 200 healthy
- Post-restart log scan found no new `InvariantError` or `Internal Server Error` entries.

## Safety Confirmation
- `.env` unchanged
- No secrets printed or changed
- No connector execution enabled
- No Zapier writes executed
- Tony routing, voice, memory, and governance unchanged
- No Cloudflare, Caddy, firewall, or Docker exposure changes

## Rollback
Restore the previous page-based redirects from git if needed:

```bash
git checkout HEAD~1 -- src/app/[[...panel]] src/app/agents
pnpm run build
sudo systemctl restart mission-control.service
```
