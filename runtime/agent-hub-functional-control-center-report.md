# Agent Hub Functional Control Center Report

Status: PARTIAL GO - deployed to production runtime, owner browser confirmation still required.

## Scope Completed

- Converted Agent Hub access behavior from raw link inventory toward an owner control center.
- Added human-readable Gateway control surfaces:
  - `/gateway/tools`
  - `/gateway/brain`
  - `/gateway/agent-hub/agent-zero/config`
  - `/gateway/agent-hub/agent-zero/chat`
  - `/gateway/agent-hub/hermes/config`
  - `/gateway/agent-hub/hermes/chat`
  - `/gateway/agent-hub/pi/config`
  - `/gateway/agent-hub/pi/recommend`
  - `/gateway/agent-hub/spaceagent/config`
  - `/gateway/agent-hub/spaceagent/research`
  - `/gateway/agent-hub/paperclip/config`
  - `/gateway/agent-hub/openclaw/config`
- Kept JSON endpoints as machine APIs. Owner buttons now navigate to readable Gateway pages instead of opening raw JSON dumps.
- Updated action routing:
  - Open UI uses safe external opens for real owner URLs.
  - Open Config uses agent-specific Gateway pages.
  - Open Brain uses the Gateway brain page or a blocker.
  - Open Chat/Recommend/Research uses implemented control pages.
  - Open Tools uses `/gateway/tools`.
  - Health uses readable control pages backed by JSON fetches.
- Protected execution verbs remain Bridge-gated.

## Agent Results

| Agent/surface | Owner UI behavior | Config/status behavior | Current truthful status |
| --- | --- | --- | --- |
| Agent Zero | Opens `http://100.116.35.95:50080/` in a new tab | `/gateway/agent-hub/agent-zero/config` | Partial, UI restored, fd guard pending |
| Hermes | No public UI exposed | `/gateway/agent-hub/hermes/config` and `/gateway/agent-hub/hermes/chat` | Partial, local service/adapter proven, owner proxy not wired |
| Pi | No fake standalone UI | `/gateway/agent-hub/pi/config` and `/gateway/agent-hub/pi/recommend` | Advisory, runtime not proven |
| SpaceAgent | No fake standalone UI | `/gateway/agent-hub/spaceagent/config` and `/gateway/agent-hub/spaceagent/research` | Partial, Mission Control panel only, Playwright local-only |
| Paperclip | Opens `http://100.116.35.95:3100/` in a new tab | `/gateway/agent-hub/paperclip/config` | Partial, Tailnet UI reachable, owner company claim required |
| OpenClaw+ | Uses existing owner tunnel `http://127.0.0.1:18789/` | `/gateway/agent-hub/openclaw/config` | Tunnel live, doctor CLI blocked |
| Firecrawl | No fake UI | Status visible through SpaceAgent/tools surfaces | Blocked by credential/backend |
| YouTube | No fake UI | Status visible through SpaceAgent/tools surfaces | Limited/blocked until transcript proof |
| Delivery connectors | No fake UI | Readiness/status only | Sends/uploads remain Bridge-gated and credential-gated |

## Files Changed

- `gateway-dropin/next.config.mjs`
- `gateway-dropin/src/app/gateway/page.tsx`
- `gateway-dropin/src/components/gateway/GatewayShell.tsx`
- `gateway-dropin/src/components/gateway/gateway-actions.ts`
- `gateway-dropin/src/components/gateway/gateway-status-contracts.ts`
- `gateway-dropin/tests/gateway-shell.test.ts`
- `gateway-dropin/tests/gateway-status-contracts.test.ts`

## Validation

- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm --dir gateway-dropin run typecheck`: passed.
- `pnpm --dir gateway-dropin run build`: passed.
- `pnpm --dir gateway-dropin test`: passed, 48 tests.
- `pnpm run safety:ui-actions`: passed.
- `pnpm --dir gateway-dropin run design-lock:verify`: passed.
- Protected-file invariant scan: passed.
- `.env` diff check: passed.
- Scoped secret scan on changed files: passed.

Note: root `pnpm test` is not available in this repository because the root package has no `test` script.

## Local Commit

Functional local commit:

- `15a701a55908b27235dfa0ff5010ffefb5630278`

Production commits created on server:

- `921e6d2` - gateway-dropin control-center files and reports.
- `b3f3212` - root production Gateway shell port, which is the code path used by the live `/gateway` route.

The production runtime needed the root shell port because the live Mission Control `/gateway` route imports `src/components/gateway/GatewayShell.tsx`, not only `gateway-dropin/src/components/gateway/GatewayShell.tsx`.

## Remaining Blockers

- Owner must confirm the authenticated production browser shows the Agent Control Center. Unauthenticated route smoke correctly redirects protected Gateway routes to `/login`.
- Paperclip company access still requires an official owner company membership/claim/bootstrap path.
- Hermes owner proxy/chat remains a safe Mission Control panel, not a public local service.
- Pi runtime is not proven and is intentionally not faked.
- Firecrawl, YouTube, and delivery connector live execution remain credential/backend/OAuth gated.

## Final Local Recommendation

Have the owner hard-refresh and retest `/gateway/agent-hub` and the new control pages. Do not call final GO until the owner confirms the production browser shows the fixed Agent Control Center.
