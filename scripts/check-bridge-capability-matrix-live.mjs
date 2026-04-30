#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

const baseUrl = (process.argv[2] || process.env.MISSION_CONTROL_BASE_URL || 'http://127.0.0.1:3337').replace(/\/+$/, '')
const apiKey = (process.env.MISSION_CONTROL_API_KEY || process.env.API_KEY || readApiKeyFromDb()).trim()

if (!apiKey) {
  console.error(JSON.stringify({ ok: false, error: 'missing_api_key_for_local_check' }, null, 2))
  process.exit(1)
}

function readApiKeyFromDb() {
  try {
    return execFileSync('sqlite3', [
      '.data/mission-control.db',
      "SELECT value FROM settings WHERE key='security.api_key' LIMIT 1;",
    ], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

const response = await fetch(`${baseUrl}/api/bridge/capability-matrix`, {
  headers: { 'x-api-key': apiKey },
  cache: 'no-store',
  signal: AbortSignal.timeout(7000),
})
const body = await response.json().catch(() => ({}))

const failures = []
if (response.status !== 200 || body?.ok !== true) {
  failures.push({ path: '/api/bridge/capability-matrix', status: response.status, error: 'capability_matrix_not_ok' })
}

const agents = Array.isArray(body.agents) ? body.agents : []
const tools = Array.isArray(body.tool_inventory) ? body.tool_inventory : []
const providers = Array.isArray(body.model_providers) ? body.model_providers : []
const gates = Array.isArray(body.approval_gates) ? body.approval_gates : []

const agentById = new Map(agents.map((agent) => [agent.id, agent]))
const toolById = new Map(tools.map((tool) => [tool.id, tool]))
const providerById = new Map(providers.map((provider) => [provider.id, provider]))

for (const id of ['tony', 'agent_zero', 'hermes', 'openclaw_gateway']) {
  if (!agentById.has(id)) failures.push({ id, error: 'required_agent_missing' })
}

if (agentById.get('tony')?.status !== 'active') failures.push({ id: 'tony', error: 'tony_not_active' })
if (!['active', 'degraded'].includes(agentById.get('agent_zero')?.status)) {
  failures.push({ id: 'agent_zero', error: 'agent_zero_not_observable' })
}
if (agentById.get('hermes')?.status !== 'sandbox') failures.push({ id: 'hermes', error: 'hermes_not_sandbox' })

for (const id of ['claude_cli', 'openrouter', 'ollama', 'openai', 'nvidia']) {
  if (!providerById.has(id)) failures.push({ id, error: 'required_model_provider_missing' })
}

for (const id of ['firecrawl', 'viral_crawl_video', 'zapier', 'n8n', 'mcp_tools', 'skills']) {
  if (!toolById.has(id)) failures.push({ id, error: 'required_tool_missing' })
}

for (const tool of tools) {
  if (tool.writes_enabled === true || tool.execution_enabled === true) {
    failures.push({ id: tool.id, error: 'tool_enabled_execution_or_writes' })
  }
}

for (const [field, expected] of [
  ['no_execution_enabled', true],
  ['no_memory_writes_enabled', true],
  ['no_connector_writes_enabled', true],
]) {
  if (body?.[field] !== expected) failures.push({ field, error: 'matrix_invariant_not_locked' })
}

if (body.summary?.connector_writes_enabled !== 0) failures.push({ error: 'connector_writes_enabled_nonzero', summary: body.summary })
if (body.summary?.protected_actions_locked !== true) failures.push({ error: 'protected_actions_not_locked', summary: body.summary })

for (const gate of ['credentials', 'memory writes', 'Zapier writes', 'connector execution', 'production DB migrations']) {
  if (!gates.includes(gate)) failures.push({ gate, error: 'required_approval_gate_missing' })
}

const report = {
  ok: failures.length === 0,
  base_url: baseUrl,
  status: response.status,
  mode: body.mode,
  summary: body.summary || null,
  agents: agents.map((agent) => ({ id: agent.id, status: agent.status, role: agent.role })),
  model_providers: providers.map((provider) => ({ id: provider.id, status: provider.status })),
  tools: tools.map((tool) => ({ id: tool.id, state: tool.state, writes_enabled: tool.writes_enabled === true, execution_enabled: tool.execution_enabled === true })),
  failures,
}

const text = JSON.stringify(report, null, 2)
if (failures.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
