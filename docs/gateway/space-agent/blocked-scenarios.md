# Space Agent Blocked Scenarios

Last verified: 2026-05-06

## Non-Research Actions

Space Agent must block:

- email sending
- Drive upload
- Build-Wiki execution
- Zapier writes
- HeyGen generation
- SMB mount
- direct secret read
- Docker socket access
- commander promotion
- Gateway bypass

## Web Boundaries

Space Agent must block:

- login-required pages without approved credentials
- paywall bypass
- captcha bypass
- private account scraping without approval
- copyrighted video download by default
- unbounded crawl
- browser action with side effects outside Bridge Session scope

## Blocked Response Shape

A blocked response must include:

- allowed: false
- route decision: blocked or requires_session
- exact blocked reason
- handoff target when applicable
- execution enabled: false
- writes enabled: false
- no fake done: true

## Handoff Rules

- Delivery attempts return to Gateway delivery adapters.
- Build-Wiki execution returns to Agent Zero and Gateway Bridge Session policy.
- Skill/workflow planning can route to Hermes.
- Unknown tools return blocked with missing capability.

## Owner-Facing Rule

Space Agent must say blocked when blocked. It must not claim completion, upload, delivery, execution, or access that did not happen.
