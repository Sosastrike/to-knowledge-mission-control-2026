# Space Agent API Routes Report

Generated: 2026-05-06

## Scope

Phases 191-200 add protected Mission Control API routes for Space Agent Gateway node detail, Bridge status, safe test chat, research packet planning, and job lookup.

## Routes

- `GET /api/gateway/nodes/space-agent`
- `GET /api/bridge/space-agent/status`
- `POST /api/bridge/space-agent/test-chat`
- `POST /api/gateway/space-agent/research`
- `GET /api/gateway/space-agent/jobs/:id`

## Safety

- All routes require Mission Control auth.
- Unauthenticated calls return 401 or 403.
- Space Agent live chat is not faked. Test chat returns `space_agent_called: false` until a safe runtime adapter is configured.
- Research route creates a read-only Research Packet only.
- Research execution, browser execution, Firecrawl execution, external writes, uploads, Zapier writes, HeyGen generation, SMB, and farmer actions remain disabled.
- Protected browser/private-content requests return blocked status until a scoped Bridge Session exists.
- API payloads are redacted for secret-shaped text and raw local paths.

## Validation

- `git diff --check`: passed
- Focused Space Agent route tests: passed, 2 files / 5 tests
- Gateway route auth tests: passed in focused and full suites
- `pnpm run typecheck`: passed
- `pnpm run build`: passed
- `pnpm test`: passed, 119 files / 1,151 tests
- Staged no-secrets scan: required before commit

## Blockers

- Space Agent live runtime adapter remains intentionally unconfigured. `POST /api/bridge/space-agent/test-chat` returns a safe blocked response with `space_agent_called: false`; it does not fake live access.
- Live browser, Firecrawl, YouTube, upload, send, Zapier, HeyGen, SMB, farmer, and other external actions remain disabled until a scoped Bridge Session and a safe adapter exist.
