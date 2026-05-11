# OPERATOR — execute now to make production /gateway match designer

Audit results (CloudCode, 2026-05-11 against `https://tkmc.knowledge-vs-ai.com`):

- **CAUSE_1** — CloudCode package `8489d81` is not in production. ✅ confirmed
- **CAUSE_3** — Hand-coded `src/app/gateway/agent-hub/page.tsx` + `src/app/gateway/agent-hub/paperclip/page.tsx` win and render their own UI. ✅ confirmed
- **CAUSE_4 / CAUSE_6** — Legacy `app/designer-mission-control/[[...path]]/page.tsx` catch-all eats `/design/gateway/*`, rewriting them to `/designer-mission-control/Mission Control.html?page=mission`. ✅ confirmed
- **CAUSE_5** — `/gateway` is not mounted to `GatewayShell` (no `gateway-shell` class anywhere in the bundle). ✅ confirmed

The 7 steps below are the operator-side fix. CloudCode cannot SSH to `srv1568353`. Run on a workstation that does.

---

## Pre-flight

```bash
# Stage the delivery package on a host that can reach srv1568353:
#   cloudcode-gateway-dropin-handoff/         <-- this folder
#   cloudcode-gateway-dropin-handoff/patches/ <-- 10 mailbox patches
# Copy to the operator workstation (or pass --bundle path to scp).

# Set once for the session:
export PROD_HOST=srv1568353
export PROD_REPO=/home/tony/mission-control
export DOMAIN=https://tkmc.knowledge-vs-ai.com
export YOUR_AUTH_COOKIE='session=...'   # paste your active Mission Control cookie
```

---

## Step 1 — Apply the CloudCode package (commit chain ending at `8489d81`)

```bash
ssh ${PROD_HOST}
cd ${PROD_REPO}

# Safety: make sure working tree is clean.
git status --porcelain && echo "WT is clean" || { echo "ABORT: uncommitted changes"; exit 1; }

git checkout -b cloudcode/gateway-dropin-integration
git am /path/to/cloudcode-gateway-dropin-handoff/patches/*.patch
git log --oneline -10
# expect to see ending: 8489d81 feat(gateway-dropin): roll in Designer Contract + wire data + buttons
```

If `git am` fails on a path conflict (because production already has a different `src/app/gateway/...` tree), abort the `am` and use the tarball path:

```bash
git am --abort
tar -xzf /path/to/cloudcode-gateway-dropin-handoff/cloudcode-gateway-dropin.tar.gz \
   -C /tmp/cc-gateway-dropin/
# Then proceed to Step 2 using /tmp/cc-gateway-dropin/gateway-dropin/ as source.
```

## Step 2 — Move/merge package files into the production tree

```bash
# Source root depends on Step 1 outcome:
SRC=${PROD_REPO}/gateway-dropin                 # if git am succeeded
# or:
# SRC=/tmp/cc-gateway-dropin/gateway-dropin     # if tarball path

# Static designer mocks (31 files, byte-locked):
mkdir -p public/design
cp -R "${SRC}/public/design/gateway" public/design/

# Shell adapter + canonical route:
mkdir -p src/components/gateway src/app/gateway
cp "${SRC}/src/components/gateway/GatewayShell.tsx" src/components/gateway/GatewayShell.tsx
cp "${SRC}/src/app/gateway/page.tsx" src/app/gateway/page.tsx

# Design-lock manifest + scripts:
mkdir -p design-lock scripts
cp "${SRC}/design-lock/gateway-manifest.json" design-lock/gateway-manifest.json
cp "${SRC}/scripts/compute-design-lock.mjs" scripts/
cp "${SRC}/scripts/verify-design-lock.mjs" scripts/

# Tests (skip the Playwright scaffold unless you've installed peer deps):
mkdir -p tests/gateway
cp "${SRC}/tests/csp-scope.test.ts" tests/gateway/
cp "${SRC}/tests/design-lock.test.ts" tests/gateway/
cp "${SRC}/tests/gateway-shell.test.ts" tests/gateway/
# Optional, after `pnpm add -D @playwright/test pixelmatch pngjs`:
# cp "${SRC}/tests/visual-regression.spec.ts" tests/gateway/

# CODEOWNERS — merge by hand if you already have one. Otherwise:
test -f CODEOWNERS || cp "${SRC}/CODEOWNERS" CODEOWNERS
```

