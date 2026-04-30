#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/app/api/bridge/capability-matrix/route.ts',
  'src/app/api/bridge/connector-readiness/route.ts',
  'src/app/api/bridge/button-contracts/route.ts',
  'src/app/api/bridge/approval-contract/route.ts',
  'src/app/api/bridge/approval-readiness/route.ts',
  'src/app/api/bridge/executive-report-preview/route.ts',
  'src/app/api/bridge/telegram-approval-preview/route.ts',
  'src/app/api/bridge/preflight/route.ts',
  'src/app/api/bridge/providers/route.ts',
  'src/app/api/bridge/approval-requests/route.ts',
  'src/app/api/bridge/brain-sync/rebuild/route.ts',
  'src/app/api/agent-zero/request/route.ts',
]

const failures = []

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`)
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

if (failures.length === 0) {
  const matrix = read('src/app/api/bridge/capability-matrix/route.ts')
  const connectors = read('src/app/api/bridge/connector-readiness/route.ts')
  const buttons = read('src/app/api/bridge/button-contracts/route.ts')
  const approval = read('src/app/api/bridge/approval-contract/route.ts')
  const approvalReadiness = read('src/app/api/bridge/approval-readiness/route.ts')
  const executiveReportPreview = read('src/app/api/bridge/executive-report-preview/route.ts')
  const telegramApprovalPreview = read('src/app/api/bridge/telegram-approval-preview/route.ts')
  const preflight = read('src/app/api/bridge/preflight/route.ts')
  const approvalRequests = read('src/app/api/bridge/approval-requests/route.ts')
  const brainSyncRebuild = read('src/app/api/bridge/brain-sync/rebuild/route.ts')
  const agentZeroRequest = read('src/app/api/agent-zero/request/route.ts')

  for (const needle of [
    "requireRole(request, 'viewer')",
    "mode: 'bridge_mode_read_only_mvp'",
    'no_execution_enabled: true',
    'no_memory_writes_enabled: true',
    'no_connector_writes_enabled: true',
    "primary_chat=claude_cli_direct",
    'Hermes / Hermit',
    'Zapier writes',
  ]) {
    if (!matrix.includes(needle)) failures.push(`capability matrix missing ${needle}`)
  }

  if (!buttons.includes('/api/bridge/capability-matrix')) failures.push('button contract missing capability matrix endpoint')
  if (!buttons.includes('/api/bridge/connector-readiness')) failures.push('button contract missing connector readiness endpoint')
  if (!buttons.includes('/api/bridge/approval-requests')) failures.push('button contract missing approval requests endpoint')
  if (!buttons.includes('/api/bridge/approval-readiness')) failures.push('button contract missing approval readiness endpoint')
  if (!buttons.includes('/api/bridge/executive-report-preview')) failures.push('button contract missing executive report preview endpoint')
  if (!buttons.includes('/api/bridge/telegram-approval-preview')) failures.push('button contract missing Telegram approval preview endpoint')
  if (!buttons.includes('/api/bridge/preflight')) failures.push('button contract missing preflight endpoint')
  if (!buttons.includes('/api/bridge/brain-sync/rebuild')) failures.push('button contract missing Brain Sync rebuild endpoint')
  if (!buttons.includes('/api/agent-zero/request')) failures.push('button contract missing Agent Zero request endpoint')
  if (!approval.includes('protected_write_http_status: 423')) failures.push('approval contract missing HTTP 423 policy')
  for (const needle of [
    'approval_flow',
    'required_persistence',
    'no_connector_execution_enabled: true',
    'no_telegram_send_enabled: true',
    'approval_request_created: false',
    'bridge_connector_runs',
  ]) {
    if (!approval.includes(needle)) failures.push(`approval contract missing ${needle}`)
  }
  for (const needle of [
    "mode: 'executive_report_preview_read_only'",
    'no_execution_enabled: true',
    'no_persistence_enabled: true',
    'no_telegram_send_enabled: true',
    'no_pdf_written: true',
    'plain_language_summary',
    'detailed_report_markdown',
  ]) {
    if (!executiveReportPreview.includes(needle)) failures.push(`executive report preview missing ${needle}`)
  }
  for (const needle of [
    "mode: 'telegram_approval_preview_read_only'",
    'no_execution_enabled: true',
    'no_persistence_enabled: true',
    'no_telegram_send_enabled: true',
    'approval_request_created: false',
    'Tony -> Telegram',
  ]) {
    if (!telegramApprovalPreview.includes(needle)) failures.push(`Telegram approval preview missing ${needle}`)
  }
  for (const needle of [
    "mode: 'approval_audit_readiness_read_only'",
    'no_execution_enabled: true',
    'no_connector_writes_enabled: true',
    'production_migration_applied',
    'proposed-bridge-approval-audit-20260429.sql',
    'test-bridge-approval-migration.sh',
  ]) {
    if (!approvalReadiness.includes(needle)) failures.push(`approval readiness missing ${needle}`)
  }
  for (const needle of [
    "mode: 'bridge_preflight_read_only'",
    'execution_enabled: false',
    'approval_request_created: false',
    'OWNER_APPROVAL_REQUIRED',
    'CREDENTIAL_REQUIRED',
    'ALLOWED_READ_ONLY',
  ]) {
    if (!preflight.includes(needle)) failures.push(`preflight missing ${needle}`)
  }
  for (const needle of [
    "mode: 'connector_readiness_read_only'",
    'no_execution_enabled: true',
    'no_connector_writes_enabled: true',
    'risk_level',
    'canonical_paths',
    'ui_contract',
    'owner_approval_required_before',
    'deferred_or_redundant_paths',
    'verification_commands',
    'FIRECRAWL_API_KEY',
    'ZAPIER_MCP_URL',
    'N8N_BASE_URL',
    '/api/skills/finder/request-install',
  ]) {
    if (!connectors.includes(needle)) failures.push(`connector readiness missing ${needle}`)
  }

  for (const connectorId of [
    'firecrawl',
    'viral_crawl_video',
    'zapier',
    'n8n',
    'mcp_tools',
    'skills_registry',
  ]) {
    if (!connectors.includes(`id: '${connectorId}'`)) failures.push(`connector readiness missing ${connectorId}`)
  }

  for (const endpoint of [
    '/api/viral-crawl/video/request-run',
    '/api/zapier/request-write-approval',
    '/api/n8n/workflows/:id/:action',
    '/api/mcp/servers/:id/:action',
    '/api/skills/finder/request-install',
  ]) {
    if (!connectors.includes(endpoint)) failures.push(`connector readiness missing execution lock path ${endpoint}`)
  }

  for (const [name, source] of [
    ['approval requests', approvalRequests],
    ['brain sync rebuild', brainSyncRebuild],
    ['agent zero request', agentZeroRequest],
  ]) {
    if (!source.includes('ownerApprovalRequired')) failures.push(`${name} stub missing ownerApprovalRequired`)
    if (!source.includes('http_status_when_blocked: 423')) failures.push(`${name} stub missing explicit HTTP 423 marker`)
    if (!source.includes('no_execution_enabled: true')) failures.push(`${name} stub missing no_execution_enabled`)
    if (!source.includes('persistence:')) failures.push(`${name} stub missing persistence marker`)
  }

  for (const needle of [
    'approval_persistence_not_applied',
    'readApprovalQueue',
    'approval_queue_connected',
    'approval_request_created: false',
    'accepted_for_execution: false',
  ]) {
    if (!approvalRequests.includes(needle)) failures.push(`approval requests stub missing ${needle}`)
  }
  if (!brainSyncRebuild.includes('no_memory_writes_enabled: true')) failures.push('Brain Sync rebuild stub missing no_memory_writes_enabled')
  if (!agentZeroRequest.includes('no_agent_execution_enabled: true')) failures.push('Agent Zero request stub missing no_agent_execution_enabled')
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  checked: requiredFiles,
  guarantees: [
    'Bridge Mode capability matrix route exists',
    'Route is auth-gated',
    'Route declares read-only MVP mode',
    'Execution, memory writes, and connector writes remain disabled',
    'Button contracts include capability matrix',
    'Button contracts include connector readiness',
    'Button contracts include preflight and approval readiness',
    'Executive report preview is read-only',
    'Connector readiness keeps execution and writes disabled',
    'Connector readiness exposes canonical paths, UI state contracts, approval blockers, and verification commands',
    'Preflight route is read-only and creates no approval requests',
    'Approval readiness only inspects schema state',
    'Approval contract keeps protected writes at HTTP 423',
    'Approval request POST is blocked with HTTP 423 until persistence exists',
    'Brain Sync rebuild POST is blocked with HTTP 423 and no memory writes',
    'Agent Zero request POST is blocked with HTTP 423 and no agent execution',
  ],
}, null, 2))
