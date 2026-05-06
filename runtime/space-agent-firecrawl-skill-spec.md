# Space Agent Firecrawl Skill Spec

Generated: 2026-05-06
Scope: Phases 101-110. Specification only. No Firecrawl call, browser action, external write, service change, or credential change was performed.

## Executive Summary

Space Agent Firecrawl is a Gateway-routed research skill for live web discovery and page evidence collection. It is subordinate to Gateway policy and Agent Zero supervision. It does not replace Agent Zero, Hermes, Pi, OpenCloud, OpenClaw+, Bridge/MCP, Brain, or existing agents.

Current status: blocked until the Gateway Firecrawl credential source and backend adapter are configured. The skill remains safe to expose as a planned/read-only capability because every operation must return a blocked result instead of fake access when configuration is missing.

## Phase 101 - Skill Identity

Skill id: `space_agent_firecrawl_research`

Display name: Space Agent Firecrawl Research

Primary agent: Space Agent

Supervisors: Agent Zero, Hermes, Pi through Gateway route decisions

Purpose: use Firecrawl-backed search, scrape, crawl, map, extract, and browser-interaction research to create structured Research Packets for the responsible agent.

Execution posture:

- Discovery and planning are read-only.
- Firecrawl operations require a configured Firecrawl credential and approved Gateway adapter.
- Browser-interaction mode remains gated and disabled unless explicitly configured.
- External writes are not part of this skill.
- Owner-facing answers must not claim success unless a real operation completed.

## Phase 102 - Search Inputs

Search operation: `firecrawl_search`

Required inputs:

- `query`: natural-language search query.
- `purpose`: why the search is needed.
- `requester`: owner, Agent Zero, Hermes, Pi, or Gateway.
- `responsible_agent`: agent that receives the Research Packet after research.

Optional inputs:

- `limit`: maximum result count.
- `allowed_domains`: owner-approved domains to prefer or restrict to.
- `blocked_domains`: domains to exclude.
- `recency`: requested freshness window when relevant.
- `language`: preferred language.

Validation rules:

- Empty queries are blocked.
- Private, paywalled, credentialed, or login-boundary searches require owner-approved scope.
- Search returns candidate sources and evidence summaries only; it does not execute writes.

## Phase 103 - Scrape Inputs

Scrape operation: `firecrawl_scrape`

Required inputs:

- `url`: public or owner-approved page URL.
- `purpose`: what evidence should be collected.
- `requested_formats`: markdown, HTML summary, metadata, screenshot reference, or JSON where supported.

Optional inputs:

- `wait_for_selector`: selector to wait for when configured and safe.
- `include_links`: whether page links should be summarized.
- `include_images`: whether image metadata should be summarized.
- `main_content_only`: default true.

Validation rules:

- Private, login-only, or paywalled URLs are blocked unless owner-approved scope exists.
- Scrape must return page evidence, not a final owner decision.
- Raw page dumps should be summarized unless the responsible agent explicitly needs a specific excerpt.

## Phase 104 - Crawl Inputs

Crawl operation: `firecrawl_crawl`

Required inputs:

- `start_url`: public or owner-approved starting URL.
- `purpose`: crawl objective.
- `max_pages`: hard page limit.
- `max_depth`: hard depth limit.

Optional inputs:

- `allowed_paths`: URL path prefixes allowed for the crawl.
- `excluded_paths`: URL path prefixes blocked from the crawl.
- `include_sitemap`: whether sitemap discovery is allowed.
- `same_domain_only`: default true.

Validation rules:

- Crawls require strict limits before execution.
- Broad, unbounded, credentialed, or private crawls are blocked.
- The Research Packet must include crawl boundaries and any skipped or blocked areas.

## Phase 105 - Extract Schema Inputs

Extract operation: `firecrawl_extract`

Required inputs:

- `source_urls`: one or more public or owner-approved URLs.
- `schema_name`: short name for the extraction schema.
- `schema`: JSON-compatible field definition for extraction.
- `purpose`: why structured extraction is needed.

Schema field requirements:

- `field`: stable field name.
- `type`: string, number, boolean, date, enum, array, or object.
- `description`: what the field means.
- `required`: true or false.
- `source_hint`: optional selector, page section, or semantic hint.

Validation rules:

