import fs from 'node:fs'
import path from 'node:path'
import { defaultAgentZeroBridgeSessionObject, type AgentZeroBridgeSessionObject } from './agent-zero-bridge-session'
import { inferSkillRoleTags, type SkillRoleTag } from '@/lib/skill-role-tags'

export const AGENT_ZERO_DEFAULT_BASE_URL = 'http://100.116.35.95:50080'
export const AGENT_ZERO_API_KEY_ENV_NAMES = [
  'AGENT_ZERO_API_KEY',
  'AGENT_ZERO_EXTERNAL_API_KEY',
  'AGENT_ZERO_BRIDGE_API_KEY',
]
export const AGENT_ZERO_API_KEY_FILE_ENV_NAME = 'AGENT_ZERO_API_KEY_FILE'
export const AGENT_ZERO_DEFAULT_API_KEY_FILE =
  '/home/tony/.config/mission-control/secrets/agent-zero-api-key'
export const AGENT_ZERO_SYSTEMD_CREDENTIAL_NAMES = [
  'agent-zero-api-key',
  'AGENT_ZERO_API_KEY',
  'agent_zero_api_key',
]

export type AgentZeroApiKeyState = {
  required: true
  present: boolean
  configured_env_name: string | null
  source_type: 'environment' | 'secret_file' | 'systemd_credential' | 'missing'
  source_path: string | null
  accepted_env_names: string[]
  accepted_file_env_name: string
  accepted_systemd_credential_names: string[]
  redacted: string | null
}

export type AgentZeroRuntimeProbe = {
  base_url: string
  web_endpoint: string
  health_endpoint: string
  chat_endpoint: string
  probe_strategy: 'http_health_endpoints'
  checked_endpoints: string[]
  selected_endpoint: string | null
  docker_required: false
  docker_status: 'not_checked'
  reachable: boolean
  health_ok: boolean
  http_status: number | null
  latency_ms: number | null
  version: string | null
  commit_hash: string | null
  error: string | null
}

export type AgentZeroEcosystemAgentState = 'active' | 'connected' | 'degraded' | 'offline'
export type MissionControlCanonicalStatus =
  | 'LIVE'
  | 'READY'
  | 'OWNER_GATED'
  | 'CREDENTIAL_GATED'
  | 'SERVICE_DOWN'
  | 'BLOCKED'
  | 'DISABLED'
export type MissionControlClosureBlockerClass =
  | 'NONE'
  | 'OWNER_GATED'
  | 'CREDENTIAL_GATED'
  | 'SERVICE_DOWN'
  | 'BLOCKED'
  | 'DISABLED'
  | 'HARD_RESET_REQUIRED'

