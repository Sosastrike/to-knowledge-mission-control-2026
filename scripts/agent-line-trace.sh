#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage:
  agent-line-trace.sh --agent jarvis
  agent-line-trace.sh --agent ron
  agent-line-trace.sh --agent hermes  # legacy alias
  agent-line-trace.sh --agent pi
  agent-line-trace.sh --agent paperclip
  agent-line-trace.sh --agent spaceagent
  agent-line-trace.sh --agent brain-bridge
  agent-line-trace.sh --agent paperclip.eco.ceo
  agent-line-trace.sh --agent ron-mini-agent.researcher
  agent-line-trace.sh --agent hermes-mini-agent.researcher  # legacy mini-agent id

Optional:
  agent-line-trace.sh --agent jarvis --local-probe
  agent-line-trace.sh --agent jarvis --voice
  MC_HOST=http://127.0.0.1:3337 agent-line-trace.sh --agent jarvis

Auth:
  If MC_API_KEY, MISSION_CONTROL_API_KEY, or MC_BEARER_TOKEN is present, the
  script calls protected Mission Control trace routes. Without auth it still
  prints the nonce and watches safe local logs; it does not bypass auth.
EOF
}

AGENT=""
SOURCE_SURFACE="terminal"
LOCAL_PROBE=0
VOICE=0
TIMEOUT="${TRACE_TIMEOUT_SECONDS:-90}"
HOST="${MC_HOST:-http://127.0.0.1:3337}"
TRACE_CURL_MAX_SECONDS="${TRACE_CURL_MAX_SECONDS:-5}"
TRACE_CHECK_MAX_SECONDS="${TRACE_CHECK_MAX_SECONDS:-5}"
TRACE_CONNECT_TIMEOUT_SECONDS="${TRACE_CONNECT_TIMEOUT_SECONDS:-2}"

bounded_cmd() {
  if command -v timeout >/dev/null 2>&1; then
    timeout "${TRACE_CHECK_MAX_SECONDS}s" "$@"
  else
    "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)
      AGENT="${2:-}"
      shift 2
      ;;
    --local-probe)
      LOCAL_PROBE=1
      shift
      ;;
    --voice)
      VOICE=1
      shift
      ;;
    --timeout)
      TIMEOUT="${2:-90}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$AGENT" ]]; then
        AGENT="$1"
        shift
      else
        echo "ERROR: unknown argument: $1" >&2
        usage
        exit 2
      fi
      ;;
  esac
done

if [[ -z "$AGENT" ]]; then
  usage
  exit 2
fi

REQUESTED_AGENT="$AGENT"

