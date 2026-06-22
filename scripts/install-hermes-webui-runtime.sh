#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_REPO="${HERMES_WEBUI_SOURCE_REPO:-/home/tony/To-Knowledge-hermes-webui}"
RUNTIME_DIR="${HERMES_WEBUI_RUNTIME_DIR:-/home/tony/hermes-webui-runtime}"
HOST="${HERMES_WEBUI_HOST:-127.0.0.1}"
PORT="${HERMES_WEBUI_PORT:-8787}"

case "$HOST" in
  127.0.0.1|localhost|::1)
    ;;
  *)
    echo "INSTALL_BLOCKED: non_loopback_bind_refused:$HOST"
    exit 2
    ;;
esac

if [[ ! -d "$SOURCE_REPO" ]]; then
  echo "INSTALL_BLOCKED: source_directory_missing:$SOURCE_REPO"
  exit 3
fi

for required in server.py bootstrap.py ctl.sh requirements.txt; do
  if [[ ! -f "$SOURCE_REPO/$required" ]]; then
    echo "INSTALL_BLOCKED: source_required_file_missing:$required"
    exit 4
  fi
done

RUNTIME_PARENT="$(dirname "$RUNTIME_DIR")"
if [[ ! -d "$RUNTIME_PARENT" ]]; then
  echo "INSTALL_BLOCKED: runtime_parent_missing:$RUNTIME_PARENT"
  exit 5
fi

if [[ ! -w "$RUNTIME_PARENT" ]]; then
  echo "INSTALL_BLOCKED: runtime_parent_not_writable:$RUNTIME_PARENT"
  exit 6
fi

mkdir -p "$RUNTIME_DIR/bin" "$RUNTIME_DIR/state" "$RUNTIME_DIR/logs"

RUNNER="$RUNTIME_DIR/bin/run-hermes-webui-local.sh"
cat >"$RUNNER" <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_REPO="$SOURCE_REPO"
RUNTIME_DIR="$RUNTIME_DIR"
export HERMES_WEBUI_HOST="\${HERMES_WEBUI_HOST:-$HOST}"
export HERMES_WEBUI_PORT="\${HERMES_WEBUI_PORT:-$PORT}"

case "\$HERMES_WEBUI_HOST" in
  127.0.0.1|localhost|::1)
    ;;
  *)
    echo "RUN_BLOCKED: non_loopback_bind_refused:\$HERMES_WEBUI_HOST"
    exit 2
    ;;
esac

export HERMES_WEBUI_STATE_DIR="\${HERMES_WEBUI_STATE_DIR:-\$RUNTIME_DIR/state}"
export HERMES_WEBUI_PID_FILE="\${HERMES_WEBUI_PID_FILE:-\$RUNTIME_DIR/hermes-webui.pid}"
export HERMES_WEBUI_LOG_FILE="\${HERMES_WEBUI_LOG_FILE:-\$RUNTIME_DIR/logs/hermes-webui.log}"
export HERMES_WEBUI_CTL_STATE_FILE="\${HERMES_WEBUI_CTL_STATE_FILE:-\$RUNTIME_DIR/hermes-webui.ctl.state}"
export HERMES_WEBUI_AUTO_INSTALL="\${HERMES_WEBUI_AUTO_INSTALL:-0}"
export HERMES_WEBUI_SKIP_ONBOARDING="\${HERMES_WEBUI_SKIP_ONBOARDING:-1}"

cd "\$SOURCE_REPO"
exec ./ctl.sh start --skip-agent-install
EOF
chmod 0755 "$RUNNER"

cat <<EOF
INSTALL_OK: $RUNNER
bind_policy: loopback_only
host: $HOST
port: $PORT
source_repo: $SOURCE_REPO
runtime_dir: $RUNTIME_DIR
start_command: $RUNNER
status_command: cd $SOURCE_REPO && HERMES_WEBUI_PID_FILE=$RUNTIME_DIR/hermes-webui.pid HERMES_WEBUI_LOG_FILE=$RUNTIME_DIR/logs/hermes-webui.log HERMES_WEBUI_CTL_STATE_FILE=$RUNTIME_DIR/hermes-webui.ctl.state HERMES_WEBUI_STATE_DIR=$RUNTIME_DIR/state ./ctl.sh status
rollback_command: cd $SOURCE_REPO && HERMES_WEBUI_PID_FILE=$RUNTIME_DIR/hermes-webui.pid HERMES_WEBUI_LOG_FILE=$RUNTIME_DIR/logs/hermes-webui.log HERMES_WEBUI_CTL_STATE_FILE=$RUNTIME_DIR/hermes-webui.ctl.state HERMES_WEBUI_STATE_DIR=$RUNTIME_DIR/state ./ctl.sh stop
no_secret_proof: env_names_only_no_values
public_exposure_created: false
EOF