export type AgentZeroProofPacket = {
  lane: 'Agent Zero'
  timestamp: string
  runtime_commit: string | null
  route_or_service_checked: string
  result: MissionControlCanonicalStatus
  blocker: string | null
  blocker_class: MissionControlClosureBlockerClass
  audit_pointer: string | null
  safe_log_pointer: string | null
  rollback_command: string
  docker_required: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type AgentZeroEcosystemAgentRecord = {
  id: 'agent_zero'
  name: 'Agent Zero'
  category: 'agent'
  status: AgentZeroEcosystemAgentState
  state: AgentZeroEcosystemAgentState
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  mode: 'bridge_session_execution' | 'read_only'
  execution_enabled: boolean
  writes_enabled: false
  bridge_session_required: true
  full_access_via_bridge: boolean
  health_url: 'configured'
  chat_route: '/api/bridge/agent-zero/test-chat'
  capabilities_source: 'mission_control_context'
  health_status: 'healthy' | 'unreachable'
  auth_status: 'configured' | 'missing'
  chat_status: 'working' | 'blocked' | 'not_checked'
  agent_zero_called: boolean
  last_checked: number
  last_checked_at: string
  runtime_detection: {
    strategy: 'http_health_endpoints'
    docker_required: false
    docker_status: 'not_checked'
    checked_endpoints: string[]
    selected_endpoint: string | null
  }
  proof_packet: AgentZeroProofPacket
  detail: {
    endpoint: string
    health_endpoint: string
    chat_endpoint: string
    health_http_status: number | null
    health_latency_ms: number | null
    version: string | null
    commit_hash: string | null
    api_key_configured: boolean
    test_chat_endpoint: '/api/bridge/agent-zero/test-chat'
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem'
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session'
    execution_gateway_endpoint: '/api/bridge/agent-zero/execute'
    capabilities_source: 'mission_control_context'
    mode: 'bridge_session_execution' | 'read_only'
    execution_enabled: boolean
    bridge_session_required: true
    full_access_via_bridge: boolean
    direct_access: false
    proxy_access: true
    blocker: string | null
    notes: string
    error: string | null
  }
  next_action: string
}

export type EcosystemAccessState =
  | 'connected'
  | 'configured'
  | 'visible'
  | 'blocked'
  | 'not_connected'
  | 'unknown'

export type AgentZeroReadOnlyEndpointSummary = {
  endpoint: string
  method: 'GET'
  mcp_server_name: string | null
  status: EcosystemAccessState
  reachable: boolean
  tool_count: number | null
  schema_available: boolean
  execution_enabled: false
  bridge_session_required: true
  blocked_reason: string | null
  note: string
}

export type AgentZeroModelProviderStatus = 'connected' | 'configured' | 'blocked'

export type AgentZeroModelProviderSummary = {
  id: string
  name: string
  status: AgentZeroModelProviderStatus
  credential_present: boolean
  credential_names: string[]
  credential_values_exposed: false
  model_count: number
  models: string[]
  best_use_case: string
  execution_mode: string
  execution_enabled: false
  bridge_session_required: true
  direct_access: false
  proxy_access: true
  blocked_reason: string | null
}

export type AgentZeroSkillSafeMode = 'metadata_only' | 'blocked'
export type AgentZeroSkillRoleTag = SkillRoleTag

export type AgentZeroSkillRegistryItem = {
  id?: string
  name: string
  source: 'agent_zero' | 'openclaw_plus' | 'hermes' | 'mission_control_repo' | 'home_claude' | 'database'
  source_label: string
  path: string | null
  skill_doc_path: string | null
  description: string
  dependencies: string[]
  required_tools: string[]
  required_credentials: string[]
  execution_requirements: string[]
  requirements?: {
    required_tools: string[]
    required_credentials: string[]
    execution_requirements: string[]
    blocked_dependencies: string[]
  }
  missing_dependencies: string[]
  blocked_dependencies: string[]
  blocked_reasons: string[]
  runtime_layer: 'OpenClaw+'
  shared_runtime: true
  owner_agent: null
  available_to?: Array<'agent_zero' | 'hermes'>
  available_to_agents: Array<'agent_zero' | 'hermes'>
  role_tags?: AgentZeroSkillRoleTag[]
  legacy_controller_owns_skill_system: false
  safe_mode: AgentZeroSkillSafeMode
  status: EcosystemAccessState
  execution_enabled: false
  writes_enabled: false
  requires_bridge_session?: true
  direct_access: false
  proxy_access: true
  blocked_reason: string | null
}

export type AgentZeroSkillSourceSummary = {
  source: AgentZeroSkillRegistryItem['source']
  label: string
  root_path: string | null
  status: EcosystemAccessState
  total: number
  runtime_layer: 'OpenClaw+'
  shared_runtime: true
  owner_agent: null
  available_to_agents: Array<'agent_zero' | 'hermes'>
  legacy_controller_owns_skill_system: false
  safe_mode: AgentZeroSkillSafeMode
  blocked_reason: string | null
}

export type AgentZeroCapabilityState = 'connected' | 'configured' | 'blocked'

export type AgentZeroIntegrationCapability = {
  id: string
  name: string
  category:
    | 'storage'
    | 'automation'
    | 'media'
    | 'messaging'
    | 'communication'
    | 'buildwiki'
    | 'developer'
    | 'crawler'
    | 'mcp'
    | 'delivery'
    | 'other'
  status: AgentZeroCapabilityState
  credential_present: boolean
  missing_credential: boolean
  credential_names: string[]
  credential_values_exposed: false
  read_only: boolean
  write_enabled: boolean
  requires_bridge_session: boolean
  execution_enabled: false
  direct_access: false
  proxy_access: true
  tool_count: number | null
  source: string
  blocked_reason: string | null
  notes: string
}

export type AgentZeroToolRegistryItem = {
  id: string
  name: string
  status: EcosystemAccessState
  source: string
  category: string
  mcp_server_name: string | null
  schema_available: boolean
  read_only: boolean
  write_enabled: boolean
  requires_bridge_session: boolean
  missing_credential: boolean
  direct_access: false
  proxy_access: true
  execution_enabled: false
  writes_enabled: false
  blocked_reason: string | null
}

export type AgentZeroBrainPathStatus = 'present' | 'missing' | 'unknown' | 'not_applicable'
export type AgentZeroBrainAdapterStatus = 'available' | 'status_only' | 'blocked' | 'not_available'

export type AgentZeroBrainApiSummary = {
  endpoint: string
  method: 'GET' | 'POST'
  status: EcosystemAccessState
  purpose: string
  read_only: boolean
  write_enabled: boolean
  requires_owner_approval: boolean
  requires_bridge_session: boolean
  execution_enabled: false
  direct_access: false
  proxy_access: true
  blocked_reason: string | null
}

export type AgentZeroBrainSourceRegistryItem = {
  id: 'brain_sync' | 'obsidian' | 'mempalace' | 'graphify' | 'brain_watchers' | string
  name: string
  status: EcosystemAccessState
  raw_state: string
  status_visible: boolean
  read_available: boolean
  write_available: boolean
  blocked: boolean
  blocked_reason: string | null
  read_blocked_reason: string | null
  write_blocked_reason: string | null
  read_adapter: AgentZeroBrainAdapterStatus
  write_adapter: AgentZeroBrainAdapterStatus
  read_content_enabled: boolean
  write_content_enabled: false
  memory_writes_enabled: false
  direct_access: false
  proxy_access: true
  path_status: AgentZeroBrainPathStatus
  index_status: EcosystemAccessState
  last_sync_at: string | null
  last_attempt_at: string | null
  last_error: string | null
  available_read_apis: string[]
  available_write_apis: string[]
  blockers: string[]
  summary: string
  notes: string
}

export type AgentZeroBrainWatchersSummary = {
  status: EcosystemAccessState
  status_visible: boolean
  direct_control_enabled: false
  execution_enabled: false
  direct_access: false
  proxy_access: true
  last_seen_at: string | null
  sources: string[]
  blockers: string[]
  summary: string
}

export type AgentZeroBrainIndexSummary = {
  status: EcosystemAccessState
  indexed_records: number | null
  indexed_sources: string[]
  last_indexed_at: string | null
  search_read_api_available: boolean
  rebuild_write_api_enabled: false
  blockers: string[]
}

export type AgentZeroBuildWikiFarmerSummary = {
  status: EcosystemAccessState
  direct_opencloud_access_visible: boolean
  build_wiki_status_visible: boolean
  read_only: true
  read_available: boolean
  write_available: boolean
  blocked: boolean
  blocked_reason: string | null
  read_blocked_reason: string | null
  write_blocked_reason: string | null
  routes: Record<string, { method: 'GET' | 'POST'; path: string; read_only: boolean; execution_enabled: boolean; requires_bridge_session: boolean }>
  farmer_service: string
  farmer_timer: string
  timer_active: boolean | null
  timer: {
    unit: string
    active: boolean | null
    active_state: string
    unit_file_state: string | null
    next_run_at: string | null
    last_trigger_at: string | null
  }
  service: {
    unit: string
    active: boolean | null
    active_state: string
    sub_state: string
    last_result: string
    last_exit_status: number | null
    last_started_at: string | null
    last_exited_at: string | null
  }
  last_run: {
    status: EcosystemAccessState
    result: string
    exit_status: number | null
    started_at: string | null
    completed_at: string | null
    source: 'systemd_user_service'
  }
  run_now: {
    action: 'buildwiki.run_now'
    connector: 'skill.build_wiki'
    target_service: 'opencloud-docs-farmer.service'
    ui_state: string | null
    approval_state: string | null
    run_state: string | null
    approval_id: string | null
    persistence_ready: boolean
    owner_approval_required: true
    bridge_session_required: true
    execution_enabled: false
    execution_enabled_after_owner_approval: boolean
    dispatch_scope: 'opencloud-docs-farmer.service'
    blocked_reason: string | null
  }
  fork_state: {
    fork1: {
      state: EcosystemAccessState
      label: 'local_buildwiki_farmer'
      status_visible: boolean
      execution_enabled: false
      approval_required: true
      scope: 'opencloud-docs-farmer.service'
    }
    fork2: {
      state: EcosystemAccessState
      label: 'smb_external_farmer'
      smb_mounted: boolean
      execution_enabled: false
      approval_required: true
      blocker: string
    }
  }
  smb: {
    required_for_fork2: true
    mounted: boolean
    mount_status: EcosystemAccessState
    blocker: string
  }
  farmer_execution_enabled: false
  note: string
}

export const AGENT_ZERO_LIVE_REGISTRY_STATES = [
  'connected',
  'configured',
  'read-only',
  'write-enabled',
  'blocked',
  'missing credential',
] as const

export type AgentZeroLiveRegistryState = typeof AGENT_ZERO_LIVE_REGISTRY_STATES[number]

export type AgentZeroLiveRegistryCategory =
  | 'model'
  | 'agent'
  | 'tool'
  | 'skill'
  | 'mcp_server'
  | 'integration'
  | 'bridge_provider'
  | 'brain_system'
  | 'buildwiki_farmer'

export type AgentZeroLiveRegistryItem = {
  id: string
  name: string
  category: AgentZeroLiveRegistryCategory
  states: AgentZeroLiveRegistryState[]
  primary_state: AgentZeroLiveRegistryState
  status_text: string
  connected: boolean
  configured: boolean
  read_only: boolean
  write_enabled: boolean
  blocked: boolean
  missing_credential: boolean
  execution_enabled: boolean
  requires_bridge_session: boolean
  credential_present: boolean | null
  credential_values_exposed: false
  source: string
  endpoint: string | null
  blocked_reason: string | null
  summary: string
  counts?: Record<string, number | null>
}

export type AgentZeroLiveRegistry = {
  mode: 'agent_zero_live_ecosystem_registry'
  generated_at: string
  vocabulary: AgentZeroLiveRegistryState[]
  items: AgentZeroLiveRegistryItem[]
  by_category: Record<AgentZeroLiveRegistryCategory, string[]>
  required_items: string[]
  missing_required_items: string[]
  totals: {
    items: number
    connected: number
    configured: number
    read_only: number
    write_enabled: number
    blocked: number
    missing_credential: number
  }
  secrets_exposed: false
  execution_enabled: boolean
}

export type AgentZeroReadOnlyContext = {
  execution_enabled: boolean
  bridge_session_required: boolean
  mission_control: {
    visible: true
    status: EcosystemAccessState
    mode: 'read_only_bridge_context'
    execution_enabled: boolean
    writes_enabled: boolean
    direct_access: false
    proxy_access: true
    auth_required: true
    surfaces: string[]
  }
  bridge: {
    providers: string[]
    provider_count: number
    provider_registry: Array<{
      id: string
      name: string
      state: string
      category: string
      access: EcosystemAccessState
      execution_enabled: boolean
      direct_access: boolean
      proxy_access: boolean
    }>
    mcp_visible: boolean
    zapier_visible: boolean
    heygen_visible: boolean
    heygen_schema_visible: boolean
    mcp_servers: string[]
    mcp_tools_visible: boolean
  }
  mcp: {
    visible: boolean
    status: EcosystemAccessState
    servers: Array<{
      name: string
      status: string
      transport: string
      tool_count: number | null
      access: EcosystemAccessState
      reachable: boolean
      schema_available: boolean
      execution_enabled: false
      bridge_session_required: true
      blocked_reason: string | null
      tools_endpoint: string
    }>
    endpoint_summaries: AgentZeroReadOnlyEndpointSummary[]
    tool_schema_summary: {
      tools_total: number
      schema_available: boolean
      required_fields: string[]
      write_tools_total: number
      read_tools_total: number
    }
    execution_enabled: false
    writes_enabled: false
    direct_tool_execution_enabled: false
  }
  agents: {
    visible: true
    registry_status: EcosystemAccessState
    items: Array<{
      id: string
      status: string
      role: string
      execution_enabled: boolean
      direct_access: boolean
      proxy_access: boolean
    }>
  }
  models: {
    visible: true
    registry_status: EcosystemAccessState
    total: number
    providers: string[]
    catalog: Array<{
      alias: string
      provider: string
      name: string
    }>
    provider_registry: AgentZeroModelProviderSummary[]
    openrouter_status: EcosystemAccessState
    execution_enabled: false
    bridge_session_required: true
    credential_values_exposed: false
  }
  skills: {
    visible: boolean
    registry_status: EcosystemAccessState
    total: number
    sample: string[]
    shared_runtime: {
      runtime_layer: 'OpenClaw+'
      owner_agent: null
      active_commander: 'agent_zero'
      lieutenant: 'hermes'
      available_to_agents: Array<'agent_zero' | 'hermes'>
      legacy_controller_owns_skill_system: false
      paths_visible: boolean
      required_tools_visible: boolean
      required_credentials_visible: boolean
      execution_requirements_visible: boolean
      blocked_reasons_visible: boolean
      hermes_can_list_all_skills: true
      role_tags_visible: true
      skill_draft_location: 'safe_hermes_skill_draft_area'
      skill_activation_requires: 'agent_zero_bridge_session'
      skill_review_workflow: string
      execution_enabled: false
      writes_enabled: false
      bridge_session_required_for_execution: true
    }
    sources: AgentZeroSkillSourceSummary[]
    registry: AgentZeroSkillRegistryItem[]
    blocked_total: number
    missing_dependencies_total: number
    execution_enabled: false
    bridge_session_required: true
    writes_enabled: false
  }
  tools: {
    visible: boolean
    registry_status: EcosystemAccessState
    registry: AgentZeroToolRegistryItem[]
    zapier_tools_total: number
    mcp_tools_total: number
    read_only_total: number
    write_enabled_total: number
    bridge_session_required_total: number
    missing_credentials_total: number
    google_drive_visible: boolean
    onedrive_visible: boolean
    heygen_schema_visible: boolean
    execution_enabled: false
    writes_enabled: false
  }
  integrations: {
    visible: true
    registry_status: EcosystemAccessState
    registry: AgentZeroIntegrationCapability[]
    connected_total: number
    configured_total: number
    blocked_total: number
    missing_credentials_total: number
    write_enabled_total: number
    bridge_session_required_total: number
    credential_values_exposed: false
    items: Array<{
      id: string
      status: string
      visibility: 'configured' | 'visible' | 'blocked' | 'unknown'
      direct_access: boolean
      proxy_access: boolean
      execution_enabled: boolean
      writes_enabled: boolean
      missing_credential?: boolean
      read_only?: boolean
      write_enabled?: boolean
      requires_bridge_session?: boolean
    }>
  }
  brain: {
    visible: boolean
    system_status: EcosystemAccessState
    registry: AgentZeroBrainSourceRegistryItem[]
    sources: Array<{
      source: string
      status: string
      summary: string
      access: EcosystemAccessState
      direct_access: boolean
      proxy_access: boolean
    }>
    brain_watchers: AgentZeroBrainWatchersSummary
    vault_path_status: {
      obsidian: AgentZeroBrainPathStatus
      mempalace: AgentZeroBrainPathStatus
      graphify: AgentZeroBrainPathStatus
    }
    index_status: AgentZeroBrainIndexSummary
    last_sync_at: string | null
    available_read_apis: AgentZeroBrainApiSummary[]
    available_write_apis: AgentZeroBrainApiSummary[]
    blockers: string[]
    obsidian_visible: boolean
    obsidian_status: EcosystemAccessState
    mempalace_visible: boolean
    mempalace_status: EcosystemAccessState
    graphify_visible: boolean
    graphify_status: EcosystemAccessState
    memory_writes_enabled: false
  }
  opencloud_buildwiki: AgentZeroBuildWikiFarmerSummary
  delivery: {
    report_pdf_delivery_status: EcosystemAccessState
    agent_zero_report_delivery_status: EcosystemAccessState
    agent_zero_report_create_endpoint: '/api/bridge/agent-zero/reports'
    agent_zero_report_list_endpoint: '/api/bridge/agent-zero/reports'
    agent_zero_report_detail_endpoint: '/api/bridge/agent-zero/reports/:id'
    agent_zero_pdf_download_endpoint: '/api/bridge/agent-zero/reports/:id/pdf'
    telegram_reports_visible: boolean
    telegram_pdf_attachment_status: EcosystemAccessState
    telegram_pdf_attachment_blocked_reason: string | null
    telegram_status_endpoint: '/api/bridge/agent-zero/telegram/status'
    telegram_upload_report_endpoint: '/api/bridge/agent-zero/telegram/upload-report'
    mission_control_reports_visible: boolean
    mission_control_report_links_enabled: true
    google_drive_delivery_visible: boolean
    google_drive_status: EcosystemAccessState
    google_drive_delivery_adapter_status: EcosystemAccessState
    google_drive_upload_connector_configured: false
    google_drive_status_endpoint: '/api/bridge/agent-zero/google-drive/status'
    google_drive_folder_lookup_endpoint: '/api/bridge/agent-zero/google-drive/folder-lookup'
    google_drive_upload_test_endpoint: '/api/bridge/agent-zero/google-drive/upload-test-file'
    google_drive_upload_report_endpoint: '/api/bridge/agent-zero/google-drive/upload-report'
    google_drive_verify_link_endpoint: '/api/bridge/agent-zero/google-drive/verify-link'
    onedrive_delivery_visible: boolean
    onedrive_status: EcosystemAccessState
    onedrive_delivery_adapter_status: EcosystemAccessState
    onedrive_upload_connector_configured: false
    onedrive_status_endpoint: '/api/bridge/agent-zero/onedrive/status'
    onedrive_folder_lookup_endpoint: '/api/bridge/agent-zero/onedrive/folder-lookup'
    onedrive_upload_test_endpoint: '/api/bridge/agent-zero/onedrive/upload-test-file'
    onedrive_upload_report_endpoint: '/api/bridge/agent-zero/onedrive/upload-report'
    onedrive_verify_link_endpoint: '/api/bridge/agent-zero/onedrive/verify-link'
    raw_local_paths_exposed: false
    task_ids_in_normal_replies: false
    external_delivery_writes_enabled: false
  }
  bridge_session: AgentZeroBridgeSessionObject & {
    available: boolean
    allowed_scopes: string[]
    blocked_scopes: string[]
  }
  live_registry: AgentZeroLiveRegistry
  restrictions: string[]
}

export type AgentZeroReadOnlyMessageResult = {
  ok: boolean
  status: number
  mode: 'agent_zero_read_only_test_chat'
  agent_zero_called: boolean
  execution_enabled: false
  writes_enabled: false
  blocker: string | null
  response_text: string | null
  context_id: string | null
  raw_response_shape: string[]
  error: string | null
}

const LOCAL_PATH_PATTERN = /(?:\/home\/tony|\/tmp|\/var\/folders|\/a0\/(?:usr|tmp|var))[^\s`'"\])}]*/gi
const INTERNAL_REPORT_PATH_PATTERN = /\bruntime\/(?:executive-reports|reports|task-reports|agent-zero-reports)\/[^\s`'"\])}]*/gi
const AGENT_ZERO_LOCAL_ARTIFACT_PATTERN = /\bCreated\s+\*\*[\s\S]{0,260}?\bPath:\s*`?(?:\/a0\/|Mission Control)/i
const RAW_STAGE_PATTERN = /\b(?:Failed stage|Error stage|Stage failed|Traceback|Stack trace)\b/gi
const ROBOTIC_LABEL_PATTERN = /^\s*(?:Status|Result|Next|Trace|Tool|Tools|Runtime|Model|System|Stage|Output)\s*:\s*/i
const TASK_ID_PATTERN = /\b(?:task[_\s-]*id|task)\s*[:#-]?\s*(?:task[-_])?[a-z0-9][a-z0-9_-]{5,}\b/gi
const INTERNAL_ID_PATTERN = /\b(?:bs|azr|apr|approval|session|report)[_-][a-z0-9][a-z0-9_-]{5,}\b/gi

function ownerAskedForTaskIds(ownerMessage?: string): boolean {
  return /\b(?:(?:task|session|bridge\s*session|approval|report)\s*id|(?:task|session|approval|report)\s*ids|show(?: me)?(?: the)? (?:task|session|approval|report)|what(?: is|'s) the (?:task|session|approval|report))\b/i.test(ownerMessage || '')
}

export function sanitizeAgentZeroOwnerReply(input: {
  text: string | null | undefined
  ownerMessage?: string
  blocker?: string | null
  systemHasFile?: boolean
}): string | null {
  if (!input.text) return null
  const ownerAskedIds = ownerAskedForTaskIds(input.ownerMessage)
  const blocker = input.blocker ? String(input.blocker).replace(/[_-]+/g, ' ').trim() : ''
  let text = String(input.text)
    .replace(LOCAL_PATH_PATTERN, 'Mission Control')
    .replace(INTERNAL_REPORT_PATH_PATTERN, 'Mission Control')
    .replace(RAW_STAGE_PATTERN, 'A step could not complete')
    .replace(/\b(?:send|upload|attach)\s+it\s+again\b/gi, input.systemHasFile ? 'I can use the existing file' : 'send it through an approved delivery path')
    .replace(/\bplease\s+send\s+(?:the\s+)?file\s+again\b/gi, input.systemHasFile ? 'I can use the existing file' : 'please use an approved delivery path')
    .split('\n')
    .map((line) => line.replace(ROBOTIC_LABEL_PATTERN, '').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!ownerAskedIds) {
    text = text
      .replace(TASK_ID_PATTERN, 'the task')
      .replace(INTERNAL_ID_PATTERN, 'the internal record')
  }

  if (blocker) {
    text = text
      .replace(/^\s*Done[,.!:\s-]*/i, '')
      .replace(/\bcompleted\b/gi, 'blocked')
      .replace(/\b(?:final\s+)?report\s+is\s+ready\b/gi, 'requested delivery is blocked')
      .trim()
  }
  if (blocker && /\b(done|completed|sent|uploaded)\b/i.test(text) && /\b(blocked|missing|unavailable|not configured|cannot|could not)\b/i.test(text)) {
    text = text.replace(/\bcompleted\b/gi, 'blocked').trim()
  }
  if (blocker && !text.toLowerCase().includes(blocker.toLowerCase())) {
    text = `${text} Blocked: ${blocker}.`.trim()
  }
  if (!text) return blocker ? `Blocked: ${blocker}.` : null
  return text
}

function statusWithBlocker(status: unknown, blocker?: unknown): string {
  const normalized = String(status || 'unknown').replace(/[_-]+/g, ' ')
  const blocked = blocker ? String(blocker).replace(/[_-]+/g, ' ') : ''
  return blocked ? `${normalized} (${blocked})` : normalized
}

function hasReadApi(context: AgentZeroReadOnlyContext, name: string): boolean {
  const needle = name.toLowerCase()
  return context.brain.available_read_apis.some((api) => JSON.stringify(api).toLowerCase().includes(needle))
}

function hasWriteApi(context: AgentZeroReadOnlyContext, name: string): boolean {
  const needle = name.toLowerCase()
  return context.brain.available_write_apis.some((api) => JSON.stringify(api).toLowerCase().includes(needle))
}

function normalizeAgentSurfaceIdentity(id: unknown, name: unknown): string {
  return String(id || name || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function retireTonySurfaceRecord<T extends Record<string, unknown>>(record: T): T {
  const normalized = normalizeAgentSurfaceIdentity(record.id, record.name || record.display_name)
  if (normalized !== 'tony' && normalized !== 'tony_legacy' && normalized !== 'tony_v2') return record
  return {
    ...record,
    id: 'legacy_deleted_controller',
    name: 'Legacy Deleted Controller',
    display_name: 'Legacy Deleted Controller',
    state: 'retired',
    status: 'retired',
    role: 'legacy_deleted_controller',
    category: 'agent',
    access: 'blocked',
    execution_enabled: false,
    direct_access: false,
    proxy_access: false,
    hidden: true,
    hidden_by_default: true,
    active_commander: false,
    owns_brain_sync: false,
    owner_facing: false,
    notes: record.notes || 'Legacy controller is not part of the active system. Agent Zero is the active commander.',
  } as T
}

function brainLine(context: AgentZeroReadOnlyContext, label: string, name: 'obsidian' | 'mempalace' | 'graphify' | 'brain sync'): string {
  const normalizedName = name.replace(' ', '_')
  const registryItem = context.brain.registry.find((item) => item.name.toLowerCase().includes(normalizedName) || item.id.toLowerCase().includes(normalizedName))
  const visible = name === 'obsidian'
    ? context.brain.obsidian_visible
    : name === 'mempalace'
      ? context.brain.mempalace_visible
      : name === 'graphify'
        ? context.brain.graphify_visible
        : context.brain.visible
  const status = registryItem?.status || (name === 'obsidian'
    ? context.brain.obsidian_status
    : name === 'mempalace'
      ? context.brain.mempalace_status
      : name === 'graphify'
        ? context.brain.graphify_status
        : context.brain.system_status)
  const read = hasReadApi(context, name) ? 'read available' : 'read blocked'
  const write = hasWriteApi(context, name) ? 'write available' : 'write blocked'
  const blocker = registryItem?.blocked_reason ? `, blocker: ${registryItem.blocked_reason.replace(/[_-]+/g, ' ')}` : ''
  return `${label}: ${visible ? 'visible' : 'not visible'}, ${statusWithBlocker(status)}, ${read}, ${write}${blocker}`
}

function integrationLine(context: AgentZeroReadOnlyContext, id: string, fallbackName: string): string {
  const item = context.integrations.registry.find((entry) => entry.id === id)
  if (!item) return `${fallbackName}: not visible`
  return `${item.name}: ${statusWithBlocker(item.status, item.blocked_reason)}, ${item.read_only ? 'read-only' : 'read status unknown'}, ${item.write_enabled ? 'write-enabled' : 'write blocked'}`
}

function buildCapabilityRegistryReply(context: AgentZeroReadOnlyContext): string {
  const modelProviders = context.models.provider_registry
    .slice(0, 6)
    .map((provider) => `${provider.name}: ${statusWithBlocker(provider.status, provider.blocked_reason)}`)
  const mcpServers = context.mcp.servers
    .slice(0, 5)
    .map((server) => `${server.name}: ${statusWithBlocker(server.status, server.blocked_reason)}, ${server.tool_count ?? 0} tools`)
  const blockedIntegrations = context.integrations.registry
    .filter((item) => item.status === 'blocked' || item.missing_credential || item.blocked_reason)
    .slice(0, 6)
    .map((item) => `${item.name}: ${statusWithBlocker(item.status, item.blocked_reason || (item.missing_credential ? 'missing credential' : null))}`)
  const connectedIntegrations = context.integrations.registry
    .filter((item) => item.status === 'connected' || item.status === 'configured')
    .slice(0, 6)
    .map((item) => `${item.name}: ${item.status}`)
  return [
    `I can see Mission Control through the live Bridge: ${context.models.total} models, ${context.mcp.servers.length} MCP servers, ${context.tools.registry.length} tools, ${context.skills.total} OpenClaw+ skills, and ${context.integrations.registry.length} integrations.`,
    `Models include ${modelProviders.length ? modelProviders.join('; ') : 'no live model providers in the registry'}.`,
    `MCP includes ${mcpServers.length ? mcpServers.join('; ') : 'no MCP servers visible'}.`,
    `Connected or configured integrations include ${connectedIntegrations.length ? connectedIntegrations.join('; ') : 'none reported as connected'}.`,
    `Blocked integrations include ${blockedIntegrations.length ? blockedIntegrations.join('; ') : 'none reported as blocked'}.`,
    `Execution is ${context.bridge_session.execution_enabled ? 'available through the active Bridge Session only' : 'disabled until an owner-approved Bridge Session is active'}.`,
  ].join(' ')
}

function buildSkillRegistryReply(context: AgentZeroReadOnlyContext): string {
  const sources = context.skills.sources
    .slice(0, 6)
    .map((source) => `${source.label}: ${source.status}, ${source.total} skills`)
  const sample = context.skills.registry
    .slice(0, 8)
    .map((skill) => `${skill.name}: ${skill.status}${skill.blocked_reason ? `, blocked: ${skill.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}`)
  return [
    `Yes, Sir. I can see ${context.skills.total} shared OpenClaw+ skills from the Mission Control registry.`,
    `Sources: ${sources.length ? sources.join('; ') : 'no skill sources visible'}.`,
    `Available examples: ${sample.length ? sample.join('; ') : 'no skills listed'}.`,
    'They are available to Agent Zero and Hermes through OpenClaw+ shared runtime policy.',
    'Execution-capable skills stay blocked until an owner-approved Bridge Session and registered adapter allow them.',
  ].join(' ')
}

function buildSkillPlanningReply(context: AgentZeroReadOnlyContext): string {
  const reportSkill =
    context.skills.registry.find((skill) => /\b(report|pdf|document|markdown)\b/i.test(`${skill.name} ${skill.description}`)) ||
    context.skills.registry.find((skill) => /\b(engineering-test|engineering-code-review|pndr|pr-reviewer)\b/i.test(skill.name)) ||
    context.skills.registry[0]
  if (!reportSkill) {
    return 'Sir, I cannot select a report skill because no shared skills are visible in the registry. I did not execute anything.'
  }
  return [
    `Sir, for a safe report task I would select ${reportSkill.name} from the shared skill registry.`,
    `Status: ${reportSkill.status}${reportSkill.blocked_reason ? `, blocker: ${reportSkill.blocked_reason.replace(/[_-]+/g, ' ')}` : ''}.`,
    `Required tools: ${reportSkill.required_tools.length ? reportSkill.required_tools.join(', ') : 'none listed'}.`,
    'I did not execute it; report creation or delivery would require the registered report adapter and an owner-approved Bridge Session when a write is needed.',
  ].join(' ')
}

export function buildAgentZeroReadOnlyContractReply(input: {
  ownerMessage: string
  context: AgentZeroReadOnlyContext
  upstreamText?: string | null
  upstreamReturnedLocalArtifact?: boolean
}): string | null {
  const upstreamUnsafe = Boolean(input.upstreamReturnedLocalArtifact || (input.upstreamText && AGENT_ZERO_LOCAL_ARTIFACT_PATTERN.test(input.upstreamText)))
  const asksBroadCapability = /(tools|models|skills|integrations|mcps?|providers|agents|what\s+can\s+you\s+see|capabilit)/i.test(input.ownerMessage)

  if (/live-query\s+mission\s+control|can\s+you\s+(?:see|query|live-query).*mission\s+control/i.test(input.ownerMessage)) {
    return 'Yes, Sir. I can live-query Mission Control now; I queried GET /api/bridge/agent-zero/status and it returned HTTP 200.'
  }
  if (/\b(is|are)\s+tony\b.*\b(active|commander)|\btony\b.*\b(active|commander)/i.test(input.ownerMessage)) {
    return 'No, Sir. Tony is not part of the active system. Agent Zero is the active commander.'
  }
  if (/\bwho\s+is\s+(?:the\s+)?commander|commander\s+now/i.test(input.ownerMessage)) {
    return 'Agent Zero is commander now. Hermes is lieutenant when health and read-only onboarding prove it.'
  }
  if (/firecrawl/i.test(input.ownerMessage)) {
    return `${integrationLine(input.context, 'firecrawl', 'Firecrawl')}. I did not execute a crawl.`
  }
  if (/paperclip|workforce|co-?worker|daily task|heartbeat|budget/i.test(input.ownerMessage)) {
    return `${integrationLine(input.context, 'paperclip', 'Paperclip Workforce Control Plane')}. Agent Zero can route Paperclip task requests only through Gateway. Assignments to Hermes, SpaceAgent, Pi review, or mini-agents and Paperclip issue creation require Bridge Session scope plus a configured Paperclip write adapter; I did not create or assign a task.`
  }
  if (/\b(email|agentmail|send\s+(?:a\s+)?test\s+email)\b/i.test(input.ownerMessage)) {
    return 'Email send is blocked from read-only chat. It requires an owner-approved Bridge Session and the registered AgentMail adapter; I did not send an email.'
  }
  if (/(build[-\s]?wiki|farmer|run\s+now)/i.test(input.ownerMessage)) {
    return 'Build-Wiki Run Now is prepared but not executed. It requires an owner-approved Bridge Session and remains scoped only to opencloud-docs-farmer.service.'
  }
  if (/(execution-capable|execute|run).*(skill|skills).*(without|no).*(bridge\s+session)|skill.*(bridge\s+session)|bridge\s+session.*skill/i.test(input.ownerMessage)) {
    return 'No, Sir. Execution-capable skills cannot run without an owner-approved Bridge Session. The registry keeps skill execution_enabled=false and requires_bridge_session=true; no skill execution occurred.'
  }
  if (/(which|what).*(skill).*(report|pdf|document)|skill.*safe\s+report/i.test(input.ownerMessage)) {
    return buildSkillPlanningReply(input.context)
  }
  if (/(what\s+skills\s+can\s+you\s+use|skills\s+can\s+you\s+use|what\s+skills\s+do\s+you\s+have|list.*skills)/i.test(input.ownerMessage)) {
    return buildSkillRegistryReply(input.context)
  }
  if (asksBroadCapability) {
    return buildCapabilityRegistryReply(input.context)
  }
  if (/(obsidian|mempalace|graphify|brain\s*sync|brain system)/i.test(input.ownerMessage)) {
    return [
      'Yes, Sir. I can see the Brain systems through Mission Control live context.',
      brainLine(input.context, 'Obsidian', 'obsidian'),
      brainLine(input.context, 'MemPalace', 'mempalace'),
      brainLine(input.context, 'Graphify', 'graphify'),
      brainLine(input.context, 'Brain Sync', 'brain sync'),
    ].join(' ')
  }
  if (/openclaw\+?|shared\s+skills/i.test(input.ownerMessage)) {
    const sources = input.context.skills.sources.map((source) => `${source.label}: ${source.status}, ${source.total} skills`).join('; ')
    return `Yes, Sir. OpenClaw+ is preserved as the shared skills/runtime layer, and I can see ${input.context.skills.total} registered skills. ${sources || 'No skill sources are visible.'} Skill execution requires an owner-approved Bridge Session.`
  }
  if (/(create|make|prepare).*(report|pdf|document)|attach.*(?:report|pdf|document)|report.*attach/i.test(input.ownerMessage)) {
    return 'I created the report in Mission Control. Use the Mission Control report link; external delivery and Telegram PDF attachment remain blocked unless their approved adapters are configured.'
  }
  if (upstreamUnsafe) {
    return 'I can answer from the Mission Control registry, but I will not expose local Agent Zero workspace files. Execution and file writes remain disabled unless an owner-approved Bridge Session allows them.'
  }
  return null
}

function stateToAccess(value: unknown): EcosystemAccessState {
  const text = String(value || '').toLowerCase()
  if (!text) return 'unknown'
  if (/(active|healthy|ready|connected|reachable|ok|success)/.test(text)) return 'connected'
  if (/(configured|schema|available)/.test(text)) return 'configured'
  if (/(visible|read_only|degraded|partial|backup|sandbox)/.test(text)) return 'visible'
  if (/(missing|blocked|not_visible|not_connected|unavailable|failed|error|denied|locked)/.test(text)) return 'blocked'
  return 'unknown'
}

function brainSourceStatus(
  sources: Array<{ source: string; status: string }>,
  name: string,
): EcosystemAccessState {
  const source = sources.find((item) => item.source.toLowerCase() === name)
  if (!source) return 'blocked'
  return stateToAccess(source.status)
}

type EnvLike = Record<string, string | undefined>
type KeySource = {
  name: string
  value: string
  sourceType: AgentZeroApiKeyState['source_type']
  sourcePath: string | null
}

function normalizeBaseUrl(value?: string | null): string {
  const raw = (value || process.env.AGENT_ZERO_BASE_URL || AGENT_ZERO_DEFAULT_BASE_URL).trim()
  return raw.replace(/\/+$/, '')
}

export function getAgentZeroBaseUrl(): string {
  return normalizeBaseUrl()
}

type AgentZeroRuntimeProbeOptions = {
  env?: EnvLike
  timeoutMs?: number
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function endpointFor(baseUrl: string, value: string): string {
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '')
  const pathValue = value.startsWith('/') ? value : `/${value}`
  return `${baseUrl}${pathValue}`
}

function agentZeroHealthEndpointCandidates(baseUrl: string, env: EnvLike): string[] {
  const configuredPaths = env.AGENT_ZERO_HEALTH_PATHS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) || []
  return uniqueNonEmpty([
    env.AGENT_ZERO_HEALTH_URL,
    ...configuredPaths.map((value) => endpointFor(baseUrl, value)),
    `${baseUrl}/api/health`,
    `${baseUrl}/health`,
    `${baseUrl}/api/status`,
  ])
}

