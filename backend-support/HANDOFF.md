# CloudCode → Codex backend-support handoff

## Branch & coordination

- **Branch:** `cloudcode/backend-support-gateway-status` (created off
  `claude/fervent-montalcini-62fba8` inside this worktree)
- **Latest commit:** *to be filled by the commit step* — see `git log -1`
  on this branch after `git commit`.
- **Pushed:** No. Per the rules, this branch is not pushed automatically.
  Codex / Luis decides when to push and merge.
- **Files Codex was actively editing — left untouched:**
  - `remote-mc/src/app/...` (designer-mission-control proxy)
  - `remote-mission-control/AgentNetworkClient.tsx`
  - `remote-mission-control-edit/connector-readiness-route.ts`
  - `remote-mission-control-edit/build-wiki-run-now-route.ts`
  - `remote-claudeclaw/src/dashboard.ts`
  - everything under `tkmc-*`, `mission-control-*` source trees
- **Conflict policy:** if Codex needs the same surface, hand off the file
  by name and CloudCode will produce a patch instead.

## Files added / changed

All work lives under one new directory. Nothing existing was modified.

```
backend-support/
├── README.md                            (overview for future contributors)
├── HANDOFF.md                           (this file)
├── package.json                         (local devDeps only — typescript, vitest, @types/node)
├── package-lock.json
├── tsconfig.json                        (strict, ES2022, declaration output)
├── vitest.config.ts
├── .gitignore                           (node_modules, dist)
├── src/
│   ├── index.ts                         public barrel — Codex imports from here
│   ├── types.ts                         canonical statuses, error kinds, contracts
│   ├── label-map.ts                     legacy-label → canonical + severity rollup
│   ├── redact.ts                        secret / path / private-host redaction
│   ├── status-normalizer.ts             TASK 1 — /api/gateway/status normalizer
│   ├── route-smoke.ts                   TASK 2 — route smoke helper (probe + pure builder)
│   ├── agent-probes.ts                  TASK 3 — AGENT_ROSTER + buildAgentHealth
│   ├── route-metadata.ts                TASK 4 — back/home/breadcrumb metadata
│   ├── buildwiki-status.ts              TASK 5 — Build-Wiki / Run-Now read-only helpers
│   ├── error-classifier.ts              TASK 6 — canonical error classifier
│   └── __tests__/                       TASK 7 — vitest suites (9 files, 104 tests)
├── scripts/
│   └── route-smoke.cli.mjs              runnable CLI (JSON output, redacted)
└── proof/                               artifacts captured during this run
    ├── typecheck.txt                    tsc --noEmit (clean)
    ├── vitest.txt                       vitest run (104/104 passed)
    ├── build.txt                        tsc emit log
    ├── route-smoke.cli.txt              CLI run against an unreachable origin
    └── sample-snapshot.json             example normalized snapshot
```

## Endpoints / helpers added (consumable by Codex)

The package exports a stable, typed surface from `src/index.ts`:

| Export | Task | Purpose |
| --- | --- | --- |
| `normalizeGatewayStatus(raw)` | 1 | Convert any raw status payload into the `GatewayStatusSnapshot` contract. |
| `runRouteSmoke({ baseOrigin, … })` / `buildRouteSmokeReport(prefetched, …)` | 2 | Async or pure route-smoke report generation. |
| `AGENT_ROSTER`, `buildAgentHealth(probes, opts)` | 3 | Spec-locked agent roster + status derivation. |
| `ROUTE_METADATA`, `getRouteMetadata`, `getBreadcrumbTrail` | 4 | Static navigation map for the UI. |
| `buildBuildWikiStatus(raw)`, `evaluateRunNowGate(input)` | 5 | Read-only farmer status + Run-Now eligibility gate. |
| `classifyError(input)`, `classifyErrors(inputs)` | 6 | Canonical error classification. |
| `normalizeStatusLabel`, `rollupStatuses`, `redactObject`, `redactString`, `redactOrigin` | infra | Reusable primitives. |

**No new HTTP routes were added.** Codex chooses how/where to wire these
helpers (e.g. inside the existing `/api/gateway/status` handler, or in a
new helper endpoint) without introducing conflicts.

## Canonical contract (the truth surface)

