# Space Agent Web Scenario Test Report

Generated: 2026-05-06

## Scope

Phases 211-220 add read-only Gateway/Space Agent tests for common web research scenarios. No live browser, Firecrawl, YouTube, crawl, scrape, search, or external network action was executed.

## Scenario Coverage

- Phase 211, simple website read: covered as read-only page extraction.
- Phase 212, JavaScript-heavy page: covered as Firecrawl scrape planning when Firecrawl is configured in registry/test context.
- Phase 213, article extraction: covered as read-only page extraction.
- Phase 214, product page extraction: covered as read-only page extraction.
- Phase 215, pricing page extraction: covered as read-only page extraction.
- Phase 216, multi-page crawl: covered as Firecrawl crawl planning.
- Phase 217, site map: covered as Firecrawl map planning.
- Phase 218, search query: covered as web search planning.
- Phase 219, blocked URL: covered with unsafe local/private URL blocker.
- Phase 220, invalid URL: covered with invalid URL blocker.

## Safety

- All tests produce Research Packets only.
- Space Agent execution remains disabled.
- Browser interaction remains disabled.
- External writes remain disabled.
- Firecrawl live execution remains disabled.
- Blocked/private/internal URLs are not retained as source URLs.
- Invalid URLs are not treated as citations.
- No secrets, auth files, tokens, `.env` values, raw local paths, Zapier writes, HeyGen generation, SMB, farmer execution, or external writes were used.

## Validation

- Focused Space Agent web scenario and research tests: passed, 2 files / 29 tests.
- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 121 files / 1,157 tests.
- Staged no-secrets scan: required before commit.