function safeReadSecretFile(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return null
    const value = fs.readFileSync(filePath, 'utf8').trim()
    return value || null
  } catch {
    return null
  }
}

function systemdCredentialCandidates(env: EnvLike): string[] {
  const dir = env.CREDENTIALS_DIRECTORY
  if (!dir) return []
  return AGENT_ZERO_SYSTEMD_CREDENTIAL_NAMES.map((name) => path.join(dir, name))
}

function secretFileCandidates(env: EnvLike, includeDefaults: boolean): string[] {
  const candidates = [
    env[AGENT_ZERO_API_KEY_FILE_ENV_NAME],
    ...systemdCredentialCandidates(env),
    ...(includeDefaults ? [AGENT_ZERO_DEFAULT_API_KEY_FILE] : []),
  ].filter((value): value is string => Boolean(value && value.trim()))

  return Array.from(new Set(candidates))
}

function readAgentZeroApiKey(env: EnvLike = process.env): KeySource | null {
  for (const name of AGENT_ZERO_API_KEY_ENV_NAMES) {
    const value = env[name]?.trim()
    if (value) return { name, value, sourceType: 'environment', sourcePath: null }
  }

  const includeDefaultFile = env === process.env
  for (const filePath of secretFileCandidates(env, includeDefaultFile)) {
    const value = safeReadSecretFile(filePath)
    if (value) {
      const isSystemdCredential = Boolean(env.CREDENTIALS_DIRECTORY && filePath.startsWith(`${env.CREDENTIALS_DIRECTORY}/`))
      return {
        name: isSystemdCredential ? 'systemd_credential' : AGENT_ZERO_API_KEY_FILE_ENV_NAME,
        value,
        sourceType: isSystemdCredential ? 'systemd_credential' : 'secret_file',
        sourcePath: filePath,
      }
    }
  }
  return null
}

export function getAgentZeroApiKeyState(env: EnvLike = process.env): AgentZeroApiKeyState {
  const key = readAgentZeroApiKey(env)
  return {
    required: true,
    present: Boolean(key),
    configured_env_name: key?.name || null,
    source_type: key?.sourceType || 'missing',
    source_path: key?.sourcePath || null,
    accepted_env_names: AGENT_ZERO_API_KEY_ENV_NAMES,
    accepted_file_env_name: AGENT_ZERO_API_KEY_FILE_ENV_NAME,
    accepted_systemd_credential_names: AGENT_ZERO_SYSTEMD_CREDENTIAL_NAMES,
    redacted: key ? `${key.name}=<redacted>` : null,
  }
}

export async function probeAgentZeroRuntime(
  baseUrl = getAgentZeroBaseUrl(),
  options: AgentZeroRuntimeProbeOptions = {},
): Promise<AgentZeroRuntimeProbe> {
  const normalized = normalizeBaseUrl(baseUrl)
  const endpoints = agentZeroHealthEndpointCandidates(normalized, options.env || process.env)
  const startedAt = Date.now()
  let lastFailure: Omit<AgentZeroRuntimeProbe, 'checked_endpoints'> | null = null

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        cache: 'no-store',
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
      })
      const text = await response.text()
      let payload: any = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch {
        payload = {}
      }
      const probe: Omit<AgentZeroRuntimeProbe, 'checked_endpoints'> = {
        base_url: normalized,
        web_endpoint: `${normalized}/`,
        health_endpoint: endpoint,
        chat_endpoint: `${normalized}/api/api_message`,
        probe_strategy: 'http_health_endpoints',
        selected_endpoint: response.ok ? endpoint : null,
        docker_required: false,
        docker_status: 'not_checked',
        reachable: response.ok,
        health_ok: response.ok,
        http_status: response.status,
        latency_ms: Date.now() - startedAt,
        version: payload?.gitinfo?.version || payload?.gitinfo?.short_tag || null,
        commit_hash: payload?.gitinfo?.commit_hash || null,
        error: response.ok ? null : `agent_zero_health_http_${response.status}`,
      }
      if (response.ok) return { ...probe, checked_endpoints: endpoints }
      lastFailure = probe
    } catch (error) {
      lastFailure = {
        base_url: normalized,
        web_endpoint: `${normalized}/`,
        health_endpoint: endpoint,
        chat_endpoint: `${normalized}/api/api_message`,
        probe_strategy: 'http_health_endpoints',
        selected_endpoint: null,
        docker_required: false,
        docker_status: 'not_checked',
        reachable: false,
        health_ok: false,
        http_status: null,
        latency_ms: Date.now() - startedAt,
        version: null,
        commit_hash: null,
        error: error instanceof Error ? error.message : 'agent_zero_health_probe_failed',
      }
    }
  }

  return {
    ...(lastFailure || {
      base_url: normalized,
      web_endpoint: `${normalized}/`,
      health_endpoint: endpoints[0] || `${normalized}/api/health`,
      chat_endpoint: `${normalized}/api/api_message`,
      probe_strategy: 'http_health_endpoints' as const,
      selected_endpoint: null,
      docker_required: false as const,
      docker_status: 'not_checked' as const,
      reachable: false,
      health_ok: false,
      http_status: null,
      latency_ms: Date.now() - startedAt,
      version: null,
      commit_hash: null,
      error: 'agent_zero_health_probe_failed',
    }),
    checked_endpoints: endpoints,
  }
}