```ts
GatewayStatusSnapshot {
  overall_status: CanonicalStatus
  generated_at: string                        // ISO
  execution_enabled: boolean
  writes_enabled: boolean
  external_writes_enabled: boolean
  safety_status: CanonicalStatus
  agents: ComponentStatus[]
  providers: ComponentStatus[]
  tools: ComponentStatus[]
  connectors: ComponentStatus[]
  bridge: BridgeStatus
  buildwiki_farmer: BuildWikiFarmerStatus     // service_name fixed to opencloud-docs-farmer.service
  blockers: ClassifiedError[]                 // canonical error kinds, dedup'd
  next_actions: string[]                      // ≤ 8 deduped CTAs for the UI
}

type CanonicalStatus =
  'LIVE' | 'READY' | 'READ_ONLY' | 'DEGRADED'
  | 'OWNER_GATED' | 'CREDENTIAL_GATED'
  | 'SERVICE_DOWN' | 'BLOCKED' | 'DISABLED' | 'UNKNOWN'

type CanonicalErrorKind =
  'OWNER_GATED' | 'CREDENTIAL_GATED' | 'SERVICE_DOWN'
  | 'BACKEND_MISSING' | 'ROUTE_MISSING' | 'AUTH_REQUIRED'
  | 'EXECUTION_DISABLED' | 'WRITE_DISABLED' | 'EXTERNAL_WRITE_DISABLED'
  | 'UNKNOWN'
```

Mapping table for legacy labels → canonical (full table in `src/label-map.ts`):

| Legacy / vendor | Canonical |
| --- | --- |
| `BACKEND_REQUIRED` | `BLOCKED` |
| `CREDENTIAL_REQUIRED` | `CREDENTIAL_GATED` |
| `OWNER_APPROVAL_REQUIRED` | `OWNER_GATED` |
| `pending_approval` | `OWNER_GATED` |
| `running` | `LIVE` |
| `completed` | `READY` |
| `denied` / `expired` | `BLOCKED` |
| `failed` | `DEGRADED` |
| `ECONNREFUSED` / `ENOTFOUND` / `down` | `SERVICE_DOWN` |
| anything unrecognised | `UNKNOWN` |

## Tests run

```
$ npm run typecheck
tsc --noEmit  →  exit 0  (no errors, see proof/typecheck.txt)

$ npm run test
RUN  v2.1.9
 ✓ src/__tests__/agent-probes.test.ts        (9 tests)
 ✓ src/__tests__/buildwiki-status.test.ts    (13 tests)
 ✓ src/__tests__/error-classifier.test.ts    (16 tests)
 ✓ src/__tests__/label-map.test.ts           (11 tests)
 ✓ src/__tests__/redact.test.ts              (11 tests)
 ✓ src/__tests__/route-metadata.test.ts      (9 tests)
 ✓ src/__tests__/route-smoke.test.ts         (11 tests)
 ✓ src/__tests__/safety.test.ts              (7 tests)   ← end-to-end leak audit
 ✓ src/__tests__/status-normalizer.test.ts   (17 tests)

 Test Files  9 passed (9)
 Tests       104 passed (104)
```

Categories covered:

- **Status normalization** — execution-gate downgrade, connector-readiness
  mapping, bridge state derivation, safety_status derivation, blocker
  inference, dedupe, fake-LIVE prevention.
- **Route smoke** — HTTP status classification (200/302→login/401/403/404/423/503),
  injected-fetch end-to-end, redacted base origin and redirect targets,
  graceful handling of network errors.
- **Agent probes** — roster integrity, SERVICE_DOWN / CREDENTIAL_GATED /
  BLOCKED / OWNER_GATED rules, READ_ONLY downgrade, blocker text redacted.
- **Route metadata** — every back/home/parent reference resolves to a known
  route; parameterised path matcher; full breadcrumb trail.
- **BuildWiki** — fixed `opencloud-docs-farmer.service`,
  `run_now_requires_owner_approval=true`, every UI state mapped, redaction
  of run summaries; Run-Now gate respects bridge readiness and pending
  requests.
- **Error classifier** — http-status path, message-pattern path, context
  path, dedupe, redaction.
- **End-to-end safety** — explicit leak audit across the public surface.

## Route-smoke results (against an unreachable origin)

The CLI was exercised against `http://127.0.0.1:65111` (no listener
running). Output (full report at `proof/route-smoke.cli.txt`):

- `base_origin_redacted` rendered as `http://[redacted-host]` — the port
  and IP do not appear in the output.
- All 10 routes classified as `SERVICE_DOWN` with `failure_reason: "fetch failed"`,
  zero false LIVE results.
- Codex can run the same CLI inside the production network with the real
  `--base` URL, optionally passing `--auth-header-env` to read a session
  token from env (the value is never echoed).

## Agent status results (from buildAgentHealth defaults)

Without probe data, every roster row reports `UNKNOWN` — the deliberate
default so the Agent Hub UI never silently lies. As soon as Codex feeds
real probes (systemd active state, credential-present-by-name, bridge
reachability) the rows promote to the appropriate canonical status.

## Blockers identified (for the existing live system)

These are the load-bearing reasons the Mission Control / Gateway dashboard
was misbehaving before this handoff. Each is now categorisable through the
classifier:

