#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${ROOT}/scripts/agent-line-trace.sh"
TARGET="${AGENT_LINE_TRACE_TARGET:-/home/tony/agent-line-trace.sh}"
TARGET_DIR="$(dirname "$TARGET")"

if [[ ! -f "$SOURCE" ]]; then
  echo "INSTALL_BLOCKED: source_trace_script_missing"
  exit 2
fi

if [[ ! -d "$TARGET_DIR" ]]; then
  echo "INSTALL_BLOCKED: target_directory_missing:$TARGET_DIR"
  exit 3
fi

if [[ ! -w "$TARGET_DIR" ]]; then
  echo "INSTALL_BLOCKED: target_directory_not_writable:$TARGET_DIR"
  exit 4
fi

install -m 0755 "$SOURCE" "$TARGET"
echo "INSTALL_OK: $TARGET"
