#!/usr/bin/env bash
# CloudCode operator-apply-and-verify script.
# Runs on srv1568353 (or wherever /home/tony/mission-control lives).
# Fail-fast; does NOT deploy/restart automatically — that step is
# operator-discretion and depends on this environment's release path.
#
# Usage (from the host that has SSH to srv1568353):
#   scp -r cloudcode-gateway-dropin-handoff srv1568353:/tmp/
#   ssh srv1568353
#   cd /home/tony/mission-control
#   bash /tmp/cloudcode-gateway-dropin-handoff/operator-apply-and-verify.sh
#
# Env vars (override with PROD_REPO=... DOMAIN=... bash this-script):
#   PROD_REPO   default: /home/tony/mission-control
#   DOMAIN      default: https://tkmc.knowledge-vs-ai.com
#   HANDOFF     default: /tmp/cloudcode-gateway-dropin-handoff
#   AUTH_COOKIE optional — used for the verification curls

set -euo pipefail

PROD_REPO="${PROD_REPO:-/home/tony/mission-control}"
DOMAIN="${DOMAIN:-https://tkmc.knowledge-vs-ai.com}"
HANDOFF="${HANDOFF:-/tmp/cloudcode-gateway-dropin-handoff}"
AUTH_COOKIE="${AUTH_COOKIE:-}"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
say()    { printf '\033[36m==>\033[0m %s\n' "$*"; }

die() { red "FATAL: $*"; exit 1; }

confirm() {
  local prompt="${1:-Continue?}"
  read -r -p "$prompt [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || die "aborted by operator"
}

# ------------------------------------------------------------------
say "Pre-flight"

[[ -d "$PROD_REPO/.git" ]] || die "PROD_REPO=$PROD_REPO is not a git repo"
[[ -d "$HANDOFF/patches" ]] || die "HANDOFF=$HANDOFF is missing patches/"

cd "$PROD_REPO"
if [[ -n "$(git status --porcelain)" ]]; then
  red "working tree has uncommitted changes:"
  git status --short
  die "commit or stash before applying CloudCode patches"
fi

BASELINE=$(git rev-parse HEAD)
say "production HEAD before: $BASELINE"

# ------------------------------------------------------------------
say "Step 1 — apply CloudCode patches"

if git show-ref --verify --quiet refs/heads/cloudcode/gateway-dropin-integration; then
  die "branch cloudcode/gateway-dropin-integration already exists; resolve manually"
fi

git checkout -b cloudcode/gateway-dropin-integration
if ! git am "$HANDOFF/patches/"*.patch; then
  git am --abort || true
  yellow "git am failed — likely conflicts with existing tree. Falling back to tarball-extract mode."
  yellow "Operator must merge by hand from $HANDOFF/cloudcode-gateway-dropin.tar.gz."
  die "patch application failed; see git am output above"
fi

NEW_TIP=$(git rev-parse HEAD)
say "branch tip after git am: $NEW_TIP"

# ------------------------------------------------------------------
say "Step 2 — move/merge package files into production tree"

SRC="$PROD_REPO/gateway-dropin"
[[ -d "$SRC" ]] || die "$SRC missing after patch apply"

mkdir -p public/design src/components/gateway src/app/gateway design-lock scripts tests/gateway

cp -R "$SRC/public/design/gateway" public/design/
cp    "$SRC/src/components/gateway/GatewayShell.tsx" src/components/gateway/GatewayShell.tsx
cp    "$SRC/src/app/gateway/page.tsx" src/app/gateway/page.tsx
cp    "$SRC/design-lock/gateway-manifest.json" design-lock/gateway-manifest.json
cp    "$SRC/scripts/compute-design-lock.mjs" scripts/
cp    "$SRC/scripts/verify-design-lock.mjs" scripts/
cp    "$SRC/tests/csp-scope.test.ts"      tests/gateway/
cp    "$SRC/tests/design-lock.test.ts"    tests/gateway/
cp    "$SRC/tests/gateway-shell.test.ts"  tests/gateway/

test -f CODEOWNERS || cp "$SRC/CODEOWNERS" CODEOWNERS