- Extraction schemas must be narrow and task-specific.
- The skill must distinguish observed facts from inferred fields.
- Missing fields must be returned as null with a blocked or not-found reason, not invented.

## Phase 106 - Browser Interaction Inputs

Browser interaction operation: `firecrawl_interact_browser`

Required inputs:

- `url`: public or owner-approved page URL.
- `objective`: inspection objective.
- `allowed_actions`: explicit allowlist such as open, navigate, inspect, screenshot, extract, or page_state.

Optional inputs:

- `steps`: planned read-only interaction steps.
- `screenshot_required`: whether a screenshot reference should be returned.
- `selectors`: selectors to inspect.

Validation rules:

- Browser interaction is disabled by default.
- Login, form submission, purchase, upload, post, comment, account changes, or destructive actions are blocked.
- Any interaction beyond read-only inspection requires Bridge Session scope and a separate approval.

## Phase 107 - Output Format

The skill returns a Research Packet, not a final owner-facing decision.

Required packet fields:

- `packet_id`
- `skill_id`
- `operation`
- `status`: ready, completed, blocked, partial, or failed.
- `requested_by`
- `responsible_agent`
- `source_urls`
- `findings_markdown`
- `evidence_json`
- `citations`
- `screenshot_references`
- `blocked_reason`
- `rate_limit_status`
- `retry_summary`
- `no_secrets_exposed`
- `no_raw_paths`

Markdown output rules:

- Summarize findings in concise bullet points.
- Label uncertainty clearly.
- Label blocked or unavailable sources.
- Include source URLs for evidence.

JSON output rules:

- Use stable field names.
- Use null for missing data.
- Include confidence per evidence item.
- Include `source_url` and `collected_at` per evidence item.

Screenshot reference rules:

- Return a safe reference ID or Gateway-managed attachment reference.
- Do not expose local filesystem paths.
- Do not claim a screenshot exists if capture failed or was blocked.

## Phase 108 - Rate-Limit Handling

Rate-limit response contract:

- Set status to `partial` or `blocked` depending on whether useful evidence was collected.
- Set `blocked_reason` to `firecrawl_rate_limited` when no further calls are allowed.
- Include `retry_after` when the provider returns a safe retry hint.
- Do not spin or retry indefinitely.

Default limits before adapter tuning:

- Search: one request per owner task unless Gateway policy expands scope.
- Scrape: one page per task by default.
- Crawl: requires explicit `max_pages` and `max_depth`.
- Extract: limited to explicitly provided source URLs.
- Browser interaction: blocked unless configured.

## Phase 109 - Retry Handling

Retry policy:

- Retry only transient network, timeout, and provider 5xx errors.
- Do not retry credential, auth, policy, private-boundary, paywall, or forbidden-action failures.
- Maximum retries: two after the first failed attempt unless Gateway policy lowers the limit.
- Use backoff between retries.
- Record each retry in `retry_summary` without exposing headers, tokens, or raw provider traces.

Failure response:

- Return the best partial evidence when available.
- Return a precise blocker when unavailable.
- Do not say Done unless the requested operation actually completed.

## Phase 110 - Evidence Citation Rules

Every finding must trace back to evidence.

Citation requirements:

- Cite the source URL for web evidence.
- Cite page title or domain when available.
- Include collected timestamp.
- Use short excerpts only when needed and keep them minimal.
- Separate direct observations from inferred conclusions.
- Mark low-confidence findings.
- Mark inaccessible, blocked, paywalled, or login-boundary sources.

Disallowed citation behavior:

- No fabricated citations.
- No stale snapshot citation if live access failed.
- No raw auth headers, cookies, tokens, or credential file names.
- No local runtime paths in owner-facing output.

## Gateway Policy Summary

Allowed without Bridge Session:

- Registry discovery.
- Skill planning.
- Blocked-state reporting.
- Research Packet shaping from already-approved evidence.

Requires configured Firecrawl credential and adapter:

- Search.
- Scrape.
- Crawl.
- Map.
- Extract.

Requires additional approval or remains blocked:

- Browser interaction.
- Login-boundary inspection.
- Any action that writes, submits, uploads, posts, purchases, changes state, or uses private credentials.

## No-Secrets Confirmation

- No Firecrawl key was printed.
- No credential value was read into this report.
- No `.env` file was modified.
- No Firecrawl operation was executed.
- No browser interaction was executed.