Merge the **rewrites** block from `${SRC}/next.config.partial.js` into the existing
`next.config.js`'s `async rewrites()` array. Do not replace; concatenate.

Merge `${SRC}/middleware.gateway-csp.partial.ts` exports into the existing
`src/middleware.ts` (or `proxy.ts`). Pattern shown in
`gateway-dropin/INTEGRATION-PATCH.md` § "CSP middleware merge".

## Step 3 — Remove competing hand-coded `/gateway/*` pages (CAUSE_3)

```bash
echo "=== inventory of existing /gateway pages BEFORE removal:"
find src/app/gateway -type f

# Confirmed by audit — these intercept the new GatewayShell:
git rm src/app/gateway/agent-hub/page.tsx
git rm src/app/gateway/agent-hub/paperclip/page.tsx

# Any other src/app/gateway/<segment>/page.tsx that DOES NOT match
# src/app/gateway/page.tsx must also be removed (the Designer Contract
# Rule 1 — "There is no React component called AgentHubPage").
# Example:
#   git rm -r src/app/gateway/dispatcher
#   git rm -r src/app/gateway/token-governor

# Sanity:
ls src/app/gateway/
# Expected: page.tsx  (and only page.tsx)
```

If you want to keep the deleted pages as historical reference, move them to
`legacy/gateway/` instead of deleting:

```bash
mkdir -p legacy/gateway
git mv src/app/gateway/agent-hub legacy/gateway/agent-hub
```

## Step 4 — Stop legacy `designer-mission-control` catch-all from eating `/design/gateway/*` (CAUSE_4 / CAUSE_6)

Find the catch-all:

```bash
find src/app/designer-mission-control -type f
# expected: src/app/designer-mission-control/[[...path]]/page.tsx
#           src/app/designer-mission-control/[[...path]]/proxy.ts (or similar)
grep -rn "design/gateway\|/design\b" src/app/designer-mission-control src/middleware.ts src/proxy.ts next.config.js 2>/dev/null
```

If the catch-all matches `/design/*` (over-broad), tighten it. Two options:

### Option C-1 — Preferred: keep static `public/design/gateway/*` first via next.config rewrite

```js
// next.config.js — top of the rewrites() return array, BEFORE any catch-alls:
{
  source: '/design/gateway/:path*',
  destination: '/design/gateway/:path*',   // no-op rewrite → falls through to public/
  has: [],
},
```

Or add an early-return in middleware:

```ts
// src/middleware.ts — at the top of the middleware function:
if (request.nextUrl.pathname.startsWith('/design/gateway/')) {
  return NextResponse.next();   // let public/ serve directly
}
```

### Option C-2 — Narrow the legacy catch-all match

If the catch-all's path-matching pattern includes `/design/*` (likely because someone wrote `/design*` instead of `/designer-mission-control*`), correct it. Look for the regex/path:

```ts
// BEFORE (over-broad — eats /design/gateway/*):
if (pathname.startsWith('/design')) { /* redirect to legacy */ }

// AFTER (precise):
if (pathname.startsWith('/designer-mission-control')) { /* redirect to legacy */ }
```

Either C-1 or C-2 is acceptable. C-1 has the smaller blast radius.

## Step 5 — Build and verify locally on the production host

```bash
pnpm install
pnpm typecheck                          # expect: exit 0
pnpm test -- tests/gateway              # expect: 29 passed (gateway-shell + csp-scope + design-lock)
pnpm build                              # expect: success
node scripts/verify-design-lock.mjs     # expect: design-lock OK: 31 files match manifest
```

Any failure here STOPS the deploy. Paste the failing output into the operator results template and reply to CloudCode.

## Step 6 — Deploy / restart through the operator-approved release path

Use whatever release path Mission Control v2 normally uses on srv1568353:

