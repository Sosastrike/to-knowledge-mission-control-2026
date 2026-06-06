#!/usr/bin/env bash
set -euo pipefail

CONSOLE_URL="${AGENTMAIL_CONSOLE_URL:-https://app.agentmail.to}"
MCP_URL="${AGENTMAIL_MCP_URL:-https://mcp.agentmail.to/mcp}"

say() {
  printf '%s\n' "$*"
}

open_url() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then
    open "$url"
    return 0
  fi
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url"
    return 0
  fi
  return 1
}

say "AgentMail hosted-console connect"
say "This opens the official hosted AgentMail console for owner Google/SSO sign-in."
say "It does not collect Google credentials, read browser cookies, write secrets, edit .env, or enable email sending."
say ""
say "Hosted console: $CONSOLE_URL"
say "Hosted MCP URL: $MCP_URL"
say ""

if open_url "$CONSOLE_URL"; then
  say "Opened AgentMail hosted console."
else
  say "No browser opener is available in this shell."
  say "Open this URL from an owner browser:"
  say "$CONSOLE_URL"
fi

if command -v claude >/dev/null 2>&1; then
  say ""
  say "Claude Code CLI detected. Registering AgentMail hosted MCP connector."
  if claude mcp add --transport http agentmail "$MCP_URL"; then
    say "AgentMail MCP registration command completed."
  else
    say "AgentMail MCP registration command did not complete; keep Mission Control in API-key fallback mode."
  fi
else
  say ""
  say "MCP CLI unavailable. Mission Control remains in API-key fallback mode until a supported MCP client or scoped AgentMail API credential is configured."
fi

say ""
say "Next safe step: return to Mission Control /agentmail and run Sync inbox registry after the owner completes AgentMail sign-in."
say "Send remains approval-required and Bridge/Gateway-gated."
