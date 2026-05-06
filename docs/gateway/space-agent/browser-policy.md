# Space Agent Browser Policy

Last verified: 2026-05-06

## Purpose

Browser work stays inside Space Agent and produces evidence only. Gateway routes browser research to Space Agent when a request requires page state, website inspection, screenshot references, JavaScript-heavy pages, or interactive read-only exploration.

## Allowed By Default

- open a public or owner-approved page
- inspect page text
- collect metadata
- summarize visible evidence
- capture a screenshot reference when tooling allows it
- report blocked state when a site cannot be accessed safely

## Blocked By Default

- login with owner credentials
- bypass a paywall
- solve captcha
- scrape private accounts
- submit forms
- post comments
- purchase, upload, send, delete, or mutate anything
- download copyrighted videos
- run broad crawling without a bounded scope

## Required Action Log

Every browser action summary must include:

- URL
- timestamp
- action type
- WebResearchIntent id
- evidence returned
- blocker when blocked

The action log must not contain secrets, cookies, session tokens, local paths, raw auth files, or provider traces.

## Bridge Session

Read-only inspection can run under read-only Gateway policy if the adapter is configured. Any browser action that could mutate state requires an explicit Bridge Session scope and protected-action approval.

## Failure Behavior

If a browser task cannot be completed safely, Space Agent returns an exact blocker and hands the task back through Gateway. It must not say done unless evidence was actually collected.