case "$AGENT" in
  jarvis|agent-zero|agent-zero-jarvis|@Jarvis_88sbot)
    TARGET="agent-zero-jarvis"
    EXPECTED_BOT="@Jarvis_88sbot"
    ;;
  ron|ron-weasley|hermes)
    TARGET="ron-weasley"
    EXPECTED_BOT=""
    ;;
  hermes-webui)
    TARGET="ron-weasley"
    SOURCE_SURFACE="hermes-webui"
    EXPECTED_BOT=""
    ;;
  pi|paperclip|spaceagent|brain-sync|brain-bridge|brain|brain-bridge-mode)
    [[ "$AGENT" == "brain-sync" ]] && AGENT="brain-bridge"
    [[ "$AGENT" == "brain" ]] && AGENT="brain-bridge"
    [[ "$AGENT" == "brain-bridge-mode" ]] && AGENT="brain-bridge"
    TARGET="$AGENT"
    EXPECTED_BOT=""
    ;;
  buildwiki|build-wiki|farmer|build-wiki-farmer)
    TARGET="build-wiki-farmer"
    EXPECTED_BOT=""
    ;;
  obsidian|mempalace|mem-palace|graphify|graph|memory-approvals|memory-approval)
    [[ "$AGENT" == "mem-palace" ]] && AGENT="mempalace"
    [[ "$AGENT" == "graph" ]] && AGENT="graphify"
    [[ "$AGENT" == "memory-approval" ]] && AGENT="memory-approvals"
    TARGET="$AGENT"
    EXPECTED_BOT=""
    ;;
  agentmail|agent-mail|n8n|zapier|google-drive|drive|onedrive|one-drive|webhooks|scheduler|mcp|mcp-tools|provider-model-layer|providers|models)
    [[ "$AGENT" == "agent-mail" ]] && AGENT="agentmail"
    [[ "$AGENT" == "drive" ]] && AGENT="google-drive"
    [[ "$AGENT" == "one-drive" ]] && AGENT="onedrive"
    [[ "$AGENT" == "mcp" || "$AGENT" == "mcp-tools" ]] && AGENT="mcp-tool-layer"
    [[ "$AGENT" == "providers" || "$AGENT" == "models" ]] && AGENT="provider-model-layer"
    TARGET="$AGENT"
    EXPECTED_BOT=""
    ;;
  paperclip.*|ron-mini-agent.*|hermes-mini-agent.*)
    TARGET="${AGENT/hermes-mini-agent./ron-mini-agent.}"
    EXPECTED_BOT=""
    ;;
  *)
    if [[ "$AGENT" =~ ^[A-Za-z0-9][A-Za-z0-9._+-]{0,120}$ ]]; then
      TARGET="$AGENT"
      EXPECTED_BOT=""
    else
      echo "ERROR: invalid agent id: $AGENT" >&2
      exit 2
    fi
    ;;
esac

if [[ "$TARGET" == "ron-weasley" ]]; then
  CONVERSATION_OWNER="ron-weasley"
  DISPLAY_AGENT="Ron Weasley"
else
  CONVERSATION_OWNER="$TARGET"
  DISPLAY_AGENT="$TARGET"
fi

LEGACY_TARGET_AGENT=""
if [[ "$REQUESTED_AGENT" != "$TARGET" ]]; then
  LEGACY_TARGET_AGENT="$REQUESTED_AGENT"
fi

TS="$(date -u +%Y%m%dT%H%M%SZ)"
RAND="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(4))
PY
)"
NONCE="TRACE-${TS}-${RAND}"
MODE="manual"
[[ "$VOICE" -eq 1 ]] && MODE="voice"

OUT_DIR="${TRACE_OUT_DIR:-/home/tony/runtime/agent-line-traces}"
if ! mkdir -p "$OUT_DIR" 2>/dev/null; then
  OUT_DIR="${PWD}/runtime/agent-line-traces"
  mkdir -p "$OUT_DIR"
fi
REPORT="$OUT_DIR/${NONCE}-${TARGET}.json"

AUTH_VALUE="${MC_BEARER_TOKEN:-${MC_API_KEY:-${MISSION_CONTROL_API_KEY:-}}}"
CURL_AUTH=()
if [[ -n "$AUTH_VALUE" ]]; then
  CURL_AUTH=(-H "Authorization: Bearer ${AUTH_VALUE}")
fi

json_escape() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps(sys.argv[1]))
PY
}

probe_route() {
  local body
  local PROBE_VOICE_TRANSCRIBED="true"
  if [[ "$VOICE" -eq 1 ]]; then
    PROBE_VOICE_TRANSCRIBED="false"
  fi
  body="$(cat <<EOF
{
  "nonce": $(json_escape "$NONCE"),
  "target_agent": $(json_escape "$TARGET"),
  "target_system": $(json_escape "$SOURCE_SURFACE"),
  "conversation_owner": $(json_escape "$CONVERSATION_OWNER"),
  "source_channel": "terminal",
  "source_surface": $(json_escape "$SOURCE_SURFACE"),
  "mode": $(json_escape "$MODE"),
  "local_gateway_probe": true,
  "verification_sources": ["mission_control_protected_probe_route"],
  "message_received_by_agent": true,
  "voice_transcribed": $PROBE_VOICE_TRANSCRIBED,
  "response_sent": true
}
EOF
)"
  if [[ "${#CURL_AUTH[@]}" -eq 0 ]]; then
    return 4
  fi
  curl --connect-timeout "$TRACE_CONNECT_TIMEOUT_SECONDS" --max-time "$TRACE_CURL_MAX_SECONDS" -fsS "${CURL_AUTH[@]}" -H 'Content-Type: application/json' \
    -X POST "$HOST/api/bridge/agent-routing/trace/probe" \
    --data "$body" >/tmp/agent-line-trace-probe-${NONCE}.json 2>/dev/null
}