```bash
# Examples — pick the one this environment uses:
sudo systemctl restart mission-control.service
# or
pm2 reload mission-control
# or
docker-compose restart mission-control
# or
./deploy.sh
```

## Step 7 — Verify the live production fix

```bash
# Static mock proof:
curl -fsS -L -b "$YOUR_AUTH_COOKIE" "${DOMAIN}/design/gateway/Agent%20Hub.html" | head -3
# Expected (after fix):
#   <!doctype html>
#   <html lang="en"><head><meta charset="utf-8"/><title>Gateway · Agent Hub</title>
# Currently returns the legacy v1 Mission Control HTML.

# Gateway shell proof:
curl -fsS -L -b "$YOUR_AUTH_COOKIE" "${DOMAIN}/gateway" | grep -c 'gateway-shell'
# Expected: 1
# Currently: 0

# Deep-link proof:
for tab in overview agent-hub paperclip dispatcher token-governor \
           bridge-session health routes registry policies; do
  printf '%-30s ' "$tab"
  curl -fsS -L -o /dev/null -w '%{http_code}\n' -b "$YOUR_AUTH_COOKIE" \
       "${DOMAIN}/gateway/${tab}"
done
# Expected: all 200

# Comprehensive audit:
node /path/to/cloudcode-gateway-dropin-handoff/../gateway-dropin/scripts/audit-production.mjs \
     --base ${DOMAIN}
# Expected diagnoses: ["no_failure_signals — production matches the package"]
```

## Step 8 — Visual confirmation (Luis)

Open in a browser at 1480 px width:

- `${DOMAIN}/design/gateway/Agent%20Hub.html` — raw approved designer mock.
- `${DOMAIN}/gateway` — should land on Gateway Overview inside GatewayShell.
- `${DOMAIN}/gateway/agent-hub` — Agent Hub mock inside iframe.
- `${DOMAIN}/gateway/agent-hub/paperclip` — Paperclip drill-down.
- `${DOMAIN}/gateway/dispatcher` — Dispatcher mock.
- `${DOMAIN}/gateway/token-governor` — Token Governor mock.
- `${DOMAIN}/gateway/bridge-session` — Bridge Session mock.

Visual must match the approved designer screenshots Luis already has. Per Designer Contract Rule 4, any visible difference = changes requested; file a fresh DDR.

## Rollback

If anything in Step 5/6/7 fails or the visual proof is wrong:

```bash
# A — drop the branch entirely:
cd ${PROD_REPO}
git switch <previous-branch>
git branch -D cloudcode/gateway-dropin-integration

# B — revert the commits if already pushed:
git revert <gateway-integration-tip-sha>

# C — restore the deleted competing pages:
git checkout HEAD~1 -- src/app/gateway/agent-hub
git commit -m "revert: restore hand-coded gateway pages"

# Then redeploy via the same release path.
```

## Hard rules during this work

- ❌ **Do not** edit mock HTML/CSS/JS under `public/design/gateway/`.
- ❌ **Do not** change `.env`.
- ❌ **Do not** weaken auth.
- ❌ **Do not** enable SMB / Fork-2 / Zapier writes / external farmers.
- ❌ **Do not** invent new visual states, colours, tabs, or labels.
- ❌ **Do not** involve Codex (paused at A66).
- ✅ **Do** keep design-lock manifest passing.
- ✅ **Do** fill in `OPERATOR-RESULTS-TEMPLATE.md` as you go.
- ✅ **Do** stop and file a DDR if you hit anything not covered above.

## After the operator completes

Reply to CloudCode with:

1. Final production commit hash (`git log -1 --oneline` on the production tree)
2. Output of `pnpm build`
3. Output of `node scripts/verify-design-lock.mjs`
4. Output of the Step 7 curls (real HTTP codes, real first three lines of the Agent Hub HTML)
5. Output of `audit-production.mjs --base ${DOMAIN}` after deploy
6. Browser screenshots of the 7 URLs in Step 8

CloudCode then folds those fields into the final HANDOFF closeout and the lane is closed.

**Until those proofs arrive, the Gateway designer integration is NOT accepted in production.**
