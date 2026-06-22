import { buildExecutionReadinessEntries } from '@/lib/execution-readiness-matrix'
import { classifyJarvisAction } from '@/lib/jarvis-action-classifier'
import { listJarvisAdapters } from '@/lib/jarvis-adapter-registry'
import { jarvisOwnerOperatorPolicy } from '@/lib/jarvis-owner-operator-policy'

export function buildJarvisAuthorityMatrix() {
  const surfaces = [
    { id: 'gateway_status', route: '/api/bridge/runtime-services', action: 'read runtime services', category: 'mission_control_read' },
    { id: 'provider_registry', route: '/api/bridge/providers', action: 'read providers', category: 'gateway_read' },
    { id: 'mcp_registry', route: '/api/bridge/mcp-readiness', action: 'read mcp registry', category: 'gateway_read' },
    { id: 'brain_status', route: '/api/bridge/brain-readiness', action: 'read brain status', category: 'gateway_read' },
    { id: 'paperclip_eco', route: '/api/bridge/paperclip/status', action: 'read Paperclip ECO', category: 'gateway_read' },
    { id: 'approval_queue', route: '/api/bridge/approval-requests', action: 'read approvals', category: 'mission_control_read' },
    { id: 'jarvis_internal_write', route: '/api/bridge/agent-zero/internal-write', action: 'write internal Mission Control record', category: 'internal_state_write' },
    { id: 'jarvis_workflows', route: '/api/bridge/agent-zero/workflows', action: 'write workflow record', category: 'internal_state_write' },
    { id: 'jarvis_exact_scope_execute', route: '/api/bridge/agent-zero/execute', action: 'execute exact-scope MCP status probe', category: 'mcp_tool_execution' },
    { id: 'provider_execution', route: '/api/bridge/providers', action: 'execute provider model', category: 'provider_execution' },
    { id: 'mcp_execution', route: '/api/mcp/servers/[id]/[action]', action: 'execute MCP tool', category: 'mcp_tool_execution' },
    { id: 'env_edit', route: 'hard-stop', action: 'edit .env or inject credential', category: 'credential_or_secret' },
    { id: 'public_exposure', route: 'hard-stop', action: 'change DNS/Caddy/Tailscale/firewall', category: 'public_exposure' },
  ]

  const rows = surfaces.map((surface) => ({
    ...surface,
    ...classifyJarvisAction(surface),
  }))
  const readiness = buildExecutionReadinessEntries()
  const adapters = listJarvisAdapters()
  return {
    generated_at: new Date().toISOString(),
    contract_version: 'jarvis-authority-v1',
    policy: jarvisOwnerOperatorPolicy(),
    rows,
    readiness_entries: readiness,
    adapters,
    summary: {
      total_rows: rows.length,
      direct_read: rows.filter((row) => row.classification === 'DIRECT_READ').length,
      direct_internal_write: rows.filter((row) => row.classification === 'DIRECT_INTERNAL_WRITE').length,
      bridge_gated: rows.filter((row) => row.classification === 'BRIDGE_GATED').length,
      hard_stop: rows.filter((row) => row.classification === 'HARD_STOP').length,
      disabled: rows.filter((row) => row.classification === 'DISABLED').length,
      readiness_entries: readiness.length,
      adapter_entries: adapters.length,
    },
  }
}
