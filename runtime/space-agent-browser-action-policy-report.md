# Space Agent Browser Action Policy Report

Generated: 2026-05-06
Scope: Phases 111-120. Gateway/Space Agent browser action policy only. No browser action, Firecrawl call, external write, service change, or credential change was performed.

## Summary

Browser work remains inside Space Agent and returns evidence packets only. The implementation now requires each browser action summary to attach to a WebResearchIntent, record URL, timestamp, and action type, and return explicit blockers for disallowed actions.

## Phase Results

| Phase | Result |
| --- | --- |
| 111 | Browser action summaries now include `web_research_intent_id`, tying each action to the Gateway WebResearchIntent. |
| 112 | Owner credentials are not used by browser actions; credential use returns `owner_credentials_not_approved`. |
| 113 | Paywall bypass requests return `paywall_bypass_not_allowed`. |
| 114 | Private account scraping returns `private_account_scrape_not_approved`. |
| 115 | Copyrighted video download requests return `copyrighted_video_download_blocked_by_default`. |
| 116 | Allowed capture is limited to page text, screenshot reference, and metadata. |
| 117 | Browser summaries log URL, timestamp, and action type. |
| 118 | Browser summaries set `returns_evidence: true` and `hidden_state_returned: false`. |
| 119 | Browser policy failures return exact blocker strings. |
| 120 | Browser work is marked `stays_inside_space_agent: true`; Gateway return route still hands responsibility back to the responsible agent. |

## Policy Fields Added

BrowserActionSummary now includes:

- `web_research_intent_id`
- `url`
- `timestamp`
- `action_type`
- `uses_owner_credentials`
- `owner_credentials_approved`
- `paywall_bypass_allowed`
- `private_account_scrape_allowed`
- `copyrighted_video_download_allowed`
- `allowed_capture`
- `returns_evidence`
- `hidden_state_returned`
- `stays_inside_space_agent`
- `exact_blocker`

SpaceAgentPolicy now includes:

- `owner_credentials_for_browser_requires_approval`
- `copyrighted_video_download_blocked_by_default`

## Exact Blockers

- `owner_credentials_not_approved`
- `paywall_bypass_not_allowed`
- `private_account_scrape_not_approved`
- `copyrighted_video_download_blocked_by_default`

## Safety Confirmation

- No owner credentials were used.
- No paywall was accessed or bypassed.
- No private account was scraped.
- No copyrighted video was downloaded.
- No browser action was executed.
- No Firecrawl call was executed.
- No `.env` file was changed.
- No secrets were printed.
- No external write was performed.

## Tests

Added focused tests for WebResearchIntent attachment, browser logging, allowed capture fields, evidence-only output, Space Agent containment, and exact blockers for disallowed browser actions.