fetch_live_trace() {
  if [[ "${#CURL_AUTH[@]}" -eq 0 ]]; then
    return 4
  fi
  curl --connect-timeout "$TRACE_CONNECT_TIMEOUT_SECONDS" --max-time "$TRACE_CURL_MAX_SECONDS" -fsS "${CURL_AUTH[@]}" \
    "$HOST/api/bridge/agent-routing/trace/live?agent=${TARGET}&nonce=${NONCE}" \
    >/tmp/agent-line-trace-live-${NONCE}.json 2>/dev/null
}

cat <<EOF
================ DIRECT AGENT LINE TRACE ================
target_agent: $TARGET
display_agent: $DISPLAY_AGENT
conversation_owner: $CONVERSATION_OWNER
source_surface: $SOURCE_SURFACE
requested_agent: $REQUESTED_AGENT
nonce: $NONCE
mode: $MODE

Send this exact message now:

$DISPLAY_AGENT direct line trace test $NONCE

Expected:
- target_agent receives message
- conversation_owner equals $CONVERSATION_OWNER
- direct_line_used true
- OpenCloud/OpenClaw hidden intermediary false
- response sent by the correct agent
=========================================================
EOF

START="$(date +%s)"
END=$((START + TIMEOUT))
FOUND_RECEIVE=0
FOUND_RESPONSE=0
FOUND_OPENCLOUD=0
FOUND_TRANSCRIPT=0
ROUTE_STATUS=""
ROUTE_BLOCKER=""
ROUTE_VISIBLE_TASK_ID=""
ROUTE_TRACE_JSON="[]"
VISIBLE_TASK_BLOCKER=""

if [[ "$LOCAL_PROBE" -eq 1 ]]; then
  if probe_route; then
    FOUND_RECEIVE=1
    FOUND_RESPONSE=1
    [[ "$VOICE" -eq 0 ]] && FOUND_TRANSCRIPT=1
  else
    echo "Local probe route was not called. Auth may be missing; continuing passive trace."
  fi
fi

while [[ "$(date +%s)" -lt "$END" ]]; do
  if fetch_live_trace; then
    if grep -F "$NONCE" "/tmp/agent-line-trace-live-${NONCE}.json" >/dev/null 2>&1; then
      FOUND_RECEIVE=1
      FOUND_RESPONSE=1
      ROUTE_STATUS="$(python3 - "/tmp/agent-line-trace-live-${NONCE}.json" <<'PY' 2>/dev/null || true
import json, sys
data=json.load(open(sys.argv[1]))
traces=data.get("traces") or []
print((traces[0] or {}).get("status","") if traces else "")
PY
)"
      ROUTE_BLOCKER="$(python3 - "/tmp/agent-line-trace-live-${NONCE}.json" <<'PY' 2>/dev/null || true
