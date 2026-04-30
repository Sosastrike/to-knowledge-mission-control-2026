#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# scripts/sync-static-to-standalone.sh
#
# Mirror .next/static/ and public/ into .next/standalone/.next/static/
# and .next/standalone/public/ so the Next.js standalone server can
# serve /_next/static/* and /<asset> with the correct text/css and
# image MIME types.
#
# Why this script exists
# ----------------------
# Next.js standalone output (next.config.js: output:'standalone') ships
# only .next/standalone/server.js + minimal node_modules. The static
# chunks that the HTML loads from /_next/static/* live at .next/static/
# and MUST be copied into .next/standalone/.next/static/ for the
# standalone server to serve them. If they're missing, the catch-all
# returns the homepage HTML for /_next/static/*.css, the browser
# rejects it (wrong MIME), and CSS-Module styles never apply at
# runtime — even though `next build` succeeded.
#
# This is the well-known Next.js standalone gotcha. Documented at:
#   https://nextjs.org/docs/app/api-reference/next-config-js/output
#
# When this runs
# --------------
# Wired as `postbuild` in package.json, so it runs automatically after
# every `npm run build`. Also safe to run manually any time after a
# build:
#   bash scripts/sync-static-to-standalone.sh
#
# Read-only on source files. Idempotent. No secrets touched.
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
STANDALONE_DIR="$PROJECT_ROOT/.next/standalone"
STANDALONE_NEXT_DIR="$STANDALONE_DIR/.next"
STANDALONE_STATIC_DIR="$STANDALONE_NEXT_DIR/static"
SOURCE_STATIC_DIR="$PROJECT_ROOT/.next/static"
SOURCE_PUBLIC_DIR="$PROJECT_ROOT/public"
STANDALONE_PUBLIC_DIR="$STANDALONE_DIR/public"

if [[ ! -f "$STANDALONE_DIR/server.js" ]]; then
  echo "sync-static-to-standalone: standalone server.js missing at $STANDALONE_DIR/server.js" >&2
  echo "  Next.js did not emit standalone output. Run the production build with webpack: 'next build --webpack'." >&2
  exit 1
fi

mkdir -p "$STANDALONE_NEXT_DIR"

if [[ -d "$SOURCE_STATIC_DIR" ]]; then
  rm -rf "$STANDALONE_STATIC_DIR"
  cp -R "$SOURCE_STATIC_DIR" "$STANDALONE_STATIC_DIR"
  echo "sync-static-to-standalone: copied .next/static/ -> .next/standalone/.next/static/"
fi

if [[ -d "$SOURCE_PUBLIC_DIR" ]]; then
  rm -rf "$STANDALONE_PUBLIC_DIR"
  cp -R "$SOURCE_PUBLIC_DIR" "$STANDALONE_PUBLIC_DIR"
  echo "sync-static-to-standalone: copied public/ -> .next/standalone/public/"
fi

echo "sync-static-to-standalone: done."