| Blocker | Kind | Codex can fix? | Owner action required? |
| --- | --- | --- | --- |
| `/api/gateway/status` returns raw JSON | `BACKEND_MISSING` (presentation layer) | Yes — wrap response with `normalizeGatewayStatus`. | No |
| Gateway pages have no reliable Back / Home | `BACKEND_MISSING` (nav data) | Yes — consume `ROUTE_METADATA` / `getBreadcrumbTrail`. | No |
| Gateway Route Smoke confused / errored | `BACKEND_MISSING` (helper missing) | Yes — wire `runRouteSmoke` / `buildRouteSmokeReport` into the existing UI panel. | No |
| Agent + tool statuses inconsistent | `BACKEND_MISSING` (normalizer absent) | Yes — feed every status through `normalizeGatewayStatus`. | No |
| Some agents show LIVE while execution disabled | `EXECUTION_DISABLED` mismatch | Yes — normalizer enforces the gate; just consume it. | No (status is owner-set) |
| Owner-facing UI has fake / unclear states | `BACKEND_MISSING` (label vocabulary) | Yes — restrict UI to `CANONICAL_STATUSES`. | No |

## Owner-gated items (require Luis or Tony action)

- BuildWiki `Run Now` request approval in Telegram.
- Owner toggling `execution_enabled`, `writes_enabled`, or
  `external_writes_enabled` in the safety panel.
- Owner sign-in for any route that returns 401 / redirect-to-login.

## Credential-gated items (require Luis to add by-name secret)

These appear in this worktree's `connector-readiness-route.ts` and feed
through the normalizer with `state: 'CREDENTIAL_REQUIRED'` →
`status: 'CREDENTIAL_GATED'`:

- `FIRECRAWL_API_KEY` (Mission Control's own service env)
- `ZAPIER_MCP_URL` / `ZAPIER_MCP_SERVER`
- `ZAPIER_ACCESS_TOKEN` / `ZAPIER_API_KEY`
- `N8N_BASE_URL` / `N8N_API_KEY`

The normalizer reports them by name only; values never appear in any
backend-support output.

## Service-down items (currently — based on local snapshots)

None confirmed by this CloudCode pass — there is no live network here.
Codex runs the route-smoke CLI against the real Mission Control origin
to fill this in. The default contract reports unreachable services as
`SERVICE_DOWN`, never `LIVE`.

## Recommended data contract for Codex UI

For each Mission Control / Gateway page, render directly from the
normalized snapshot:

- **Gateway Overview** → `overall_status`, `safety_status`, three flag
  pills (`execution_enabled`, `writes_enabled`, `external_writes_enabled`),
  the `next_actions` list (max 8), and a `blockers` list keyed by
  `kind` so the UI can pick the right CTA per row.
- **Agent Hub** → `agents` array; render `label`, `status` chip, `blocker`
  (when set), `next_action` (when set). `proof_available` controls the
  "View proof" link.
- **Connectors / Tools** → `connectors` and `tools` arrays, same pattern.
- **Bridge / Run-Now panel** → `bridge` block + `buildwiki_farmer` block.
  The Run-Now button calls `evaluateRunNowGate` and enables only when
  `run_now_button_enabled === true`.
- **Route Smoke** → `RouteSmokeReport.routes` rows with `status_label`
  driving the chip color; never render `actual_http_status` as the
  primary indicator.

## Rollback command

This work is a single new directory on a separate branch. Two safe
rollback shapes:

```bash
# Option A — leave the branch, drop the directory in main:
git checkout cloudcode/backend-support-gateway-status -- :^backend-support/

# Option B — abandon the whole branch:
git switch claude/fervent-montalcini-62fba8         # back to the parent branch
git branch -D cloudcode/backend-support-gateway-status
```

Either way, no other file in the worktree was touched.

## What CloudCode did NOT do (per the rules)

- Did not push to any remote.
- Did not modify the 100-day plan.
- Did not edit Mission Control UI.
- Did not edit `connector-readiness-route.ts`, `build-wiki-run-now-route.ts`,
  `dashboard.ts`, or any other file Codex is actively touching.
- Did not weaken auth or change `.env` files.
- Did not add Zapier / SMB / Fork-2 / Gmail / Slack / YouTube / Web farmer
  paths.
- Did not call `systemctl`, `child_process.spawn`, or any external write.
- Did not print or log a single secret, raw absolute path, or private host
  string in any output (verified by `safety.test.ts` and a final grep over
  the proof artifacts).

## What Codex picks up next

This package is the **truth source**. Codex's repair work for Mission
Control / Gateway UI consumes `normalizeGatewayStatus`, `ROUTE_METADATA`,
`runRouteSmoke`, and friends — so the UI no longer has to guess.

Mission Control UI is **not** claimed fixed by CloudCode. That is Codex's
work inside the 100-day plan.