yellow "MANUAL STEP — merge rewrites + middleware (run these in your editor):"
yellow "  - merge $SRC/next.config.partial.js rewrites block into next.config.js"
yellow "  - merge $SRC/middleware.gateway-csp.partial.ts into src/middleware.ts"
yellow "Press ENTER when both merges are done and saved."
read -r

# ------------------------------------------------------------------
say "Step 3 — remove competing hand-coded /gateway/* pages (CAUSE_3)"

EXISTING=$(find src/app/gateway -type f -name '*.tsx' -not -path 'src/app/gateway/page.tsx')
if [[ -n "$EXISTING" ]]; then
  yellow "found competing pages:"
  echo "$EXISTING"
  confirm "remove these competing pages (alternative: keep them and abort here)?"
  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    [[ "$path" == "src/app/gateway/page.tsx" ]] && continue
    git rm "$path"
  done <<< "$EXISTING"
  # Clean up empty subdirs:
  find src/app/gateway -type d -empty -delete
fi

say "remaining /gateway/* files:"
find src/app/gateway -type f

# ------------------------------------------------------------------
say "Step 4 — verify legacy designer-mission-control catch-all is NOT eating /design/gateway/*"

if grep -rn "design/gateway\|/design[^a-z]" src/app/designer-mission-control src/middleware.ts src/proxy.ts next.config.js 2>/dev/null | grep -qv "/designer-mission-control"; then
  yellow "WARNING: legacy catch-all appears to reference /design/* (over-broad). Confirm fix in next.config.js or middleware before continuing."
  confirm "fix is applied and saved?"
fi

# ------------------------------------------------------------------
say "Step 5 — build and verify"

pnpm install
pnpm typecheck
pnpm test -- tests/gateway
pnpm build
node scripts/verify-design-lock.mjs

green "Step 5 PASS — build + tests + design-lock all green"

# ------------------------------------------------------------------
say "Step 6 — deploy/restart"

yellow "MANUAL STEP — restart through the approved release path."
yellow "Examples:"
yellow "  sudo systemctl restart mission-control.service"
yellow "  pm2 reload mission-control"
yellow "  docker-compose restart mission-control"
confirm "deploy/restart completed?"

# ------------------------------------------------------------------
say "Step 7 — verify the live production fix"

CURL_AUTH=()
if [[ -n "$AUTH_COOKIE" ]]; then
  CURL_AUTH=( -b "$AUTH_COOKIE" )
fi

say "static mock proof:"
curl -fsS -L "${CURL_AUTH[@]}" "${DOMAIN}/design/gateway/Agent%20Hub.html" | head -3 \
  || { red "static mock fetch failed"; exit 1; }

say "gateway-shell presence proof:"
SHELL_COUNT=$(curl -fsS -L "${CURL_AUTH[@]}" "${DOMAIN}/gateway" | grep -c 'gateway-shell' || true)
echo "gateway-shell occurrences: $SHELL_COUNT"
if [[ "$SHELL_COUNT" -lt 1 ]]; then
  red "GatewayShell not detected in /gateway HTML — production still wrong"
  exit 1
fi

say "deep-link proof:"
for tab in overview agent-hub paperclip dispatcher token-governor \
           bridge-session health routes registry policies; do
  printf '%-30s ' "$tab"
  curl -fsS -L -o /dev/null -w '%{http_code}\n' "${CURL_AUTH[@]}" \
       "${DOMAIN}/gateway/${tab}"
done

say "comprehensive audit:"
node "$HANDOFF/../gateway-dropin/scripts/audit-production.mjs" --base "${DOMAIN}" \
  > /tmp/cc-final-audit.json 2>&1 || true
echo "Audit written to /tmp/cc-final-audit.json"
grep -E '"diagnoses"' /tmp/cc-final-audit.json || true

# ------------------------------------------------------------------
green "OPERATOR APPLY COMPLETE"
yellow "Next: open the 7 URLs in Step 8 of OPERATOR-EXECUTE-NOW.md in a browser at"
yellow "1480px and capture screenshots. Compare to the approved designer screenshots."
yellow "Send the captured screenshots + /tmp/cc-final-audit.json back to CloudCode."
yellow ""
yellow "Rollback if visual proof fails:"
yellow "  git switch <previous-branch>"
yellow "  git branch -D cloudcode/gateway-dropin-integration"
yellow "  (then redeploy)"