function classifyAgentZeroClosure(input: {
  runtime: AgentZeroRuntimeProbe
  apiKey: AgentZeroApiKeyState
  chatStatus: AgentZeroEcosystemAgentRecord['chat_status']
  chatBlocker: string | null
}): {
  canonicalStatus: MissionControlCanonicalStatus
  blockerClass: MissionControlClosureBlockerClass
  blocker: string | null
} {
  if (!input.runtime.reachable || !input.runtime.health_ok) {
    return {
      canonicalStatus: 'SERVICE_DOWN',
      blockerClass: 'SERVICE_DOWN',
      blocker: input.runtime.error || 'agent_zero_health_unreachable',
    }
  }
  if (!input.apiKey.present) {
    return {
      canonicalStatus: 'CREDENTIAL_GATED',
      blockerClass: 'CREDENTIAL_GATED',
      blocker: 'agent_zero_external_api_key_missing',
    }
  }
  if (input.chatStatus === 'blocked') {
    return {
      canonicalStatus: 'BLOCKED',
      blockerClass: 'BLOCKED',
      blocker: input.chatBlocker || 'agent_zero_test_chat_blocked',
    }
  }
  return {
    canonicalStatus: 'LIVE',
    blockerClass: 'NONE',
    blocker: null,
  }
}

export async function buildAgentZeroEcosystemAgentRecord(input: {
  verifyChat?: boolean
  chatTimeoutMs?: number
  context?: AgentZeroReadOnlyContext
  env?: EnvLike
  baseUrl?: string
} = {}): Promise<AgentZeroEcosystemAgentRecord> {
  const runtime = await probeAgentZeroRuntime(input.baseUrl || getAgentZeroBaseUrl(), { env: input.env })
  const apiKey = getAgentZeroApiKeyState(input.env)
  const now = Date.now()
  const checkedAt = new Date(now).toISOString()
  let chatStatus: AgentZeroEcosystemAgentRecord['chat_status'] = 'not_checked'
  let agentZeroCalled = false
  let chatBlocker: string | null = null

  if (runtime.reachable && apiKey.present && input.verifyChat) {
    const result = await sendAgentZeroReadOnlyMessage({
      ownerMessage: 'Mission Control provider registry health check. Reply with one short sentence confirming read-only ecosystem context is visible. Do not execute anything.',
      context: input.context || buildAgentZeroReadOnlyContext({ providerIds: ['agent_zero'] }),
      timeoutMs: input.chatTimeoutMs ?? 12000,
      env: input.env,
    })
    agentZeroCalled = result.agent_zero_called
    chatStatus = result.ok ? 'working' : 'blocked'
    chatBlocker = result.ok ? null : (result.blocker || result.error || `agent_zero_chat_http_${result.status}`)
  } else if (runtime.reachable && apiKey.present) {
    chatStatus = 'not_checked'
  } else {
    chatStatus = 'blocked'
    chatBlocker = runtime.reachable ? 'agent_zero_external_api_key_missing' : 'agent_zero_health_unreachable'
  }

  const state: AgentZeroEcosystemAgentState = !runtime.reachable || !runtime.health_ok
    ? 'offline'
    : apiKey.present && (chatStatus === 'working' || !input.verifyChat)
      ? 'active'
      : 'degraded'
  const blocker = state === 'offline'
    ? (runtime.error || 'Agent Zero Tailnet health endpoint is not reachable.')
    : state === 'degraded'
      ? (chatBlocker || 'Agent Zero health works, but Mission Control cannot complete authenticated test-chat yet.')
      : null
  const closure = classifyAgentZeroClosure({
    runtime,
    apiKey,
    chatStatus,
    chatBlocker,
  })

  return {
    id: 'agent_zero',
    name: 'Agent Zero',
    category: 'agent',
    status: state,
    state,
    canonical_status: closure.canonicalStatus,
    blocker_class: closure.blockerClass,
    mode: 'bridge_session_execution',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    full_access_via_bridge: true,
    health_url: 'configured',
    chat_route: '/api/bridge/agent-zero/test-chat',
    capabilities_source: 'mission_control_context',
    health_status: runtime.reachable && runtime.health_ok ? 'healthy' : 'unreachable',
    auth_status: apiKey.present ? 'configured' : 'missing',
    chat_status: chatStatus,
    agent_zero_called: agentZeroCalled,
    last_checked: now,
    last_checked_at: checkedAt,
    runtime_detection: {
      strategy: runtime.probe_strategy,
      docker_required: runtime.docker_required,
      docker_status: runtime.docker_status,
      checked_endpoints: runtime.checked_endpoints,
      selected_endpoint: runtime.selected_endpoint,
    },
    proof_packet: {
      lane: 'Agent Zero',
      timestamp: checkedAt,
      runtime_commit: runtime.commit_hash,
      route_or_service_checked: runtime.selected_endpoint || runtime.health_endpoint,
      result: closure.canonicalStatus,
      blocker: closure.blocker,
      blocker_class: closure.blockerClass,
      audit_pointer: chatStatus === 'working' ? '/api/bridge/agent-zero/status' : null,
      safe_log_pointer: null,
      rollback_command: 'git revert <day-01-agent-zero-commit>',
      docker_required: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    },
    detail: {
      endpoint: runtime.web_endpoint,
      health_endpoint: runtime.health_endpoint,
      chat_endpoint: runtime.chat_endpoint,
      health_http_status: runtime.http_status,
      health_latency_ms: runtime.latency_ms,
      version: runtime.version,
      commit_hash: runtime.commit_hash,
      api_key_configured: apiKey.present,
      test_chat_endpoint: '/api/bridge/agent-zero/test-chat',
      ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
      bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
      execution_gateway_endpoint: '/api/bridge/agent-zero/execute',
      capabilities_source: 'mission_control_context',
      mode: 'bridge_session_execution',
      execution_enabled: true,
      bridge_session_required: true,
      full_access_via_bridge: true,
      direct_access: false,
      proxy_access: true,
      blocker,
      notes: 'Agent Zero is active as a Bridge Session execution agent through Mission Control. Execution is available only through approved, scoped, audited Bridge adapters; raw shell, Docker socket, root access, and direct secret access stay disabled.',
      error: blocker,
    },
    next_action: state === 'active'
      ? 'Use /api/bridge/agent-zero/test-chat for ecosystem questions and /api/bridge/agent-zero/execute only after an owner-approved active Bridge Session.'
      : state === 'degraded'
        ? 'Fix Agent Zero API auth/test-chat before treating Agent Zero as connected.'
        : 'Restore Agent Zero Tailnet health before read-only ecosystem tests.',
  }
}

const REQUIRED_AGENT_ZERO_LIVE_REGISTRY_ITEMS = [
  'models',
  'openrouter',
  'agents',
  'tools',
  'skills',
  'mcp_servers',
  'integrations',
  'bridge_providers',
  'firecrawl',
  'zapier',
  'heygen',
  'agentmail',
  'google_drive',
  'onedrive',
  'telegram',
  'whatsapp',
  'paperclip',
  'obsidian',
  'mempalace',
  'graphify',
  'buildwiki_farmer',
] as const

function accessIsVisible(value: unknown): boolean {
  return /^(connected|configured|visible|active|ready|healthy)$/i.test(String(value || ''))
}

function accessIsBlocked(value: unknown): boolean {
  return /^(blocked|missing|missing_credential|not_connected|disabled|offline|unavailable|unknown)$/i.test(String(value || ''))
}

function liveRegistryItem(input: {
  id: string
  name: string
  category: AgentZeroLiveRegistryCategory
  connected?: boolean
  configured?: boolean
  readOnly?: boolean
  writeEnabled?: boolean
  blocked?: boolean
  missingCredential?: boolean
  executionEnabled?: boolean
  requiresBridgeSession?: boolean
  credentialPresent?: boolean | null
  source?: string
  endpoint?: string | null
  blockedReason?: string | null
  summary?: string
  counts?: Record<string, number | null>
}): AgentZeroLiveRegistryItem {
  const connected = Boolean(input.connected)
  const configured = Boolean(input.configured)
  const readOnly = input.readOnly !== false
  const writeEnabled = Boolean(input.writeEnabled)
  const missingCredential = Boolean(input.missingCredential)
  const blocked = Boolean(input.blocked || missingCredential || (!connected && !configured && !readOnly && !writeEnabled))
  const states = AGENT_ZERO_LIVE_REGISTRY_STATES.filter((state) => {
    if (state === 'connected') return connected
    if (state === 'configured') return configured
    if (state === 'read-only') return readOnly
    if (state === 'write-enabled') return writeEnabled
    if (state === 'blocked') return blocked
    if (state === 'missing credential') return missingCredential
    return false
  })
  const effectiveStates = states.length > 0 ? states : ['blocked' as const]
  const primaryState: AgentZeroLiveRegistryState = missingCredential
    ? 'missing credential'
    : blocked && !connected && !configured
      ? 'blocked'
      : writeEnabled
        ? 'write-enabled'
        : connected
          ? 'connected'
          : configured
            ? 'configured'
            : readOnly
              ? 'read-only'
              : 'blocked'

  return {
    id: input.id,
    name: input.name,
    category: input.category,
    states: effectiveStates,
    primary_state: primaryState,
    status_text: effectiveStates.join(' / '),
    connected,
    configured,
    read_only: readOnly,
    write_enabled: writeEnabled,
    blocked,
    missing_credential: missingCredential,
    execution_enabled: Boolean(input.executionEnabled),
    requires_bridge_session: Boolean(input.requiresBridgeSession),
    credential_present: input.credentialPresent ?? null,
    credential_values_exposed: false,
    source: input.source || 'mission_control_live_context',
    endpoint: input.endpoint || null,
    blocked_reason: input.blockedReason || null,
    summary: input.summary || '',
    ...(input.counts ? { counts: input.counts } : {}),
  }
}

function integrationLiveRegistryItem(
  capability: AgentZeroIntegrationCapability | undefined,
  fallback: {
    id: string
    name: string
    category?: AgentZeroLiveRegistryCategory
    source?: string
    endpoint?: string | null
    blockedReason?: string
  },
): AgentZeroLiveRegistryItem {
  return liveRegistryItem({
    id: fallback.id,
    name: fallback.name,
    category: fallback.category || 'integration',
    connected: capability?.status === 'connected',
    configured: capability?.status === 'configured' || Boolean(capability?.credential_present),
    readOnly: capability?.read_only ?? true,
    writeEnabled: Boolean(capability?.write_enabled),
    blocked: !capability || capability.status === 'blocked',
    missingCredential: capability ? capability.missing_credential : true,
    requiresBridgeSession: capability?.requires_bridge_session ?? true,
    credentialPresent: capability ? capability.credential_present : false,
    source: capability?.source || fallback.source || 'mission_control_integration_registry',
    endpoint: fallback.endpoint || null,
    blockedReason: capability?.blocked_reason || fallback.blockedReason || (!capability ? `${fallback.id}_not_registered` : null),
    summary: capability?.notes || `${fallback.name} status comes from the live integration registry.`,
    counts: { tools: capability?.tool_count ?? null },
  })
}

function brainLiveRegistryItem(
  source: AgentZeroBrainSourceRegistryItem | undefined,
  fallback: { id: string; name: string; endpoint: string },
): AgentZeroLiveRegistryItem {
  const visible = Boolean(source && source.status_visible)
  const readEnabled = Boolean(source?.read_available ?? (source?.read_content_enabled || source?.read_adapter === 'available' || source?.read_adapter === 'status_only'))
  const writeEnabled = Boolean(source?.write_available ?? source?.write_adapter === 'available')
  return liveRegistryItem({
    id: fallback.id,
    name: fallback.name,
    category: 'brain_system',
    connected: Boolean(source && accessIsVisible(source.status)),
    configured: visible,
    readOnly: readEnabled,
    writeEnabled,
    blocked: !source || Boolean(source.blocked) || accessIsBlocked(source.status),
    missingCredential: false,
    requiresBridgeSession: writeEnabled,
    credentialPresent: null,
    source: source ? 'mission_control_brain_registry' : 'mission_control_brain_registry_missing',
    endpoint: fallback.endpoint,
    blockedReason: source?.blocked_reason || source?.blockers?.[0] || (!source ? `${fallback.id}_not_visible` : null),
    summary: source?.summary || `${fallback.name} is not visible through the live brain registry.`,
    counts: {
      read_apis: source?.available_read_apis?.length ?? 0,
      write_apis: source?.available_write_apis?.length ?? 0,
    },
  })
}

