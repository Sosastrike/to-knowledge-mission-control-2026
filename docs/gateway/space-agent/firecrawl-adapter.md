# Space Agent Firecrawl Adapter

Last verified: 2026-05-06

## Purpose

The Space Agent Firecrawl adapter is a Gateway-routed research adapter for public web discovery, page extraction, crawl mapping, and structured evidence collection. It supports research packets only. It does not make final owner decisions, perform delivery, run workflow actions, or bypass Gateway policy.

## Ownership

- Owner: final authority.
- Gateway: route, policy, audit, and registry authority.
- Agent Zero: commander and final operational decision maker.
- Hermes: skill and workflow designer.
- Pi: dispatcher candidate and route advisor.
- Space Agent: browser, web, YouTube, and Firecrawl research specialist.

## Supported Operations

- Search: discover candidate sources for a research question.
- Scrape: collect evidence from an approved URL.
- Crawl: inspect a bounded set of pages with strict depth and page limits.
- Map: summarize site structure when safe.
- Extract: collect structured fields from approved source URLs.
- Browser interaction: gated read-only page inspection when a safe browser path is configured.

## Required Inputs

Every Firecrawl request must include:

- request purpose
- responsible supervisor
- source URL or query
- allowed scope
- expected output format
- policy posture

Crawl requests must also include hard page and depth limits. Extract requests must include a narrow schema with field descriptions.

## Output Contract

The adapter returns a Research Packet with:

- job id
- original request summary
- responsible supervisor
- source list
- findings
- confidence
- evidence snippets
- citations or URLs
- blockers
- recommended next agent

Screenshot output must use Gateway-managed references, not local filesystem paths.

## Security

- No secrets in prompts, responses, logs, or reports.
- No owner credentials unless explicitly approved for the exact research scope.
- No external writes.
- No login-boundary bypass.
- No paywall bypass.
- No private account scraping without explicit approval.
- No raw provider traceback in owner-facing output.

## Bridge Session

Discovery and status are read-only. External writes are not part of this adapter. Any future browser action with side effects must be routed through Gateway policy and an approved Bridge Session before it can run.

## Blocked States

The adapter must return blocked instead of fake success when:

- Firecrawl credential source is missing.
- Firecrawl backend adapter is not configured.
- URL is private, paywalled, or login-boundary protected.
- Crawl scope is broad or unbounded.
- Requested action is not research.
- Rate limit prevents useful collection.