import json, sys
data=json.load(open(sys.argv[1]))
traces=data.get("traces") or []
print((traces[0] or {}).get("blocker","") if traces else "")
PY
)"
    fi
  fi

  if command -v journalctl >/dev/null 2>&1; then
    if bounded_cmd journalctl -u mission-control.service --since "@$START" --no-pager 2>/dev/null | grep -F "$NONCE" >/dev/null 2>&1; then
      FOUND_RECEIVE=1
    fi
    if bounded_cmd journalctl --user -u claudeclaw.service --since "@$START" --no-pager 2>/dev/null | grep -F "$NONCE" >/dev/null 2>&1; then
      FOUND_RESPONSE=1
    fi
    if bounded_cmd journalctl --user --since "@$START" --no-pager 2>/dev/null | grep -iE 'opencloud|openclaw' | grep -F "$NONCE" >/dev/null 2>&1; then
      FOUND_OPENCLOUD=1
    fi
    if [[ "$VOICE" -eq 1 ]] && bounded_cmd journalctl --user -u claudeclaw.service --since "@$START" --no-pager 2>/dev/null | grep -Ei 'voice transcribed|whisper|transcript' | grep -F "$NONCE" >/dev/null 2>&1; then
      FOUND_TRANSCRIPT=1
    fi
  fi

  if command -v docker >/dev/null 2>&1 && bounded_cmd docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'agent-zero'; then
    if bounded_cmd docker logs agent-zero --since "${START}" 2>/dev/null | grep -F "$NONCE" >/dev/null 2>&1; then
      FOUND_RECEIVE=1
    fi
  fi

  if [[ "$FOUND_RECEIVE" -eq 1 && "$FOUND_RESPONSE" -eq 1 && "$FOUND_OPENCLOUD" -eq 0 ]]; then
    [[ "$VOICE" -eq 0 || "$FOUND_TRANSCRIPT" -eq 1 ]] && break
  fi
  sleep 3
done

STATUS="PASS"
BLOCKER="none"
if [[ -n "$ROUTE_STATUS" && "$ROUTE_STATUS" != "PASS" ]]; then
  STATUS="FAIL"
  BLOCKER="${ROUTE_BLOCKER:-TRACE_TIMEOUT}"
elif [[ "$FOUND_OPENCLOUD" -eq 1 ]]; then
  STATUS="FAIL"
  BLOCKER="OPENCLOUD_HIDDEN_INTERMEDIARY_DETECTED"
elif [[ "$FOUND_RECEIVE" -ne 1 ]]; then
  STATUS="FAIL"
  BLOCKER="TARGET_AGENT_NOT_RECEIVED"
elif [[ "$VOICE" -eq 1 && "$FOUND_TRANSCRIPT" -ne 1 ]]; then
  STATUS="FAIL"
  BLOCKER="VOICE_TRANSCRIPTION_MISSING"
elif [[ "$FOUND_RESPONSE" -ne 1 ]]; then
  STATUS="FAIL"
  BLOCKER="RESPONSE_NOT_SENT"
fi

post_final_trace_result() {
  if [[ "${#CURL_AUTH[@]}" -eq 0 ]]; then
    return 4
  fi

  local body
  body="$(python3 - <<PY
import json
target = "$TARGET"
received = bool($FOUND_RECEIVE)
intermediaries = ["opencloud"] if bool($FOUND_OPENCLOUD) else []
print(json.dumps({
    "nonce": "$NONCE",
    "target_agent": target,
    "target_system": "$SOURCE_SURFACE",
    "conversation_owner": "$CONVERSATION_OWNER",
    "source_channel": "terminal",
    "source_surface": "$SOURCE_SURFACE",
    "mode": "$MODE",
    "local_gateway_probe": bool($LOCAL_PROBE),
    "verification_sources": ["mission_control_protected_probe_route"] if bool($LOCAL_PROBE) else [],
    "intermediaries": intermediaries,
    "message_received_by_agent": received,
    "voice_transcribed": bool($FOUND_TRANSCRIPT) if bool($VOICE) else True,
    "response_sent": bool($FOUND_RESPONSE),
    "create_visible_task_on_failure": True,
}))
PY
)"

  local http_code
  http_code="$(curl --connect-timeout "$TRACE_CONNECT_TIMEOUT_SECONDS" --max-time "$TRACE_CURL_MAX_SECONDS" -sS "${CURL_AUTH[@]}" -H 'Content-Type: application/json' \
    -X POST "$HOST/api/bridge/agent-routing/trace/probe" \
    --data "$body" \
    -o "/tmp/agent-line-trace-final-${NONCE}.json" \
    -w '%{http_code}' 2>/dev/null || true)"

  case "$http_code" in
    200|201|202|204|409)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