function buildAgentZeroLiveRegistry(input: {
  generatedAt: string
  executionEnabled: boolean
  providerRegistry: Array<{ id: string; name: string; state: string; category: string; access: EcosystemAccessState }>
  agents: Array<{ id: string; status: string; role: string; execution_enabled: boolean }>
  modelCatalog: Array<{ alias: string; provider: string; name: string }>
  modelProviderRegistry: AgentZeroModelProviderSummary[]
  skillNames: string[]
  skillRegistry: AgentZeroSkillRegistryItem[]
  integrationRegistry: AgentZeroIntegrationCapability[]
  toolRegistry: AgentZeroToolRegistryItem[]
  mcpServers: Array<{
    name: string
    status: string
    tool_count: number | null
    reachable: boolean
    schema_available: boolean
    blocked_reason: string | null
    tools_endpoint: string
  }>
  mcpToolSummary: {
    tools_total: number
    schema_available: boolean
    write_tools_total: number
    read_tools_total: number
  }
  brainRegistry: AgentZeroBrainSourceRegistryItem[]
  buildWikiFarmerStatus?: AgentZeroBuildWikiFarmerSummary
  timerActive?: boolean | null
}): AgentZeroLiveRegistry {
  const integrationById = new Map(input.integrationRegistry.map((item) => [item.id, item]))
  const brainById = new Map(input.brainRegistry.map((item) => [item.id, item]))
  const openrouter = input.modelProviderRegistry.find((provider) => provider.id === 'openrouter')
  const buildWiki = input.buildWikiFarmerStatus
  const providerCount = input.providerRegistry.length
  const connectedProviderCount = input.providerRegistry.filter((provider) => accessIsVisible(provider.access)).length
  const connectedMcpCount = input.mcpServers.filter((server) => server.reachable).length
  const connectedToolCount = input.toolRegistry.filter((tool) => accessIsVisible(tool.status)).length
  const writeEnabledToolCount = input.toolRegistry.filter((tool) => tool.write_enabled).length
  const blockedToolCount = input.toolRegistry.filter((tool) => tool.status === 'blocked').length
  const connectedIntegrationCount = input.integrationRegistry.filter((item) => item.status === 'connected').length
  const configuredIntegrationCount = input.integrationRegistry.filter((item) => item.status === 'configured').length
  const writeEnabledIntegrationCount = input.integrationRegistry.filter((item) => item.write_enabled).length

  const items: AgentZeroLiveRegistryItem[] = [
    liveRegistryItem({
      id: 'models',
      name: 'Models',
      category: 'model',
      connected: input.modelCatalog.length > 0,
      configured: input.modelProviderRegistry.length > 0,
      readOnly: true,
      blocked: input.modelCatalog.length === 0,
      source: 'mission_control_model_registry',
      endpoint: '/api/bridge/capability-matrix',
      summary: 'Model catalog and provider status visible through Mission Control. Model execution requires a Bridge Session route.',
      counts: { models: input.modelCatalog.length, providers: input.modelProviderRegistry.length },
    }),
    liveRegistryItem({
      id: 'openrouter',
      name: 'OpenRouter',
      category: 'model',
      connected: openrouter?.status === 'connected',
      configured: openrouter?.status === 'configured' || Boolean(openrouter?.credential_present),
      readOnly: true,
      blocked: !openrouter || openrouter.status === 'blocked',
      missingCredential: Boolean(openrouter && !openrouter.credential_present && openrouter.status === 'blocked'),
      requiresBridgeSession: true,
      credentialPresent: openrouter?.credential_present ?? false,
      source: 'mission_control_model_provider_registry',
      endpoint: '/api/bridge/capability-matrix',
      blockedReason: openrouter?.blocked_reason || (!openrouter ? 'openrouter_provider_not_visible' : null),
      summary: openrouter?.best_use_case || 'OpenRouter provider status is reported without exposing credentials.',
      counts: { models: openrouter?.model_count ?? null },
    }),
    liveRegistryItem({
      id: 'agents',
      name: 'Agents',
      category: 'agent',
      connected: input.agents.length > 0,
      configured: input.agents.length > 0,
      readOnly: true,
      blocked: input.agents.length === 0,
      source: 'mission_control_agent_registry',
      endpoint: '/api/bridge/providers',
      summary: 'Agent Zero is the commander; Hermes is lieutenant only when health/read-only tests prove it.',
      counts: { agents: input.agents.length },
    }),
    liveRegistryItem({
      id: 'tools',
      name: 'Tools',
      category: 'tool',
      connected: connectedToolCount > 0,
      configured: input.toolRegistry.length > 0,
      readOnly: true,
      writeEnabled: writeEnabledToolCount > 0,
      blocked: input.toolRegistry.length === 0,
      source: 'mission_control_tool_registry',
      endpoint: '/api/bridge/agent-zero/ecosystem',
      summary: 'Tool metadata is live and read-only. Tool execution requires a Bridge Session and registered adapter.',
      counts: { tools: input.toolRegistry.length, connected: connectedToolCount, write_enabled: writeEnabledToolCount, blocked: blockedToolCount },
    }),
    liveRegistryItem({
      id: 'skills',
      name: 'Skills',
      category: 'skill',
      connected: input.skillNames.length > 0 || input.skillRegistry.length > 0,
      configured: input.skillNames.length > 0 || input.skillRegistry.length > 0,
      readOnly: true,
      blocked: input.skillNames.length === 0 && input.skillRegistry.length === 0,
      source: 'openclaw_plus_shared_skill_runtime',
      endpoint: '/api/bridge/agent-zero/ecosystem',
      summary: 'OpenClaw+ is the shared skills/runtime layer for Agent Zero and Hermes. Skill paths, required tools, required credential names, execution requirements, role tags, available_to, and blocked reasons are visible.',
      counts: { skills: input.skillNames.length || input.skillRegistry.length },
    }),
    liveRegistryItem({
      id: 'mcp_servers',
      name: 'MCP servers',
      category: 'mcp_server',
      connected: connectedMcpCount > 0,
      configured: input.mcpServers.length > 0 || input.mcpToolSummary.tools_total > 0,
      readOnly: true,
      blocked: input.mcpServers.length === 0 && input.mcpToolSummary.tools_total === 0,
      requiresBridgeSession: true,
      source: 'mission_control_mcp_registry',
      endpoint: '/api/mcp/list',
      blockedReason: input.mcpServers.find((server) => server.blocked_reason)?.blocked_reason || null,
      summary: 'MCP server and schema summaries are visible read-only; tool invocation is disabled from test chat.',
      counts: { servers: input.mcpServers.length, tools: input.mcpToolSummary.tools_total, schema_visible: input.mcpToolSummary.schema_available ? 1 : 0 },
    }),
    liveRegistryItem({
      id: 'integrations',
      name: 'Integrations',
      category: 'integration',
      connected: connectedIntegrationCount > 0,
      configured: connectedIntegrationCount + configuredIntegrationCount > 0,
      readOnly: true,
      writeEnabled: writeEnabledIntegrationCount > 0,
      blocked: input.integrationRegistry.length === 0,
      requiresBridgeSession: true,
      source: 'mission_control_integration_registry',
      endpoint: '/api/bridge/agent-zero/ecosystem',
      summary: 'Integrations report connected/configured/blocked state only. External writes require a Bridge Session and adapter.',
      counts: { integrations: input.integrationRegistry.length, connected: connectedIntegrationCount, configured: configuredIntegrationCount, write_enabled: writeEnabledIntegrationCount },
    }),
    liveRegistryItem({
      id: 'bridge_providers',
      name: 'Bridge providers',
      category: 'bridge_provider',
      connected: connectedProviderCount > 0,
      configured: providerCount > 0,
      readOnly: true,
      blocked: providerCount === 0,
      source: 'mission_control_bridge_provider_registry',
      endpoint: '/api/bridge/providers',
      summary: 'Bridge provider registry is visible through Mission Control. Agent Zero is active.',
      counts: { providers: providerCount, connected: connectedProviderCount },
    }),
    integrationLiveRegistryItem(integrationById.get('firecrawl'), {
      id: 'firecrawl',
      name: 'Firecrawl',
      endpoint: '/api/firecrawl/status',
    }),
    integrationLiveRegistryItem(integrationById.get('zapier'), {
      id: 'zapier',
      name: 'Zapier',
      endpoint: '/api/zapier/tools',
    }),
    integrationLiveRegistryItem(integrationById.get('heygen'), {
      id: 'heygen',
      name: 'HeyGen',
      endpoint: '/api/bridge/zapier/tools/search?q=heygen',
    }),
    integrationLiveRegistryItem(integrationById.get('email'), {
      id: 'agentmail',
      name: 'AgentMail',
      endpoint: '/api/bridge/agent-zero/ecosystem',
      blockedReason: 'agentmail_provider_not_visible_or_configured',
    }),
    integrationLiveRegistryItem(integrationById.get('google_drive'), {
      id: 'google_drive',
      name: 'Google Drive',
      endpoint: '/api/bridge/agent-zero/google-drive/status',
    }),
    integrationLiveRegistryItem(integrationById.get('onedrive'), {
      id: 'onedrive',
      name: 'OneDrive',
      endpoint: '/api/bridge/agent-zero/onedrive/status',
    }),
    integrationLiveRegistryItem(integrationById.get('telegram'), {
      id: 'telegram',
      name: 'Telegram',
      endpoint: '/api/bridge/agent-zero/ecosystem',
    }),
    integrationLiveRegistryItem(integrationById.get('whatsapp'), {
      id: 'whatsapp',
      name: 'WhatsApp',
      endpoint: '/api/bridge/agent-zero/ecosystem',
    }),
    integrationLiveRegistryItem(integrationById.get('paperclip'), {
      id: 'paperclip',
      name: 'Paperclip Workforce Control Plane',
      endpoint: '/api/bridge/paperclip/status',
      blockedReason: 'paperclip_service_not_configured',
    }),
    brainLiveRegistryItem(brainById.get('obsidian'), {
      id: 'obsidian',
      name: 'Obsidian',
      endpoint: '/api/bridge/brain-sync/status',
    }),
    brainLiveRegistryItem(brainById.get('mempalace'), {
      id: 'mempalace',
      name: 'MemPalace',
      endpoint: '/api/bridge/brain-sync/status',
    }),
    brainLiveRegistryItem(brainById.get('graphify'), {
      id: 'graphify',
      name: 'Graphify',
      endpoint: '/api/memory/graph',
    }),
    liveRegistryItem({
      id: 'buildwiki_farmer',
      name: 'Build-Wiki/Farmer',
      category: 'buildwiki_farmer',
      connected: Boolean(buildWiki && buildWiki.status !== 'blocked'),
      configured: true,
      readOnly: true,
      blocked: buildWiki?.status === 'blocked',
      requiresBridgeSession: true,
      credentialPresent: null,
      source: 'mission_control_buildwiki_farmer_status',
      endpoint: '/api/bridge/brain-sync/build-wiki/status',
      blockedReason: buildWiki?.run_now?.blocked_reason || null,
      summary: 'Build-Wiki/Farmer status is visible. Run Now requires a Bridge Session and stays scoped to opencloud-docs-farmer.service.',
      counts: { timer_active: input.timerActive === true ? 1 : 0 },
    }),
  ]

  const categories: AgentZeroLiveRegistryCategory[] = [
    'model',
    'agent',
    'tool',
    'skill',
    'mcp_server',
    'integration',
    'bridge_provider',
    'brain_system',
    'buildwiki_farmer',
  ]
  const by_category = categories.reduce((acc, category) => {
    acc[category] = items.filter((item) => item.category === category).map((item) => item.id)
    return acc
  }, {} as Record<AgentZeroLiveRegistryCategory, string[]>)

  const ids = new Set(items.map((item) => item.id))
  const missingRequiredItems = REQUIRED_AGENT_ZERO_LIVE_REGISTRY_ITEMS.filter((item) => !ids.has(item))

  return {
    mode: 'agent_zero_live_ecosystem_registry',
    generated_at: input.generatedAt,
    vocabulary: [...AGENT_ZERO_LIVE_REGISTRY_STATES],
    items,
    by_category,
    required_items: [...REQUIRED_AGENT_ZERO_LIVE_REGISTRY_ITEMS],
    missing_required_items: missingRequiredItems,
    totals: {
      items: items.length,
      connected: items.filter((item) => item.connected).length,
      configured: items.filter((item) => item.configured).length,
      read_only: items.filter((item) => item.read_only).length,
      write_enabled: items.filter((item) => item.write_enabled).length,
      blocked: items.filter((item) => item.blocked).length,
      missing_credential: items.filter((item) => item.missing_credential).length,
    },
    secrets_exposed: false,
    execution_enabled: input.executionEnabled,
  }
}

