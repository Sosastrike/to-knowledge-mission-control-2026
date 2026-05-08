# Phase PI-4 — Pi Shadow Routing Proof Report

Generated: 2026-05-07 21:38:52

## Result

**PARTIAL GO / shadow routing proven.** Pi route recommendations were tested in-process and remain advisory only. Pi does not execute, write, bypass Gateway, or override Agent Zero.

## Route Matrix

| Request type | Expected route | Result |
| --- | --- | --- |
| Web/browser research | SpaceAgent | PASS |
| Firecrawl/search/scrape | SpaceAgent + Firecrawl, blocked if credential missing | PASS: blocked with `firecrawl_credential_required` |
| YouTube transcript | SpaceAgent + YouTube connector | PASS |
| Workflow/skill design | Hermes | PASS |
| Workforce/task/co-worker | Paperclip | PASS: gated with `paperclip_task_write_requires_bridge_session` |
| Runtime/skill/mini-agent execution | OpenClaw+ through Gateway / Bridge Session | PASS: gated with `openclaw_runtime_execution_requires_bridge_session` |
| Report delivery | Delivery adapter through Gateway / Bridge Session | PASS: gated with `delivery_adapter_requires_bridge_session_and_configured_connector` |
| Unknown connector | blocked | PASS: `unknown_connector_not_registered` |

## Controls

- Pi recommends only.
- Pi does not execute.
- Pi does not write.
- Pi does not bypass Gateway.
- Gateway remains policy authority.
- Agent Zero remains commander.

## Tests Passed

`src/lib/gateway-pi-dispatcher.test.ts`: 9 tests passed, including the production route matrix.
