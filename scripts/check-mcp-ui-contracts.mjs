#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const files = {
  mcpToolsPage: 'public/designer-mission-control/src/replicas/MCPToolsPage.jsx',
  agentNetworkClient: 'src/components/agent-network/AgentNetworkClient.tsx',
}

const mcpToolsPage = readFileSync(files.mcpToolsPage, 'utf8')
const agentNetworkClient = readFileSync(files.agentNetworkClient, 'utf8')

const failures = []

function requireText(name, source, needle) {
  if (!source.includes(needle)) failures.push({ file: name, error: 'missing_required_text', needle })
}

function forbidText(name, source, needle) {
  if (source.includes(needle)) failures.push({ file: name, error: 'forbidden_text_present', needle })
}

requireText(files.mcpToolsPage, mcpToolsPage, 'canonical_status')
requireText(files.mcpToolsPage, mcpToolsPage, 'blocker_class')
requireText(files.mcpToolsPage, mcpToolsPage, 'Tool execution remains unavailable and no live tools are being claimed.')
requireText(files.mcpToolsPage, mcpToolsPage, 'visible_to?.owner')
forbidText(files.mcpToolsPage, mcpToolsPage, 'visible_to?.tony')
forbidText(files.mcpToolsPage, mcpToolsPage, '~/.claude/mcp.json')
forbidText(files.mcpToolsPage, mcpToolsPage, 'No MCP servers detected. Configure')

requireText(files.agentNetworkClient, agentNetworkClient, "id: 'mcp_servers'")
requireText(files.agentNetworkClient, agentNetworkClient, "status: 'blocked'")
requireText(files.agentNetworkClient, agentNetworkClient, "statusLabel: 'registry blocked'")
forbidText(files.agentNetworkClient, agentNetworkClient, "label: 'MCP Servers', lane: 'output', eyebrow: 'output', status: 'connected'")
forbidText(files.agentNetworkClient, agentNetworkClient, "schemas visible")

const result = {
  ok: failures.length === 0,
  checked_files: Object.values(files),
  failures,
}

if (failures.length > 0) {
  console.error(JSON.stringify(result, null, 2))
  process.exit(1)
}

console.log(JSON.stringify(result, null, 2))