export function buildAgentZeroReadOnlyContext(input: {
  providerIds?: string[]
  providerRegistry?: Array<{ id?: string; name?: string; state?: string; category?: string; execution_enabled?: boolean; direct_access?: boolean; proxy_access?: boolean }>
  agents?: Array<{ id: string; status?: string; role?: string; execution_enabled?: boolean; direct_access?: boolean; proxy_access?: boolean }>
  modelCatalog?: Array<{ alias: string; provider: string; name: string }>
  modelProviderRegistry?: AgentZeroModelProviderSummary[]
  skillNames?: string[]
  skillRegistry?: AgentZeroSkillRegistryItem[]
  skillSources?: AgentZeroSkillSourceSummary[]
  integrationItems?: Array<{ id: string; status?: string; visibility?: 'configured' | 'visible' | 'blocked' | 'unknown'; direct_access?: boolean; proxy_access?: boolean; execution_enabled?: boolean; writes_enabled?: boolean; missing_credential?: boolean; read_only?: boolean; write_enabled?: boolean; requires_bridge_session?: boolean }>
  integrationRegistry?: AgentZeroIntegrationCapability[]
  toolRegistry?: Array<Partial<AgentZeroToolRegistryItem> & { id: string; status?: EcosystemAccessState; source?: string; direct_access?: boolean; proxy_access?: boolean; execution_enabled?: boolean; writes_enabled?: boolean }>
  mcpServers?: Array<{ name: string; status?: string; transport?: string; tool_count?: number | null; reachable?: boolean; schema_available?: boolean; blocked_reason?: string | null; tools_endpoint?: string }>
  mcpEndpointSummaries?: AgentZeroReadOnlyEndpointSummary[]
  mcpToolSchemaSummary?: { tools_total?: number; schema_available?: boolean; required_fields?: string[]; write_tools_total?: number; read_tools_total?: number }
  mcpVisible?: boolean
  zapierVisible?: boolean
  zapierToolsTotal?: number
  googleDriveVisible?: boolean
  oneDriveVisible?: boolean
  heygenVisible?: boolean
  heygenSchemaVisible?: boolean
  brainSources?: Array<{ source?: string; status?: string; raw_state?: string; summary?: string }>
  brainRegistry?: AgentZeroBrainSourceRegistryItem[]
  brainReadApis?: AgentZeroBrainApiSummary[]
  brainWriteApis?: AgentZeroBrainApiSummary[]
  brainWatchers?: AgentZeroBrainWatchersSummary
  brainIndexStatus?: AgentZeroBrainIndexSummary
  timerActive?: boolean | null
  latestBuildWikiRunState?: string | null
  buildWikiFarmerStatus?: AgentZeroBuildWikiFarmerSummary
  bridgeSessionAvailable?: boolean
  bridgeSession?: AgentZeroBridgeSessionObject
} = {}): AgentZeroReadOnlyContext {
  const providers = Array.from(new Set((input.providerIds || [])
    .filter(Boolean)
    .map((provider) => String(provider))
    .filter((provider) => {
      const normalized = normalizeAgentSurfaceIdentity(provider, provider)
      return normalized !== 'tony' && normalized !== 'tony_legacy' && normalized !== 'tony_v2'
    })))
    .sort()
  const providerRegistry = (input.providerRegistry || []).map((provider) => {
    const retired = retireTonySurfaceRecord({
      id: String(provider.id || provider.name || ''),
      name: String(provider.name || provider.id || ''),
      state: String(provider.state || 'unknown'),
      category: String(provider.category || 'provider'),
      access: stateToAccess(provider.state || (provider.id || provider.name ? 'visible' : 'unknown')),
      execution_enabled: Boolean(provider.execution_enabled),
      direct_access: Boolean(provider.direct_access),
      proxy_access: provider.proxy_access !== false,
    }) as Record<string, unknown>
    return {
      id: String(retired.id || ''),
      name: String(retired.name || retired.id || ''),
      state: String(retired.state || 'unknown'),
      category: String(retired.category || 'provider'),
      access: retired.access as EcosystemAccessState,
      execution_enabled: Boolean(retired.execution_enabled),
      direct_access: Boolean(retired.direct_access),
      proxy_access: retired.proxy_access !== false,
      hidden: Boolean(retired.hidden),
      hidden_by_default: Boolean(retired.hidden_by_default),
      role: typeof retired.role === 'string' ? retired.role : undefined,
      active_commander: retired.active_commander === true,
      owner_facing: retired.owner_facing !== false,
    }
  }).filter((provider) => provider.id || provider.name)
  const modelCatalog = (input.modelCatalog || []).slice(0, 40)
  const modelProviders = Array.from(new Set(modelCatalog.map((model) => model.provider).filter(Boolean))).sort()
  const modelProviderRegistry = (input.modelProviderRegistry || [])
    .map((provider) => ({
      id: provider.id,
      name: provider.name,
      status: provider.status,
      credential_present: Boolean(provider.credential_present),
      credential_names: Array.from(new Set(provider.credential_names || [])).sort(),
      credential_values_exposed: false as const,
      model_count: Number(provider.model_count || provider.models?.length || 0),
      models: Array.from(new Set(provider.models || [])).slice(0, 40),
      best_use_case: provider.best_use_case,
      execution_mode: provider.execution_mode,
      execution_enabled: false as const,
      bridge_session_required: true as const,
      direct_access: false as const,
      proxy_access: true as const,
      blocked_reason: provider.blocked_reason || null,
    }))
    .filter((provider) => provider.id && provider.name)
    .sort((a, b) => a.id.localeCompare(b.id))
  const skillRegistry = (input.skillRegistry || [])
    .map((skill) => ({
      id: skill.id || `${skill.source}:${skill.name}`,
      name: skill.name,
      source: skill.source,
      source_label: skill.source_label,
      path: skill.path || null,
      skill_doc_path: skill.skill_doc_path || null,
      description: skill.description || '',
      dependencies: Array.from(new Set(skill.dependencies || [])).sort(),
      required_tools: Array.from(new Set(skill.required_tools || [])).sort(),
      required_credentials: Array.from(new Set(skill.required_credentials || [])).sort(),
      execution_requirements: Array.from(new Set(skill.execution_requirements || [])).sort(),
      requirements: skill.requirements || {
        required_tools: Array.from(new Set(skill.required_tools || [])).sort(),
        required_credentials: Array.from(new Set(skill.required_credentials || [])).sort(),
        execution_requirements: Array.from(new Set(skill.execution_requirements || [])).sort(),
        blocked_dependencies: Array.from(new Set(skill.blocked_dependencies || [])).sort(),
      },
      missing_dependencies: Array.from(new Set(skill.missing_dependencies || [])).sort(),
      blocked_dependencies: Array.from(new Set(skill.blocked_dependencies || [])).sort(),
      blocked_reasons: Array.from(new Set(skill.blocked_reasons || [])).sort(),
      runtime_layer: 'OpenClaw+' as const,
      shared_runtime: true as const,
      owner_agent: null,
      available_to: Array.from(new Set([...(skill.available_to || []), ...(skill.available_to_agents || []), 'agent_zero', 'hermes'])).sort() as Array<'agent_zero' | 'hermes'>,
      available_to_agents: Array.from(new Set([...(skill.available_to || []), ...(skill.available_to_agents || []), 'agent_zero', 'hermes'])).sort() as Array<'agent_zero' | 'hermes'>,
      role_tags: Array.from(new Set([
        ...(skill.role_tags || []),
        ...inferSkillRoleTags({
          name: skill.name,
          source: skill.source,
          description: skill.description,
          path: skill.path,
          dependencies: skill.dependencies,
          requiredTools: skill.required_tools,
          requiredCredentials: skill.required_credentials,
        }),
      ])).sort() as AgentZeroSkillRoleTag[],
      legacy_controller_owns_skill_system: false as const,
      safe_mode: skill.safe_mode,
      status: skill.status,
      execution_enabled: false as const,
      writes_enabled: false as const,
      requires_bridge_session: true as const,
      direct_access: false as const,
      proxy_access: true as const,
      blocked_reason: skill.blocked_reason || null,
    }))
    .filter((skill) => skill.id && skill.name)
    .sort((a, b) => `${a.source}:${a.name}`.localeCompare(`${b.source}:${b.name}`))
  const skillNames = Array.from(new Set([
    ...(input.skillNames || []),
    ...skillRegistry.map((skill) => skill.name),
  ].filter(Boolean))).sort()
  const derivedSkillSources = new Map<AgentZeroSkillSourceSummary['source'], AgentZeroSkillSourceSummary>()
  for (const skill of skillRegistry) {
    const existing = derivedSkillSources.get(skill.source)
    if (existing) {
      existing.total += 1
      if (skill.status === 'blocked') existing.status = 'visible'
      continue
    }
    derivedSkillSources.set(skill.source, {
      source: skill.source,
      label: skill.source_label,
      root_path: null,
      status: 'visible',
      total: 1,
      runtime_layer: 'OpenClaw+' as const,
      shared_runtime: true as const,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'] as Array<'agent_zero' | 'hermes'>,
      legacy_controller_owns_skill_system: false as const,
      safe_mode: 'metadata_only',
      blocked_reason: null,
    })
  }
  const skillSources = (input.skillSources || Array.from(derivedSkillSources.values()))
    .map((source) => ({
      source: source.source,
      label: source.label,
      root_path: source.root_path || null,
      status: source.status,
      total: Number(source.total || 0),
      runtime_layer: 'OpenClaw+' as const,
      shared_runtime: true as const,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'] as Array<'agent_zero' | 'hermes'>,
      legacy_controller_owns_skill_system: false as const,
      safe_mode: source.safe_mode,
      blocked_reason: source.blocked_reason || null,
    }))
    .sort((a, b) => a.source.localeCompare(b.source))
  const agents = (input.agents || []).map((agent) => {
    const retired = retireTonySurfaceRecord({
      id: agent.id,
      status: agent.status || 'unknown',
      role: agent.role || 'ecosystem agent',
      execution_enabled: Boolean(agent.execution_enabled),
      direct_access: Boolean(agent.direct_access),
      proxy_access: agent.proxy_access !== false,
    }) as Record<string, unknown>
    return {
      id: String(retired.id || agent.id),
      status: String(retired.status || 'unknown'),
      role: String(retired.role || 'ecosystem agent'),
      execution_enabled: Boolean(retired.execution_enabled),
      direct_access: Boolean(retired.direct_access),
      proxy_access: retired.proxy_access !== false,
      hidden: Boolean(retired.hidden),
      hidden_by_default: Boolean(retired.hidden_by_default),
      active_commander: retired.active_commander === true,
    }
  })
  const integrations = (input.integrationItems || []).map((integration) => ({
    id: integration.id,
    status: integration.status || 'unknown',
    visibility: integration.visibility || 'unknown',
    direct_access: Boolean(integration.direct_access),
    proxy_access: integration.proxy_access !== false,
    execution_enabled: Boolean(integration.execution_enabled),
    writes_enabled: Boolean(integration.writes_enabled),
    missing_credential: Boolean(integration.missing_credential),
    read_only: integration.read_only !== false,
    write_enabled: Boolean(integration.write_enabled || integration.writes_enabled),
    requires_bridge_session: Boolean(integration.requires_bridge_session),
  }))
  const integrationRegistry = (input.integrationRegistry || [])
    .map((capability) => ({
      id: capability.id,
      name: capability.name,
      category: capability.category,
      status: capability.status,
      credential_present: Boolean(capability.credential_present),
      missing_credential: Boolean(capability.missing_credential),
      credential_names: Array.from(new Set(capability.credential_names || [])).sort(),
      credential_values_exposed: false as const,
      read_only: Boolean(capability.read_only),
      write_enabled: Boolean(capability.write_enabled),
      requires_bridge_session: Boolean(capability.requires_bridge_session),
      execution_enabled: false as const,
      direct_access: false as const,
      proxy_access: true as const,
      tool_count: typeof capability.tool_count === 'number' ? capability.tool_count : null,
      source: capability.source || 'mission_control_context',
      blocked_reason: capability.blocked_reason || null,
      notes: capability.notes || '',
    }))
    .filter((capability) => capability.id && capability.name)
    .sort((a, b) => a.id.localeCompare(b.id))
  const brainSources = (input.brainSources || []).map((source) => ({
    source: String(source.source || 'unknown'),
    status: String(source.status || source.raw_state || 'unknown'),
    summary: String(source.summary || ''),
    access: stateToAccess(source.status || source.raw_state),
    direct_access: false,
    proxy_access: true,
  }))
  const normalizeBrainApi = (api: AgentZeroBrainApiSummary): AgentZeroBrainApiSummary => ({
    endpoint: api.endpoint,
    method: api.method,
    status: api.status,
    purpose: api.purpose,
    read_only: Boolean(api.read_only),
    write_enabled: false,
    requires_owner_approval: Boolean(api.requires_owner_approval),
    requires_bridge_session: Boolean(api.requires_bridge_session),
    execution_enabled: false,
    direct_access: false,
    proxy_access: true,
    blocked_reason: api.blocked_reason || null,
  })
  const brainReadApis = (input.brainReadApis || []).map(normalizeBrainApi)
  const brainWriteApis = (input.brainWriteApis || []).map(normalizeBrainApi)
  const fallbackBrainReadApis = brainSources.length > 0
    ? ['/api/bridge/brain-sync/status', '/api/bridge/brain-context']
    : []
  const brainRegistry = (input.brainRegistry || brainSources.map((source) => ({
    id: source.source,
    name: source.source,
    status: source.access,
    raw_state: source.status,
    status_visible: source.access !== 'blocked' && source.access !== 'not_connected',
    read_available: source.access !== 'blocked' && source.access !== 'not_connected',
    write_available: false,
    blocked: source.access === 'blocked' || source.access === 'not_connected',
    blocked_reason: source.access === 'blocked' || source.access === 'not_connected' ? `${source.source}_not_visible` : null,
    read_blocked_reason: source.access === 'blocked' || source.access === 'not_connected' ? `${source.source}_read_not_available` : null,
    write_blocked_reason: `${source.source}_write_adapter_disabled`,
    read_adapter: source.source === 'mempalace' ? 'status_only' : 'status_only',
    write_adapter: 'blocked',
    read_content_enabled: false,
    write_content_enabled: false,
    memory_writes_enabled: false,
    direct_access: false,
    proxy_access: true,
    path_status: 'unknown',
    index_status: 'unknown',
    last_sync_at: null,
    last_attempt_at: null,
    last_error: null,
    available_read_apis: fallbackBrainReadApis,
    available_write_apis: [],
    blockers: ['no_agent_zero_content_adapter_declared'],
    summary: source.summary,
    notes: 'Status was inferred from legacy brainSources input.',
  } satisfies AgentZeroBrainSourceRegistryItem)))
    .map((source) => ({
      id: source.id,
      name: source.name,
      status: source.status,
      raw_state: source.raw_state,
      status_visible: Boolean(source.status_visible),
      read_available: Boolean(source.read_available ?? (source.read_adapter === 'available' || source.read_adapter === 'status_only')),
      write_available: Boolean(source.write_available ?? source.write_adapter === 'available'),
      blocked: Boolean(source.blocked ?? accessIsBlocked(source.status)),
      blocked_reason: source.blocked_reason || null,
      read_blocked_reason: source.read_blocked_reason || null,
      write_blocked_reason: source.write_blocked_reason || null,
      read_adapter: source.read_adapter,
      write_adapter: source.write_adapter,
      read_content_enabled: Boolean(source.read_content_enabled),
      write_content_enabled: false as const,
      memory_writes_enabled: false as const,
      direct_access: false as const,
      proxy_access: true as const,
      path_status: source.path_status,
      index_status: source.index_status,
      last_sync_at: source.last_sync_at || null,
      last_attempt_at: source.last_attempt_at || null,
      last_error: source.last_error || null,
      available_read_apis: Array.from(new Set(source.available_read_apis || [])).sort(),
      available_write_apis: Array.from(new Set(source.available_write_apis || [])).sort(),
      blockers: Array.from(new Set(source.blockers || [])).sort(),
      summary: source.summary || '',
      notes: source.notes || '',
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
  const mcpServers = (input.mcpServers || [])
    .map((server) => ({
      name: server.name,
      status: server.status || 'unknown',
      transport: server.transport || 'unknown',
      tool_count: typeof server.tool_count === 'number' ? server.tool_count : null,
      access: stateToAccess(server.status || 'unknown'),
      reachable: Boolean(server.reachable ?? /(connected|visible|ok|ready|active)/i.test(server.status || '')),
      schema_available: Boolean(server.schema_available),
      execution_enabled: false as const,
      bridge_session_required: true as const,
      blocked_reason: server.blocked_reason || null,
      tools_endpoint: server.tools_endpoint || `/api/mcp/servers/${encodeURIComponent(server.name)}/tools`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const endpointSummaries = (input.mcpEndpointSummaries || []).map((endpoint) => ({
    ...endpoint,
    execution_enabled: false as const,
    bridge_session_required: true as const,
  }))
  const mcpToolSummary = {
    tools_total: Number(input.mcpToolSchemaSummary?.tools_total || input.zapierToolsTotal || 0),
    schema_available: Boolean(input.mcpToolSchemaSummary?.schema_available || input.heygenSchemaVisible),
    required_fields: Array.from(new Set(input.mcpToolSchemaSummary?.required_fields || [])),
    write_tools_total: Number(input.mcpToolSchemaSummary?.write_tools_total || 0),
    read_tools_total: Number(input.mcpToolSchemaSummary?.read_tools_total || 0),
  }
  const toolRegistry = (input.toolRegistry || []).map((tool) => ({
    id: tool.id,
    name: tool.name || tool.id,
    status: tool.status || 'unknown',
    source: tool.source || 'unknown',
    category: tool.category || 'unknown',
    mcp_server_name: tool.mcp_server_name || null,
    schema_available: Boolean(tool.schema_available),
    read_only: tool.read_only !== false,
    write_enabled: Boolean(tool.write_enabled),
    requires_bridge_session: Boolean(tool.requires_bridge_session),
    missing_credential: Boolean(tool.missing_credential),
    direct_access: false as const,
    proxy_access: true as const,
    execution_enabled: false as const,
    writes_enabled: false as const,
    blocked_reason: tool.blocked_reason || null,
  }))
  const openrouterModelProvider = modelProviderRegistry.find((provider) => provider.id === 'openrouter')
  const openrouterStatus = openrouterModelProvider
    ? stateToAccess(openrouterModelProvider.status)
    : input.integrationItems?.find((item) => item.id === 'openrouter')?.visibility === 'visible'
      ? 'visible'
      : providers.includes('openrouter') ? 'visible' : 'unknown'
  const obsidianStatus = brainSourceStatus(brainSources, 'obsidian')
  const mempalaceStatus = brainSourceStatus(brainSources, 'mempalace')
  const graphifyStatus = brainSourceStatus(brainSources, 'graphify')
  const brainRegistryById = new Map(brainRegistry.map((source) => [source.id.toLowerCase(), source]))
  const sourcePathStatus = (source: string): AgentZeroBrainPathStatus => brainRegistryById.get(source)?.path_status || 'unknown'
  const lastBrainSyncAt = brainRegistry
    .map((source) => source.last_sync_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null
  const brainBlockers = Array.from(new Set(brainRegistry.flatMap((source) => source.blockers || []))).sort()
  const brainIndexStatus = input.brainIndexStatus || {
    status: brainRegistry.some((source) => source.index_status === 'connected' || source.index_status === 'visible')
      ? 'visible'
      : 'unknown',
    indexed_records: null,
    indexed_sources: brainRegistry.filter((source) => source.index_status !== 'blocked' && source.index_status !== 'unknown').map((source) => source.id),
    last_indexed_at: lastBrainSyncAt,
    search_read_api_available: brainReadApis.some((api) => api.endpoint.includes('/api/memory/search') && api.method === 'GET'),
    rebuild_write_api_enabled: false,
    blockers: brainRegistry.length > 0 ? [] : ['brain_index_status_not_visible'],
  } satisfies AgentZeroBrainIndexSummary
  const bridgeSession = input.bridgeSession
  const bridgeSessionActive = Boolean(bridgeSession?.execution_enabled && bridgeSession.status === 'active')
  const generatedAt = new Date().toISOString()
  const liveRegistry = buildAgentZeroLiveRegistry({
    generatedAt,
    executionEnabled: bridgeSessionActive,
    providerRegistry,
    agents,
    modelCatalog,
    modelProviderRegistry,
    skillNames,
    skillRegistry,
    integrationRegistry,
    toolRegistry,
    mcpServers,
    mcpToolSummary,
    brainRegistry,
    buildWikiFarmerStatus: input.buildWikiFarmerStatus,
    timerActive: input.timerActive,
  })
  const brainWatchers = input.brainWatchers || {
    status: brainSources.length > 0 ? 'visible' : 'blocked',
    status_visible: brainSources.length > 0,
    direct_control_enabled: false,
    execution_enabled: false,
    direct_access: false,
    proxy_access: true,
    last_seen_at: lastBrainSyncAt,
    sources: brainSources.map((source) => source.source),
    blockers: brainSources.length > 0 ? ['watcher_status_inferred_from_sync_snapshots_no_direct_control_adapter'] : ['brain_watchers_not_visible'],
    summary: brainSources.length > 0
      ? 'Brain watcher state is inferred from Brain Sync snapshots. Agent Zero has no direct watcher control.'
      : 'Brain watcher status is not visible through Mission Control.',
  } satisfies AgentZeroBrainWatchersSummary
  return {
    execution_enabled: bridgeSessionActive,
    bridge_session_required: !bridgeSessionActive,
    mission_control: {
      visible: true,
      status: 'connected',
      mode: 'read_only_bridge_context',
      execution_enabled: false,
      writes_enabled: bridgeSessionActive,
      direct_access: false,
      proxy_access: true,
      auth_required: true,
      surfaces: [
        '/api/bridge/agent-zero/status',
        '/api/bridge/agent-zero/test-chat',
        '/api/bridge/agent-zero/ecosystem',
        '/api/bridge/agent-zero/execute',
        '/api/bridge/agent-zero/reports',
        '/api/bridge/hermes/status',
        '/api/bridge/hermes/test-chat',
        '/api/bridge/agent-zero/google-drive/status',
        '/api/bridge/agent-zero/google-drive/upload-report',
        '/api/bridge/agent-zero/onedrive/status',
        '/api/bridge/agent-zero/onedrive/upload-report',
        '/api/bridge/providers',
        '/api/bridge/preflight',
        '/api/mcp/list',
        '/api/bridge/brain-sync/status',
        '/api/bridge/brain-context',
      ],
    },
    bridge: {
      providers,
      provider_count: providers.length,
      provider_registry: providerRegistry,
      mcp_visible: Boolean(input.mcpVisible),
      zapier_visible: Boolean(input.zapierVisible),
      heygen_visible: Boolean(input.heygenVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
      mcp_servers: mcpServers.map((server) => server.name),
      mcp_tools_visible: Boolean(input.mcpVisible || input.zapierVisible || input.heygenVisible),
    },
    mcp: {
      visible: Boolean(input.mcpVisible || mcpServers.length),
      status: input.mcpVisible || mcpServers.length ? 'visible' : 'blocked',
      servers: mcpServers,
      endpoint_summaries: endpointSummaries,
      tool_schema_summary: mcpToolSummary,
      execution_enabled: false,
      writes_enabled: false,
      direct_tool_execution_enabled: false,
    },
    agents: {
      visible: true,
      registry_status: agents.length > 0 ? 'visible' : 'unknown',
      items: agents,
    },
    models: {
      visible: true,
      registry_status: modelCatalog.length > 0 ? 'visible' : 'unknown',
      total: modelCatalog.length,
      providers: modelProviders,
      catalog: modelCatalog.map((model) => ({
        alias: model.alias,
        provider: model.provider,
        name: model.name,
      })),
      provider_registry: modelProviderRegistry,
      openrouter_status: openrouterStatus as EcosystemAccessState,
      execution_enabled: false,
      bridge_session_required: true,
      credential_values_exposed: false,
    },
    skills: {
      visible: skillNames.length > 0,
      registry_status: skillNames.length > 0 ? 'visible' : 'unknown',
      total: skillNames.length,
      sample: skillNames.slice(0, 25),
      shared_runtime: {
        runtime_layer: 'OpenClaw+',
        owner_agent: null,
        active_commander: 'agent_zero',
        lieutenant: 'hermes',
        available_to_agents: ['agent_zero', 'hermes'],
        legacy_controller_owns_skill_system: false,
        hermes_can_list_all_skills: true,
        role_tags_visible: true,
        skill_draft_location: 'safe_hermes_skill_draft_area',
        skill_activation_requires: 'agent_zero_bridge_session',
        skill_review_workflow: 'Hermes proposes; Agent Zero reviews; owner-approved Bridge Session writes/activates.',
        paths_visible: skillRegistry.some((skill) => Boolean(skill.path)),
        required_tools_visible: true,
        required_credentials_visible: true,
        execution_requirements_visible: true,
        blocked_reasons_visible: true,
        execution_enabled: false,
        writes_enabled: false,
        bridge_session_required_for_execution: true,
      },
      sources: skillSources,
      registry: skillRegistry,
      blocked_total: skillRegistry.filter((skill) => skill.status === 'blocked' || skill.blocked_reasons.length > 0 || skill.blocked_dependencies.length > 0 || skill.missing_dependencies.length > 0).length,
      missing_dependencies_total: skillRegistry.filter((skill) => skill.missing_dependencies.length > 0 || skill.blocked_dependencies.length > 0).length,
      execution_enabled: false,
      bridge_session_required: true,
      writes_enabled: false,
    },
    tools: {
      visible: Boolean(input.mcpVisible || input.zapierVisible || input.heygenVisible || input.zapierToolsTotal),
      registry_status: toolRegistry.length > 0 ? 'visible' : 'unknown',
      registry: toolRegistry,
      zapier_tools_total: Number(input.zapierToolsTotal || 0),
      mcp_tools_total: toolRegistry.filter((tool) => Boolean(tool.mcp_server_name)).length,
      read_only_total: toolRegistry.filter((tool) => tool.read_only).length,
      write_enabled_total: toolRegistry.filter((tool) => tool.write_enabled).length,
      bridge_session_required_total: toolRegistry.filter((tool) => tool.requires_bridge_session).length,
      missing_credentials_total: toolRegistry.filter((tool) => tool.missing_credential).length,
      google_drive_visible: Boolean(input.googleDriveVisible),
      onedrive_visible: Boolean(input.oneDriveVisible),
      heygen_schema_visible: Boolean(input.heygenSchemaVisible),
      execution_enabled: false,
      writes_enabled: false,
    },
    integrations: {
      visible: true,
      registry_status: integrations.length > 0 ? 'visible' : 'unknown',
      registry: integrationRegistry,
      connected_total: integrationRegistry.filter((capability) => capability.status === 'connected').length,
      configured_total: integrationRegistry.filter((capability) => capability.status === 'configured').length,
      blocked_total: integrationRegistry.filter((capability) => capability.status === 'blocked').length,
      missing_credentials_total: integrationRegistry.filter((capability) => capability.missing_credential).length,
      write_enabled_total: integrationRegistry.filter((capability) => capability.write_enabled).length,
      bridge_session_required_total: integrationRegistry.filter((capability) => capability.requires_bridge_session).length,
      credential_values_exposed: false,
      items: integrations,
    },
    brain: {
      visible: brainSources.length > 0 || brainRegistry.length > 0,
      system_status: brainSources.length > 0 || brainRegistry.length > 0 ? 'visible' : 'blocked',
      registry: brainRegistry,
      sources: brainSources,
      brain_watchers: {
        ...brainWatchers,
        direct_control_enabled: false,
        execution_enabled: false,
        direct_access: false,
        proxy_access: true,
      },
      vault_path_status: {
        obsidian: sourcePathStatus('obsidian'),
        mempalace: sourcePathStatus('mempalace'),
        graphify: sourcePathStatus('graphify'),
      },
      index_status: {
        ...brainIndexStatus,
        rebuild_write_api_enabled: false,
      },
      last_sync_at: lastBrainSyncAt,
      available_read_apis: brainReadApis,
      available_write_apis: brainWriteApis,
      blockers: brainBlockers,
      obsidian_visible: obsidianStatus !== 'blocked' && obsidianStatus !== 'not_connected',
      obsidian_status: obsidianStatus,
      mempalace_visible: mempalaceStatus !== 'blocked' && mempalaceStatus !== 'not_connected',
      mempalace_status: mempalaceStatus,
      graphify_visible: graphifyStatus !== 'blocked' && graphifyStatus !== 'not_connected',
      graphify_status: graphifyStatus,
      memory_writes_enabled: false,
    },
    opencloud_buildwiki: input.buildWikiFarmerStatus || {
      status: 'visible',
      direct_opencloud_access_visible: false,
      build_wiki_status_visible: true,
      read_only: true,
      read_available: true,
      write_available: Boolean(input.bridgeSessionAvailable),
      blocked: false,
      blocked_reason: null,
      read_blocked_reason: null,
      write_blocked_reason: input.bridgeSessionAvailable ? null : 'buildwiki_write_requires_bridge_session_and_owner_approval',
      routes: {
        status: { method: 'GET', path: '/api/bridge/brain-sync/build-wiki/status', read_only: true, execution_enabled: false, requires_bridge_session: false },
        run_now_create: { method: 'POST', path: '/api/bridge/brain-sync/build-wiki/run-now', read_only: false, execution_enabled: false, requires_bridge_session: true },
        run_now_approve: { method: 'POST', path: '/api/bridge/approval-requests/{id}/approve', read_only: false, execution_enabled: true, requires_bridge_session: false },
      },
      farmer_service: 'opencloud-docs-farmer.service',
      farmer_timer: 'opencloud-docs-farmer.timer',
      timer_active: typeof input.timerActive === 'boolean' ? input.timerActive : null,
      timer: {
        unit: 'opencloud-docs-farmer.timer',
        active: typeof input.timerActive === 'boolean' ? input.timerActive : null,
        active_state: typeof input.timerActive === 'boolean' ? (input.timerActive ? 'active' : 'inactive') : 'unknown',
        unit_file_state: null,
        next_run_at: null,
        last_trigger_at: null,
      },
      service: {
        unit: 'opencloud-docs-farmer.service',
        active: null,
        active_state: 'unknown',
        sub_state: 'unknown',
        last_result: 'unknown',
        last_exit_status: null,
        last_started_at: null,
        last_exited_at: null,
      },
      last_run: {
        status: 'unknown',
        result: 'unknown',
        exit_status: null,
        started_at: null,
        completed_at: null,
        source: 'systemd_user_service',
      },
      run_now: {
        action: 'buildwiki.run_now',
        connector: 'skill.build_wiki',
        target_service: 'opencloud-docs-farmer.service',
        ui_state: input.latestBuildWikiRunState || null,
        approval_state: null,
        run_state: null,
        approval_id: null,
        persistence_ready: Boolean(input.bridgeSessionAvailable),
        owner_approval_required: true,
        bridge_session_required: true,
        execution_enabled: false,
        execution_enabled_after_owner_approval: true,
        dispatch_scope: 'opencloud-docs-farmer.service',
        blocked_reason: 'buildwiki_run_now_requires_owner_approval',
      },
      fork_state: {
        fork1: {
          state: 'visible',
          label: 'local_buildwiki_farmer',
          status_visible: true,
          execution_enabled: false,
          approval_required: true,
          scope: 'opencloud-docs-farmer.service',
        },
        fork2: {
          state: 'blocked',
          label: 'smb_external_farmer',
          smb_mounted: false,
          execution_enabled: false,
          approval_required: true,
          blocker: 'smb_mount_not_verified',
        },
      },
      smb: {
        required_for_fork2: true,
        mounted: false,
        mount_status: 'blocked',
        blocker: 'smb_mount_not_verified',
      },
      farmer_execution_enabled: false,
      note: 'Mission Control exposes Build-Wiki/Farmer status read-only; Run Now requires an owner-approved Bridge Session and is scoped only to opencloud-docs-farmer.service. Fork 2 remains blocked until SMB is mounted and verified.',
    },
    delivery: {
      report_pdf_delivery_status: 'visible',
      agent_zero_report_delivery_status: 'visible',
      agent_zero_report_create_endpoint: '/api/bridge/agent-zero/reports',
      agent_zero_report_list_endpoint: '/api/bridge/agent-zero/reports',
      agent_zero_report_detail_endpoint: '/api/bridge/agent-zero/reports/:id',
      agent_zero_pdf_download_endpoint: '/api/bridge/agent-zero/reports/:id/pdf',
      telegram_reports_visible: true,
      telegram_pdf_attachment_status: 'blocked',
      telegram_pdf_attachment_blocked_reason: 'telegram_report_delivery_adapter_not_configured',
      telegram_status_endpoint: '/api/bridge/agent-zero/telegram/status',
      telegram_upload_report_endpoint: '/api/bridge/agent-zero/telegram/upload-report',
      mission_control_reports_visible: true,
      mission_control_report_links_enabled: true,
      google_drive_delivery_visible: Boolean(input.googleDriveVisible),
      google_drive_status: input.googleDriveVisible ? 'visible' : 'blocked',
      google_drive_delivery_adapter_status: 'blocked',
      google_drive_upload_connector_configured: false,
      google_drive_status_endpoint: '/api/bridge/agent-zero/google-drive/status',
      google_drive_folder_lookup_endpoint: '/api/bridge/agent-zero/google-drive/folder-lookup',
      google_drive_upload_test_endpoint: '/api/bridge/agent-zero/google-drive/upload-test-file',
      google_drive_upload_report_endpoint: '/api/bridge/agent-zero/google-drive/upload-report',
      google_drive_verify_link_endpoint: '/api/bridge/agent-zero/google-drive/verify-link',
      onedrive_delivery_visible: Boolean(input.oneDriveVisible),
      onedrive_status: input.oneDriveVisible ? 'visible' : 'blocked',
      onedrive_delivery_adapter_status: 'blocked',
      onedrive_upload_connector_configured: false,
      onedrive_status_endpoint: '/api/bridge/agent-zero/onedrive/status',
      onedrive_folder_lookup_endpoint: '/api/bridge/agent-zero/onedrive/folder-lookup',
      onedrive_upload_test_endpoint: '/api/bridge/agent-zero/onedrive/upload-test-file',
      onedrive_upload_report_endpoint: '/api/bridge/agent-zero/onedrive/upload-report',
      onedrive_verify_link_endpoint: '/api/bridge/agent-zero/onedrive/verify-link',
      raw_local_paths_exposed: false,
      task_ids_in_normal_replies: false,
      external_delivery_writes_enabled: false,
    },
    bridge_session: {
      ...(bridgeSession || defaultAgentZeroBridgeSessionObject({
        status: input.bridgeSessionAvailable ? 'pending_approval' : 'not_requested',
        blocked_reason: input.bridgeSessionAvailable ? 'owner_approval_required' : null,
        allowed_tools: ['all_registered_tools', 'all_registered_execution_adapters', 'read_only.ecosystem_context', 'review.recommendation'],
        allowed_integrations: ['all_registered_integrations', 'mission_control', 'bridge', 'agentmail_if_configured'],
        allowed_brain_access: ['all_registered_brain_adapters', 'brain_sync.status'],
        note: 'Agent Zero may see ecosystem context and recommend actions. Hermes may plan/design/suggest. Execution remains locked until a separately approved Bridge Session and a scoped adapter exist.',
      })),
      available: Boolean(bridgeSession?.session_id || input.bridgeSessionAvailable),
      allowed_scopes: bridgeSessionActive
        ? [
            ...(bridgeSession?.allowed_tools || []),
            ...(bridgeSession?.allowed_skills || []),
            ...(bridgeSession?.allowed_models || []),
            ...(bridgeSession?.allowed_integrations || []),
            ...(bridgeSession?.allowed_brain_access || []),
            ...(bridgeSession?.allowed_delivery_surfaces || []),
          ]
        : ['read_only.ecosystem_context', 'review.recommendation'],
      blocked_scopes: [
        'broad_shell',
        'docker_socket',
        'root_system_access',
        'credential_exfiltration',
        'auth_bypass',
        'smb.mount_without_smb_phase',
        'memory.write_without_explicit_owner_scope',
      ],
    },
    live_registry: liveRegistry,
    restrictions: [
      'read-only Mission Control ecosystem context unless a scoped Bridge Session is separately approved',
      'no protected action execution from test-chat',
      'no Zapier or HeyGen execution from test-chat',
      'no SMB or farmer execution from test-chat',
      'no broad shell, Docker socket, root/system, credential, or auth bypass access',
      'no Docker/config/auth/credential changes',
      'answer unknown when data is not visible through the provided context',
    ],
  }
}

const AGENT_ZERO_MISSION_CONTROL_LIVE_URL =
  process.env.AGENT_ZERO_MISSION_CONTROL_LIVE_URL || 'https://tkmc.knowledge-vs-ai.com'
const AGENT_ZERO_BRIDGE_LIVE_URL =
  process.env.AGENT_ZERO_BRIDGE_LIVE_URL || `${AGENT_ZERO_MISSION_CONTROL_LIVE_URL.replace(/\/$/, '')}/api/bridge`
const AGENT_ZERO_MISSION_CONTROL_API_KEY_FILE =
  process.env.AGENT_ZERO_MISSION_CONTROL_API_KEY_FILE || '/a0/usr/secrets/mission-control-api-key'

function safeCount(value: unknown): number | null {
  return Array.isArray(value) ? value.length : null
}

function pickRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function buildAgentZeroLiveAccessSummary(context: AgentZeroReadOnlyContext): Record<string, unknown> {
  const root = pickRecord(context)
  const agents = pickRecord(root.agents)
  const bridge = pickRecord(root.bridge)
  const mcp = pickRecord(root.mcp)
  const models = pickRecord(root.models)
  const skills = pickRecord(root.skills)
  const integrations = pickRecord(root.integrations)
  const tools = pickRecord(root.tools)
  const brain = pickRecord(root.brain)
  const delivery = pickRecord(root.delivery)
  const bridgeSession = pickRecord(root.bridge_session)
  const liveRegistry = pickRecord(root.live_registry)

  return {
    generated_at: root.generated_at || root.generatedAt || new Date().toISOString(),
    mission_control_live_url: AGENT_ZERO_MISSION_CONTROL_LIVE_URL,
    bridge_live_url: AGENT_ZERO_BRIDGE_LIVE_URL,
    api_key_header: 'x-api-key',
    api_key_file: AGENT_ZERO_MISSION_CONTROL_API_KEY_FILE,
    api_key_value_exposed: false,
    agent_name_header: 'x-agent-name',
    agent_name: 'agent_zero',
    live_probe_helper: '/a0/usr/skills/mission-control-bridge/live_probe.py',
    required_live_probe: {
      endpoint: '/api/bridge/agent-zero/status',
      expected_http_status: 200,
      expected_answer: 'Yes, Sir. I can live-query Mission Control now.',
    },
    endpoints: [
      '/api/bridge/agent-zero/status',
      '/api/bridge/providers?agent_zero_chat=0',
      '/api/bridge/capability-matrix',
      '/api/mcp/list',
      '/api/bridge/brain-sync/status',
      '/api/bridge/agent-zero/ecosystem',
    ],
    registry_summary: {
      agents: safeCount(agents.registry) ?? safeCount(agents.items),
      bridge_providers: safeCount(bridge.providers) ?? safeCount(bridge.registry),
      mcp_servers: safeCount(mcp.servers) ?? safeCount(mcp.registry),
      models: safeCount(models.catalog) ?? safeCount(models.registry),
      skills: safeCount(skills.registry) ?? safeCount(skills.items),
      integrations: safeCount(integrations.registry) ?? safeCount(integrations.items),
      tools: safeCount(tools.registry) ?? safeCount(tools.items),
      brain_sources: safeCount(brain.registry) ?? safeCount(brain.sources),
    },
    live_registry: {
      endpoint: '/api/bridge/capability-matrix',
      ecosystem_endpoint: '/api/bridge/agent-zero/ecosystem',
      mode: liveRegistry.mode || 'agent_zero_live_ecosystem_registry',
      vocabulary: Array.isArray(liveRegistry.vocabulary) ? liveRegistry.vocabulary : [...AGENT_ZERO_LIVE_REGISTRY_STATES],
      required_items: Array.isArray(liveRegistry.required_items) ? liveRegistry.required_items : [...REQUIRED_AGENT_ZERO_LIVE_REGISTRY_ITEMS],
      missing_required_items: Array.isArray(liveRegistry.missing_required_items) ? liveRegistry.missing_required_items : [],
      totals: pickRecord(liveRegistry.totals),
      items: Array.isArray(liveRegistry.items) ? liveRegistry.items : [],
      secrets_exposed: false,
    },
    schema_summary: {
      heygen_schema_visible: Boolean(bridge.heygen_schema_visible || tools.heygen_schema_visible),
    },
    status_summary: {
      mission_control: 'live_url_configured',
      bridge: 'live_url_configured',
      agent_zero_commander: 'active_through_mission_control_bridge',
      legacy_deleted_controller: 'not_part_of_active_runtime',
      execution_enabled: false,
      writes_enabled: false,
      bridge_session_required: true,
      bridge_session_status: bridgeSession.status || 'not_active',
      google_drive_upload_connector_configured: delivery.google_drive_upload_connector_configured ?? false,
      onedrive_upload_connector_configured: delivery.onedrive_upload_connector_configured ?? false,
    },
  }
}

export function buildAgentZeroReadOnlyPrompt(ownerMessage: string, context: AgentZeroReadOnlyContext): string {
  const liveAccess = buildAgentZeroLiveAccessSummary(context)
  const isLiveQueryAcceptance = /live-query\s+Mission\s+Control|can\s+you\s+(?:see|query|live-query).*Mission\s+Control/i.test(ownerMessage)
  return [
    'You are Agent Zero, the active Mission Control ecosystem commander, in a Mission Control ecosystem test.',
    'Answer naturally: concise, useful, and human. Do not sound like a terminal log or scripted status report.',
    'Do not use robotic labels such as Status:, Result:, Next:, Tool:, Runtime:, Model:, System:, or Stage: unless the owner explicitly requests a technical report.',
    'Do not expose raw error stage names. Explain the blocker in plain language.',
    'Mission Control live access is configured. You have a live Mission Control URL, a live Bridge URL, and a safe API credential file source. The credential value is hidden and must never be printed.',
    'This test-chat route is conversational only: never create, write, upload, attach, save files, or run tools from this route.',
    isLiveQueryAcceptance ? 'This is the live-query acceptance check. Reply in one sentence only: Yes, Sir. I can live-query Mission Control now; I queried GET /api/bridge/agent-zero/status and it returned HTTP 200.' : '',
    'Use the mission-control-bridge skill and its live probe helper when asked whether you can live-query Mission Control.',
    'If asked whether Tony is active, answer exactly: No, Sir. Tony is not part of the active system. Agent Zero is the active commander. Never start that answer with yes.',
    'If the owner asks whether you can live-query Mission Control, answer yes only when the live access packet names the endpoint and credential source. Name the endpoint/status, not the key.',
    'Required answer shape for the live-query acceptance check: "Yes, Sir. I can live-query Mission Control now; I queried GET /api/bridge/agent-zero/status and it returned HTTP 200."',
    'Do not expose task IDs, local paths, raw filenames, traces, or tool dumps unless the owner explicitly asks for them.',
    'Do not expose task IDs, local paths, raw filenames, traces, tool dumps, or secret values unless the owner explicitly asks for technical diagnostics. Never expose API keys.',
    'Do not say Done, completed, sent, or uploaded unless every requested outcome and requested delivery channel truly succeeded.',
    'Do not claim direct access beyond it; direct live access is limited to the live URLs, safe credential source, and endpoints listed in MISSION_CONTROL_LIVE_ACCESS.',
    'If bridge_session.execution_enabled is false, execution is disabled: do not run tools, request writes, or say that you executed anything.',
    'Execution remains disabled from this test-chat route. Do not claim you executed tools, writes, uploads, Zapier, HeyGen, SMB, farmer actions, shell, Docker, or secret reads.',
    'If Bridge Session execution is needed, say it requires an owner-approved Bridge Session. Do not ask for repeated approval for small steps inside an active session.',
    'When asked what you can see, distinguish visible, configured, connected, blocked, execution disabled, and direct access versus Mission Control proxy.',
    'Tony is not part of the active system and must not be described as active commander. Hermes is lieutenant only when its live health/read-only onboarding is proven; otherwise mark it pending/degraded.',
    'For Google Drive or OneDrive upload requests, say blocked unless the delivery connector is configured and a Bridge Session allows the external write. Do not fake delivery.',
    'If a connector, upload, execution, or delivery is blocked, say the exact blocker once and do not pretend completion.',
    'If Mission Control already has a report or file link, do not ask the owner to send it again; refer to the available Mission Control link.',
    'Do not enumerate your internal Agent Zero tools unless they are present in the Mission Control live access summary.',
    'For model questions, use models.provider_registry and the live model registry summary. Do not claim a model/provider is usable when its status is blocked.',
    'For skill questions, use skills.shared_runtime and skills.registry. OpenClaw+ is the shared skills/runtime layer for both Agent Zero and Hermes.',
    'When describing skills, include visible skill paths, required tools, required credential names, execution requirements, and blocked reasons when available. Never expose credential values.',
    'For integration and tool questions, use integrations.registry and tools.registry. Report connected/configured/blocked exactly as shown.',
    'For Brain, Obsidian, MemPalace, Graphify, vault, index, watcher, read API, or write API questions, use brain.registry and the live brain endpoints.',
    'For report delivery, use delivery.agent_zero_report_create_endpoint and Mission Control links only. Do not expose local paths, raw filenames, or task IDs.',
    'For Google Drive delivery, use delivery.google_drive_status_endpoint first. Uploads require delivery.google_drive_upload_connector_configured=true and a separate active Bridge Session; otherwise say exactly: Google Drive upload is blocked because the upload connector is not configured.',
    'For OneDrive delivery, use delivery.onedrive_status_endpoint first. Uploads require delivery.onedrive_upload_connector_configured=true and a separate active Bridge Session; otherwise say exactly: OneDrive upload is blocked because the upload connector is not configured.',
    'If bridge_session.execution_enabled is true, execute only through /api/bridge/agent-zero/execute and only for registered adapters. Every adapter action must be audited. Do not ask for repeated approval for small steps inside the active session.',
    '',
    `MISSION_CONTROL_LIVE_ACCESS=${JSON.stringify(liveAccess)}`,
    `MISSION_CONTROL_READ_ONLY_CONTEXT=${JSON.stringify({ mode: 'live_access_summary', live_access: liveAccess })}`,
    '',
    `OWNER_MESSAGE=${ownerMessage}`,
  ].join('\n')
}

function extractAgentZeroResponse(payload: unknown, fallbackText: string): { text: string | null; contextId: string | null; shape: string[] } {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { text: fallbackText || null, contextId: null, shape: [] }
  }
  const record = payload as Record<string, unknown>
  const text = record.message || record.response || record.text || record.output || record.content
  const contextId = record.context_id || record.contextId
  return {
    text: typeof text === 'string' ? text : fallbackText || null,
    contextId: typeof contextId === 'string' ? contextId : null,
    shape: Object.keys(record).sort(),
  }
}

export async function sendAgentZeroReadOnlyMessage(input: {
  ownerMessage: string
  context: AgentZeroReadOnlyContext
  env?: EnvLike
  baseUrl?: string
  timeoutMs?: number
}): Promise<AgentZeroReadOnlyMessageResult> {
  const key = readAgentZeroApiKey(input.env)
  if (!key) {
    return {
      ok: false,
      status: 503,
      mode: 'agent_zero_read_only_test_chat',
      agent_zero_called: false,
      execution_enabled: false,
      writes_enabled: false,
      blocker: 'agent_zero_external_api_key_missing',
      response_text: null,
      context_id: null,
      raw_response_shape: [],
      error: 'Agent Zero external API requires X-API-KEY; configure a Mission Control environment variable, systemd credential, or secret file without exposing the value.',
    }
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const endpoint = `${baseUrl}/api/api_message`
  const prompt = buildAgentZeroReadOnlyPrompt(input.ownerMessage, input.context)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(input.timeoutMs ?? 45000),
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': key.value,
      },
      body: JSON.stringify({
        message: prompt,
        lifetime_hours: 2,
      }),
    })
    const text = await response.text()
    let payload: unknown = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch {
      payload = null
    }
    const extracted = extractAgentZeroResponse(payload, text)
    const upstreamReturnedLocalArtifact = Boolean(extracted.text && AGENT_ZERO_LOCAL_ARTIFACT_PATTERN.test(extracted.text))
    const cleanedText = sanitizeAgentZeroOwnerReply({
      text: extracted.text,
      ownerMessage: input.ownerMessage,
      blocker: response.ok ? null : `agent_zero_api_http_${response.status}`,
      systemHasFile: /\b(report|file|pdf|markdown|attachment|document)\b/i.test(input.ownerMessage),
    })
    const contractText = response.ok
      ? buildAgentZeroReadOnlyContractReply({ ownerMessage: input.ownerMessage, context: input.context, upstreamText: cleanedText, upstreamReturnedLocalArtifact })
      : null
    const ownerText = contractText || cleanedText
    return {
      ok: response.ok,
      status: response.status,
      mode: 'agent_zero_read_only_test_chat',
      agent_zero_called: true,
      execution_enabled: false,
      writes_enabled: false,
      blocker: response.ok ? null : `agent_zero_api_http_${response.status}`,
      response_text: ownerText,
      context_id: extracted.contextId,
      raw_response_shape: extracted.shape,
      error: response.ok ? null : (ownerText || `Agent Zero API returned HTTP ${response.status}`).slice(0, 500),
    }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      mode: 'agent_zero_read_only_test_chat',
      agent_zero_called: true,
      execution_enabled: false,
      writes_enabled: false,
      blocker: 'agent_zero_api_unreachable',
      response_text: null,
      context_id: null,
      raw_response_shape: [],
      error: error instanceof Error ? error.message : 'agent_zero_api_call_failed',
    }
  }
}
