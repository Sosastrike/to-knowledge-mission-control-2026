# CloudCode → Mission Control v2 Gateway drop-in delivery

**Lane owner:** CloudCode (sole active owner — Codex paused at A66, no
credits). Production deploy executed by Luis or a designated human
operator with SSH access to `srv1568353:/home/tony/mission-control`;
CloudCode does not have network reach to that server from this session.

**SHIP STATUS (2026-05-11):** Designer Department approved **C+C** on
2026-05-11 ("C+C approved. Ship it. Then move on. Don't hold the build
for accessibility wins." — Luis). DDR-Gateway-001 and DDR-Gateway-002
are resolved. The shell adapter intended for production is
`gateway-dropin/src/components/gateway/GatewayShell.tsx` (commit
`7c51e68`).

**PRODUCTION VERIFICATION STATUS (2026-05-11 — second update):**
**NOT YET VERIFIED. Live web interface does NOT match the approved
designer files** per Luis's report. Gateway integration is treated as
**FAILED IN PRODUCTION** until the live `/gateway` matches the approved
designer screenshots byte-identically. Production audit pending — plan
documented in `gateway-dropin/HANDOFF.md` § 24.

The Option A+A variant remains under `gateway-dropin/options/` purely
as audit trail of the design decision. Not a live alternative; nothing
to swap.

Design-lock continues to pass (31 files match manifest), and the
designer mock files under `public/design/gateway/` remain byte-identical
to source.

The `cloudcode/gateway-dropin-integration` branch could not be pushed —
no git remote is configured on this worktree (same as the prior
backend-support delivery). The same content is delivered here in three
transfer formats. Pick whichever fits the production implementer's
workflow; they are byte-equivalent and yield identical history.

## What is in this delivery

- **Branch:** `cloudcode/gateway-dropin-integration`
- **Branch tip:** `33035d4`
- **Commits included (in order):**
  1. `7c51e68` — `feat(gateway-dropin): mount Gateway designer mocks at /gateway under Next 15`
  2. `43f628c` — `docs(gateway-dropin): backfill commit SHA into closeout report`
  3. `b72a93b` — `docs(gateway-dropin): apply Designer Authorization Gate audit + raise DDR-Gateway-001/002`
  4. `b3f2603` — `docs(gateway-dropin): HOLD-pending-designer + Option A+A prep + CloudCode-owner wording`
  5. `33035d4` — `docs(gateway-dropin): C+C approved by Designer Dept — lift HOLD, ship-ready`
- **Base commit (already on `main` / `claude/fervent-montalcini-62fba8`):** `354d632`
- **Files added:** 54 new files under `gateway-dropin/`. **Zero** existing
  files were modified.
- **Docs:** `gateway-dropin/HANDOFF.md`, `gateway-dropin/INTEGRATION-PATCH.md`,
  `gateway-dropin/README.md`
- **Proof:** `gateway-dropin/proof/` (typecheck, vitest, secret scan,
  design-lock compute + verify)

## Transfer formats

| File | Best when | Apply with |
| --- | --- | --- |
| `cloudcode-gateway-dropin.bundle` | The production implementer (CloudCode or a human operator on srv1568353) has access to the same git repo and wants the branch + commit history exactly. | `git fetch <bundle-path> cloudcode/gateway-dropin-integration` |
| `patches/0001-*.patch`, `patches/0002-*.patch` | Implementer applies via mailbox — preserves authorship, message, commit SHAs. | `git am patches/*.patch` |
| `cloudcode-gateway-dropin-combined.patch` | Implementer prefers a single diff (no commit history retained). | `git apply cloudcode-gateway-dropin-combined.patch` |
| `cloudcode-gateway-dropin.tar.gz` | Implementer wants the file tree only (no git involvement). Excludes `node_modules/` and `.tsbuildinfo`. | `tar -xzf cloudcode-gateway-dropin.tar.gz` |

`SHA256SUMS` covers every transfer artefact for integrity verification:

```bash
shasum -a 256 -c cloudcode-gateway-dropin-handoff/SHA256SUMS
```

## Recommended apply path

From a clean working tree on the Mission Control v2 repo on srv1568353,
on a base that contains commit `354d632` (or any base where
`gateway-dropin/` does not exist):

```bash
git fetch /absolute/path/to/cloudcode-gateway-dropin.bundle \
          cloudcode/gateway-dropin-integration:cloudcode/gateway-dropin-integration
git checkout cloudcode/gateway-dropin-integration
git log --oneline -3
# expect:
#   43f628c docs(gateway-dropin): backfill commit SHA into closeout report
#   7c51e68 feat(gateway-dropin): mount Gateway designer mocks at /gateway under Next 15
#   354d632 fix(jarvis-stt): ...
```

Or, with the per-commit patches on whatever base the implementer picks:

```bash
cd /path/to/mission-control-v2
git checkout main           # or whatever base
git checkout -b cloudcode/gateway-dropin-integration
git am /absolute/path/to/cloudcode-gateway-dropin-handoff/patches/*.patch
```

Then apply the integration patches per `gateway-dropin/INTEGRATION-PATCH.md`:

1. Merge `gateway-dropin/next.config.partial.js` rewrites into the prod
   `next.config.js`.
2. Merge `gateway-dropin/middleware.gateway-csp.partial.ts` into the prod
   `src/middleware.ts` (or rename and import).
3. Move `gateway-dropin/public/design/gateway/` to the prod
   `public/design/gateway/`.
4. Move `gateway-dropin/src/components/gateway/GatewayShell.tsx` to the
   prod `src/components/gateway/GatewayShell.tsx`.
5. Move `gateway-dropin/src/app/gateway/page.tsx` to the prod
   `src/app/gateway/page.tsx`.
6. Move `gateway-dropin/design-lock/gateway-manifest.json` and
   `gateway-dropin/scripts/{compute,verify}-design-lock.mjs` into the
   prod tree.
7. Move `gateway-dropin/tests/*.test.ts` to the prod `tests/gateway/`.

## How to verify after applying

```bash
cd /path/to/mission-control-v2
pnpm install
pnpm typecheck
pnpm test -- tests/gateway
pnpm build
node scripts/verify-design-lock.mjs

# Post-deploy production proofs (live URLs):
curl -fsS "https://<domain>/design/gateway/Agent%20Hub.html" | head -3
curl -fsS "https://<domain>/gateway" | grep -c gateway-shell
for tab in overview agent-hub paperclip dispatcher token-governor \
           bridge-session health routes registry policies; do
  printf '%-30s ' "$tab"
  curl -fsS -o /dev/null -w '%{http_code}\n' "https://<domain>/gateway/$tab"
done
```

## Rollback

```bash
# A. Drop the branch entirely (start clean):
git switch <previous-branch>
git branch -D cloudcode/gateway-dropin-integration

# B. Revert by commit on the integrated repo:
git revert 7c51e68 43f628c

# C. Surgical removal after integration:
git rm -rf public/design/gateway/ src/components/gateway/ src/app/gateway/
git rm design-lock/gateway-manifest.json scripts/compute-design-lock.mjs scripts/verify-design-lock.mjs
git rm tests/gateway/*.test.ts
# then revert the rewrites array in next.config.js + CSP scope in middleware.ts
```

## Coordination invariants honoured by this branch

- ❌ No `.env` reads or writes
- ❌ No `systemctl` / `child_process.spawn` / external writes
- ❌ No Zapier writes, no SMB, no Fork-2
- ❌ No edits to `connector-readiness-route.ts`, `build-wiki-run-now-route.ts`,
  `dashboard.ts`, `AgentNetworkClient.tsx`, the legacy
  `designer-mission-control/[[...path]]` proxy, or any file Codex was
  active on
- ❌ No edits to the 100-day plan
- ❌ No auth weakening
- ❌ No fake LIVE — status grammar inside the mocks is exactly as the
  designer shipped (gray / yellow / blue / red / green-only-when-Bridge-open)
- ❌ No mock HTML / CSS modified — design-lock manifest proves it
- ❌ No re-implementation in React
- ❌ No new visual states or colours beyond the locked grammar
- ❌ No secrets, raw absolute paths, or private host strings in any output
- ✅ Single dedicated branch off the parent, clean diff, both commits
  authored by Sosastrike with a CloudCode (Claude Opus 4.7) co-author trailer

## What CloudCode does NOT claim

- Does NOT claim Mission Control reference-shell parity. `Mission-Control-
  Gateway-FULL-v3` is present on the drive but is out of scope for this
  drop-in lane.
- Does NOT claim the production `/gateway` URL renders correctly — that
  test runs against the live Mission Control v2 on srv1568353 after the
  integrator applies the patch and deploys.
- Does NOT claim the production `pnpm build` succeeds — same reason.
- Does NOT claim the route-smoke CLI was run against production —
  CloudCode has no route into the production network.

CloudCode CAN attest, via local proof artefacts in `gateway-dropin/proof/`:

- `tsc --noEmit` passes against the staged source files.
- All 29 vitest tests pass (parity, encoding, CSP scope, design-lock).
- `compute-design-lock.mjs` and `verify-design-lock.mjs` round-trip cleanly
  for all 31 mock files.
- No `.env` was touched (git diff empty).
- No secrets are present in any staged file (grep scan empty).
