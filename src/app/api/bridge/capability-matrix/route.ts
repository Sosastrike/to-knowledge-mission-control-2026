import { NextRequest } from 'next/server'
import { buildPiDispatcherStatus } from '@/lib/bridge-dispatcher-registry'
import { buildExecutionReadinessMatrix } from '@/lib/execution-readiness-matrix'
import { jarvisExecutionRouterStatus } from '@/lib/jarvis-execution-router'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const piGatewayAgentStatus = buildPiDispatcherStatus()

const agents = [
  {
    id: 'agent_zero',
    label: 'Agent Zero',
    role: 'commander/supervisor',
    status: 'partial_ui_restored',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: false,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'gateway_brokered_no_secret_values',
    health: '/api/agent-zero/status',
  },
  {
    id: 'pi',
    label: 'Pi',
    role: 'full_access_gateway_agent',
    status: 'full_access_direct_gateway_pipeline',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'no_direct_secret_access',
    health: '/api/bridge/pi/status',
  },
  {
    id: 'hermes',
    label: 'Ron Weasley',
    role: 'nuclear_dispatcher/optimization_and_workflow_architect',
    status: 'full_access_delegated_direct_gateway_line',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: true,
    execution_allowed: true,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'no_direct_secret_access_jarvis_brokered',
    health: '/api/bridge/hermes/full-access/status',
    exact_blocker: 'jarvis_signed_exact_scope_delegation_required',
  },
  {
    id: 'paperclip',
    label: 'Paperclip',
    role: 'workforce control plane',
    status: 'installed_ready_writes_bridge_gated',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: false,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'paperclip_auth_preserved_no_password_storage',
    health: '/api/bridge/paperclip/status',
  },
  {
    id: 'openclaw_plus',
    label: 'OpenClaw+',
    role: 'runtime/skills/mini-agent execution layer',
    status: 'tunnel_live_doctor_cli_blocked',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: false,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: false,
    credential_policy: 'owner_tunnel_only_no_public_exposure',
    health: '/api/openclaw-plus/status',
  },
  {
    id: 'spaceagent',
    label: 'SpaceAgent',
    role: 'browser/research specialist',
    status: 'partial_mission_control_panel_only',
    visible_to_gateway: true,
    visible_to_PI: true,
    visible_to_agent_runtime: false,
    execution_allowed: false,
    bridge_required: true,
    adapter_present: true,
    credential_policy: 'playwright_local_only_firecrawl_credential_gated',
    health: '/api/bridge/space-agent/status',
  },
]

const modelProviders = [
  { id: 'claude_cli', label: 'Claude CLI', status: 'read_only' },
  { id: 'openrouter', label: 'OpenRouter', status: 'credential_gated' },
  { id: 'ollama', label: 'Ollama', status: 'service_down' },
  { id: 'openai', label: 'OpenAI', status: 'credential_gated' },
  { id: 'nvidia', label: 'NVIDIA', status: 'credential_gated' },
]

const toolInventory = [
  { id: 'provider_registry', state: 'READ_ONLY', visible_to_PI: true, adapter_present: true, credential_policy: 'names_only_no_secret_values', writes_enabled: false, execution_enabled: false, bridge_required: true },
  { id: 'capability_matrix', state: 'READ_ONLY', visible_to_PI: true, adapter_present: true, credential_policy: 'not_required_for_read_only_inventory', writes_enabled: false, execution_enabled: false, bridge_required: true },
  { id: 'mcp_health', state: 'READ_ONLY', visible_to_PI: true, adapter_present: true, credential_policy: 'no_direct_secret_access', writes_enabled: false, execution_enabled: false, bridge_required: true },
  { id: 'agent_roster', state: 'READ_ONLY', visible_to_PI: true, adapter_present: true, credential_policy: 'not_required_for_read_only_roster', writes_enabled: false, execution_enabled: false, bridge_required: false },
  { id: 'bridge_readiness', state: 'READ_ONLY', visible_to_PI: true, adapter_present: true, credential_policy: 'owner_approval_required_for_mutations', writes_enabled: false, execution_enabled: false, bridge_required: true },
  { id: 'skills_tools_inventory', state: 'READ_ONLY', visible_to_PI: true, adapter_present: true, credential_policy: 'install_mutation_owner_gated', writes_enabled: false, execution_enabled: false, bridge_required: true },
  { id: 'firecrawl', state: 'CREDENTIAL_GATED', visible_to_PI: true, adapter_present: false, credential_policy: 'firecrawl_credential_required', writes_enabled: false, execution_enabled: false, bridge_required: true },
  { id: 'zapier', state: 'CERTIFIED_EXACT_SCOPE', visible_to_PI: true, adapter_present: true, credential_policy: 'zapier_mcp_brokered_no_secret_values', writes_enabled: false, execution_enabled: true, bridge_required: true, exact_adapter: 'zapier_exact_action_execute', exact_action: 'zapier.connection_probe' },
  { id: 'n8n', state: 'CREDENTIAL_GATED', visible_to_PI: true, adapter_present: true, credential_policy: 'env_name_presence_only_no_secret_values', writes_enabled: false, execution_enabled: false, bridge_required: true, exact_adapter: 'n8n_workflow_list' },
]

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const executionReadinessMatrix = buildExecutionReadinessMatrix()
  const jarvisExecutionRouter = jarvisExecutionRouterStatus()

  return readOnly({
    route: 'bridge.capability-matrix',
    mode: 'read_only_capability_matrix',
    blocker_class: 'OWNER_GATED',
    no_go_claim: true,
    go_claim_allowed: false,
    protected_execution_enabled: false,
    exact_scope_execution_enabled: true,
    approval_request_created: false,
    audit_record_written: false,
    credential_values_exposed: false,
    external_writes_enabled: false,
    no_execution_enabled: true,
    no_memory_writes_enabled: true,
    no_connector_writes_enabled: true,
    agents,
    model_providers: modelProviders,
    tool_inventory: toolInventory,
    execution_readiness_matrix: executionReadinessMatrix,
    jarvis_execution_router: jarvisExecutionRouter,
    pi_gateway_agent: piGatewayAgentStatus,
    pi_visibility_contract: piGatewayAgentStatus.visibility_contract,
    approval_gates: ['credentials', 'memory writes', 'Zapier writes', 'connector execution', 'production DB migrations'],
    summary: {
      agents: agents.length,
      model_providers: modelProviders.length,
      tools: toolInventory.length,
      execution_readiness_entries: executionReadinessMatrix.summary.total,
      exact_scope_executable_actions: executionReadinessMatrix.entries.filter((entry) => entry.execution_allowed).map((entry) => entry.id),
      connector_writes_enabled: 0,
      protected_actions_locked: true,
    },
    rollback_command: 'keep capability matrix read-only and route all promotions through Bridge approval, audit, and rollback proof',
  })
}