if post_final_trace_result; then
  ROUTE_STATUS="$(python3 - "/tmp/agent-line-trace-final-${NONCE}.json" <<'PY' 2>/dev/null || true
import json, sys
data=json.load(open(sys.argv[1]))
record = data.get("record") or data.get("trace") or {}
print(record.get("status",""))
PY
)"
  ROUTE_BLOCKER="$(python3 - "/tmp/agent-line-trace-final-${NONCE}.json" <<'PY' 2>/dev/null || true
import json, sys
data=json.load(open(sys.argv[1]))
record = data.get("record") or data.get("trace") or {}
print(record.get("blocker","") or "")
PY
)"
  ROUTE_VISIBLE_TASK_ID="$(python3 - "/tmp/agent-line-trace-final-${NONCE}.json" <<'PY' 2>/dev/null || true
import json, sys
data=json.load(open(sys.argv[1]))
record = data.get("record") or data.get("trace") or {}
print(record.get("visible_task_id","") or "")
PY
)"
  ROUTE_TRACE_JSON="$(python3 - "/tmp/agent-line-trace-final-${NONCE}.json" <<'PY' 2>/dev/null || true
import json, sys
data=json.load(open(sys.argv[1]))
record = data.get("record") or data.get("trace") or {}
print(json.dumps(record.get("route_trace") or []))
PY
)"
elif [[ "$STATUS" == "FAIL" ]]; then
  VISIBLE_TASK_BLOCKER="mission_control_auth_required_for_visible_task_creation"
fi

python3 - <<PY
import json, pathlib
mission_control_route_trace = json.loads('''$ROUTE_TRACE_JSON''' or '[]')
local_signal_route_trace = ["owner", "mission-control", "nuclear-gateway"] + (["$TARGET"] if bool($FOUND_RECEIVE) else [])
report = {
  "trace_id": "$NONCE",
  "nonce": "$NONCE",
  "requested_agent": "$REQUESTED_AGENT",
  "target_agent": "$TARGET",
  "display_agent": "$DISPLAY_AGENT",
  "conversation_owner": "$CONVERSATION_OWNER",
  "legacy_target_agent": "$LEGACY_TARGET_AGENT" or None,
  "source_surface": "$SOURCE_SURFACE",
  "expected_bot": "$EXPECTED_BOT",
  "direct_line_expected": True,
  "message_received_signal": bool($FOUND_RECEIVE),
  "response_signal": bool($FOUND_RESPONSE),
  "voice_trace": bool($VOICE),
  "local_gateway_probe": bool($LOCAL_PROBE),
  "verification_sources": ["mission_control_protected_probe_route"] if bool($LOCAL_PROBE) else [],
  "voice_transcribed_signal": bool($FOUND_TRANSCRIPT),
  "opencloud_signal": bool($FOUND_OPENCLOUD),
  "opencloud_intermediary": bool($FOUND_OPENCLOUD),
  "opencloud_role": "forbidden_hidden_intermediary" if bool($FOUND_OPENCLOUD) else "not_used",
  "route_trace": mission_control_route_trace or local_signal_route_trace,
  "mission_control_route_trace": mission_control_route_trace,
  "status": "$STATUS",
  "blocker": "$BLOCKER",
  "mission_control_trace_status": "$ROUTE_STATUS",
  "mission_control_trace_blocker": "$ROUTE_BLOCKER",
  "visible_task_id": "$ROUTE_VISIBLE_TASK_ID" or None,
  "visible_task_blocker": "$VISIBLE_TASK_BLOCKER" or None,
  "secrets_exposed": False,
  "report_path": "$REPORT",
}
pathlib.Path("$REPORT").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
PY

echo
echo "Report written to: $REPORT"
echo "========================================================="
