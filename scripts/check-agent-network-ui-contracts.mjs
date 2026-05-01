#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const file = 'src/components/agent-network/AgentNetworkClient.tsx'
const source = readFileSync(file, 'utf8')

const requiredContracts = [
  { id: 'capability_matrix', needle: '/api/bridge/capability-matrix' },
  { id: 'connector_readiness', needle: '/api/bridge/connector-readiness' },
  { id: 'preflight', needle: '/api/bridge/preflight' },
  { id: 'approval_readiness', needle: '/api/bridge/approval-readiness' },
  { id: 'approval_queue', needle: '/api/bridge/approval-requests' },
  { id: 'costs', needle: '/api/bridge/costs' },
  { id: 'owner_gates', needle: '/api/bridge/owner-gates' },
  { id: 'execution_cycle', needle: '/api/bridge/execution-cycle' },
  { id: 'executive_report_preview', needle: '/api/bridge/executive-report-preview' },
  { id: 'telegram_approval_preview', needle: '/api/bridge/telegram-approval-preview' },
]

const requiredCopy = [
  { id: 'bridge_mode_read_only', needle: 'read-only' },
  { id: 'owner_gates_visibility_only', needle: 'Owner gates are visibility only' },
  { id: 'execution_cycle_mandatory', needle: 'Every agent must pass through Bridge Mode before acting' },
  { id: 'approval_system_status_empty_queue', needle: 'Approval system status' },
  { id: 'no_fake_approval_requests', needle: 'not sending approval requests' },
  { id: 'no_zapier_writes', needle: 'writing to Zapier' },
]

const forbiddenPatterns = [
  { id: 'approval_request_post_from_ui', pattern: /fetch\(['"]\/api\/bridge\/approval-requests['"],[\s\S]{0,240}method:\s*['"]POST['"]/ },
  { id: 'approval_approve_post_from_ui', pattern: /\/api\/bridge\/approval-requests\/[^'"`]+\/(approve|deny)/ },
  { id: 'connector_execute_success_claim', pattern: /execution\s+(completed|succeeded|started)/i },
  { id: 'zapier_write_success_claim', pattern: /zapier\s+write\s+(completed|succeeded|started)/i },
]

const missingContracts = requiredContracts.filter((item) => !source.includes(item.needle))
const missingCopy = requiredCopy.filter((item) => !source.includes(item.needle))
const forbidden = forbiddenPatterns.filter((item) => item.pattern.test(source))

const report = {
  ok: missingContracts.length === 0 && missingCopy.length === 0 && forbidden.length === 0,
  file,
  contracts_checked: requiredContracts.length,
  required_copy_checked: requiredCopy.length,
  missing_contracts: missingContracts,
  missing_copy: missingCopy,
  forbidden_matches: forbidden.map((item) => item.id),
  invariants: {
    ui_consumes_readonly_bridge_contracts: missingContracts.length === 0,
    owner_gates_visible: source.includes('/api/bridge/owner-gates') && source.includes('Owner Gates / Blockers'),
    execution_cycle_visible: source.includes('/api/bridge/execution-cycle') && source.includes('Agent Execution Cycle'),
    approval_queue_placeholder_visible: source.includes('/api/bridge/approval-readiness') && source.includes('activeQueueVisible') && source.includes('Approval system status'),
    no_protected_execution_from_ui: forbidden.length === 0,
  },
}

const text = JSON.stringify(report, null, 2)
if (!report.ok) {
  console.error(text)
  process.exit(1)
}
console.log(text)
