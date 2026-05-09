# @cloudcode/backend-support

Backend-only helpers that hand Codex a clean truth surface for the Mission
Control / Gateway dashboard. Codex still owns the 100-day plan and the UI;
this package is pure infrastructure — no UI, no service execution, no writes.

## Why this exists

`/api/gateway/status` was returning raw JSON and the UI was guessing. Agent
and tool statuses were showing fake LIVE labels. Route smoke was confusing.
This package gives Codex:

1. A canonical status normalizer that maps every legacy label
   (`BACKEND_REQUIRED`, `CREDENTIAL_REQUIRED`, `OWNER_APPROVAL_REQUIRED`,
   `pending_approval`, …) onto exactly **ten** owner-facing labels:
   `LIVE`, `READY`, `READ_ONLY`, `DEGRADED`, `OWNER_GATED`, `CREDENTIAL_GATED`,
   `SERVICE_DOWN`, `BLOCKED`, `DISABLED`, `UNKNOWN`.
2. A route-smoke helper that probes Mission Control / Gateway routes,
   classifies each result, and never leaks private hosts or secrets.
3. An agent-health contract built from the spec roster (Agent Zero, Hermes,
   Pi, Paperclip, OpenClaw+, three SpaceAgents). Missing service →
   `SERVICE_DOWN`, missing creds → `CREDENTIAL_GATED`, missing adapter →
   `BLOCKED`, missing owner login → `OWNER_GATED`. Never fakes health.
4. A static route metadata map for back / home / breadcrumb wiring.
5. A read-only Build-Wiki / OpenCloud-Docs Farmer status helper. Service
   name is fixed: `opencloud-docs-farmer.service`. The `Run Now` gate is
   approval-only — this package never calls `systemctl`.
6. An error classifier that maps raw signals onto the canonical error
   kinds (`OWNER_GATED`, `CREDENTIAL_GATED`, `SERVICE_DOWN`,
   `BACKEND_MISSING`, `ROUTE_MISSING`, `AUTH_REQUIRED`,
   `EXECUTION_DISABLED`, `WRITE_DISABLED`, `EXTERNAL_WRITE_DISABLED`,
   `UNKNOWN`).

Every output runs through a redactor: no secrets, no `/home/...`, no
`/Users/...`, no private IP/port strings.

## Layout

```
backend-support/
├── package.json               local devDeps only (typescript, vitest, @types/node)
├── tsconfig.json              strict TS, ES2022, declaration output
├── vitest.config.ts
├── src/
│   ├── index.ts               public surface — what Codex imports
│   ├── types.ts               canonical statuses, error kinds, contracts
│   ├── label-map.ts           legacy-label → canonical, severity rollup
│   ├── redact.ts              secret + path + private-host redaction
│   ├── status-normalizer.ts   /api/gateway/status normalizer (Task 1)
│   ├── route-smoke.ts         route-smoke helper + pure builder (Task 2)
│   ├── agent-probes.ts        AGENT_ROSTER + buildAgentHealth (Task 3)
│   ├── route-metadata.ts      back/home/breadcrumb data (Task 4)
│   ├── buildwiki-status.ts    farmer + run-now gate (Task 5)
│   ├── error-classifier.ts    canonical error classifier (Task 6)
│   └── __tests__/             vitest suites (Task 7)
├── scripts/
│   └── route-smoke.cli.mjs    runnable CLI; outputs JSON only
└── proof/                     typecheck / vitest / cli output captures
```

## Usage from Codex

```ts
import {
  normalizeGatewayStatus,
  buildAgentHealth,
  buildBuildWikiStatus,
  evaluateRunNowGate,
  classifyErrors,
  buildRouteSmokeReport,
  ROUTE_METADATA,
  getBreadcrumbTrail,
} from '@cloudcode/backend-support'

// Inside the existing /api/gateway/status route handler:
const raw = await collectRawStatus()           // Codex's existing logic
const snapshot = normalizeGatewayStatus(raw)   // safe to render directly
return Response.json(snapshot)
```

## Local commands

```bash
cd backend-support
npm install          # local-only devDeps
npm run typecheck    # tsc --noEmit
npm run test         # vitest run (104 tests)
npm run build        # emit dist/ for the CLI
node scripts/route-smoke.cli.mjs --base https://mc.example.com
```

## What this package will NOT do

- No execution. No `systemctl`. No `child_process.spawn`.
- No external writes. No Zapier writes. No Gmail / Slack / YouTube farmers.
- No `.env` reads or writes.
- No SMB. No Fork 2 of any farmer.
- No fake LIVE — when `execution_enabled=false` every LIVE/READY status is
  downgraded to READ_ONLY before it leaves the normalizer.
- No raw paths or private hosts in any output.

If a future module needs any of the above, that is a Codex / 100-day-plan
decision, not a CloudCode patch.
