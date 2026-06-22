import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'
import { FIX_SAFETY, runSecurityScan, type Check, type ScanResult } from '@/lib/security-scan'
import { recordJarvisAudit, jarvisAuditSummary } from '@/lib/jarvis-audit'
import { buildHermesBoundaryPacket, RON_WEASLEY_IDENTITY } from '@/lib/hermes-boundaries'
import {
  HERMES_ALLOWED_ACTIONS,
  HERMES_FORBIDDEN_ACTIONS,
  HERMES_JARVIS_APPROVAL_REQUIRED_FOR,
  HERMES_OPERATING_MODES,
  HERMES_OWNER_HARD_STOPS,
  HERMES_READINESS_STATES,
  evaluateHermesPolicy,
  redactHermesValue,
} from '@/lib/hermes-policy'
import {
  HERMES_BRAIN_SOURCES,
  HERMES_MINI_AGENT_TEMPLATES,
  HERMES_SKILL_CATEGORIES,
  HERMES_TOOL_MAP,
} from '@/lib/hermes-registries'

type RiskLevel = 'low' | 'medium' | 'high'
type HermesRecordKind =
  | 'recommendation'
  | 'dispatch_plan'
  | 'memory_correction_draft'
  | 'skill_draft'
  | 'skill_version_draft'
  | 'skill_test_plan'
  | 'mini_agent_blueprint'
  | 'routing_decision'
  | 'tool_recommendation'
  | 'model_route_recommendation'
  | 'workflow_pattern_draft'
  | 'automation_recommendation'
  | 'automation_optimization_recommendation'
  | 'inactive_template_recommendation'
  | 'paperclip_blocker_resolution_draft'
  | 'paperclip_agent_support_workflow'
  | 'paperclip_issue_prioritization'
  | 'paperclip_report_draft'
  | 'paperclip_skill_suggestion'
  | 'paperclip_task_routing_recommendation'
  | 'zapier_exact_action_recommendation'
  | 'workflow_draft'
  | 'jarvis_concurrence_request'

export type HermesInternalRecord = {
  id: string
  rollback_id: string
  at: string
  kind: HermesRecordKind
  title: string
  payload: Record<string, unknown>
  jarvis_final_authority: true
  hermes_replaces_jarvis: false
  openclaw_is_hermes: false
  external_execution_enabled: false
  credential_values_exposed: false
  audit_hash: string
  rollback_policy: string
}

type HermesWriteResult =
  | {
      ok: true
      route: string
      mode: 'hermes_internal_record_written'
      record: HermesInternalRecord
      audit_record_written: true
      audit_hash: string
      rollback_id: string
      writes_enabled: true
      external_execution_enabled: false
      credential_values_exposed: false
      jarvis_final_authority: true
      hermes_replaces_jarvis: false
      openclaw_is_hermes: false
    }
  | {
      ok: false
      route: string
      mode: 'blocked_before_internal_write'
      exact_blocker: 'jarvis_approval_required' | 'owner_hard_stop_required' | 'invalid_payload'
      audit_record_written: false
      rollback_id: null
      writes_enabled: false
      external_execution_enabled: false
      credential_values_exposed: false
      jarvis_final_authority: true
      hermes_replaces_jarvis: false
      openclaw_is_hermes: false
    }

const storePath = join(config.dataDir, 'hermes-internal-records.json')

function readRows(): HermesInternalRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRows(rows: HermesInternalRecord[]) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

function commonInvariants() {
  const boundary = buildHermesBoundaryPacket()
  return {
    ...boundary,
    credential_values_exposed: false,
    external_execution_enabled: false,
    protected_execution_enabled: false,
    broad_connector_execution_enabled: false,
    no_secrets_exposed: true,
  }
}

function ronIdentityFields() {
  return {
    identity: RON_WEASLEY_IDENTITY.canonical_name,
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    creator: 'Lou',
    reports_to: 'Agent Zero / Jarvis',
  }
}

export function listHermesInternalRecords(limit = 50) {
  return readRows().slice(0, limit)
}

function createRecord(kind: HermesRecordKind, title: string, payload: Record<string, unknown>, rollbackPolicy: string): HermesWriteResult {
  const policy = evaluateHermesPolicy(payload)
  if (!policy.allowed) {
    return {
      ok: false,
      route: `bridge.hermes.${kind}`,
      mode: 'blocked_before_internal_write',
      exact_blocker: policy.exact_blocker,
      audit_record_written: false,
      rollback_id: null,
      writes_enabled: false,
      external_execution_enabled: false,
      credential_values_exposed: false,
      jarvis_final_authority: true,
      hermes_replaces_jarvis: false,
      openclaw_is_hermes: false,
    }
  }

  const safePayload = redactHermesValue(payload) as Record<string, unknown>
  const audit = recordJarvisAudit({
    actor: 'hermes',
    event: `hermes_${kind}`,
    target: title,
    classification: 'internal_state_write',
    detail: {
      kind,
      rollback_policy: rollbackPolicy,
      jarvis_final_authority: true,
      external_execution_enabled: false,
      payload: safePayload,
    },
  })
  const record: HermesInternalRecord = {
    id: `her_${randomUUID()}`,
    rollback_id: `hrb_${randomUUID()}`,
    at: new Date().toISOString(),
    kind,
    title,
    payload: safePayload,
    jarvis_final_authority: true,
    hermes_replaces_jarvis: false,
    openclaw_is_hermes: false,
    external_execution_enabled: false,
    credential_values_exposed: false,
    audit_hash: audit.hash,
    rollback_policy: rollbackPolicy,
  }
  writeRows([record, ...readRows()])

  return {
    ok: true,
    route: `bridge.hermes.${kind}`,
    mode: 'hermes_internal_record_written',
    record,
    audit_record_written: true,
    audit_hash: audit.hash,
    rollback_id: record.rollback_id,
    writes_enabled: true,
    external_execution_enabled: false,
    credential_values_exposed: false,
    jarvis_final_authority: true,
    hermes_replaces_jarvis: false,
    openclaw_is_hermes: false,
  }
}

export function buildHermesStatus() {
  const audit = jarvisAuditSummary()
  const records = listHermesInternalRecords(20)
  return {
    ...commonInvariants(),
    route: 'bridge.hermes.status',
    identity: RON_WEASLEY_IDENTITY.canonical_name,
    canonical_name: RON_WEASLEY_IDENTITY.canonical_name,
    short_name: RON_WEASLEY_IDENTITY.short_name,
    full_title: RON_WEASLEY_IDENTITY.full_title,
    legacy_names: RON_WEASLEY_IDENTITY.legacy_names,
    role: 'nuclear_dispatcher',
    parent_authority: 'Agent Zero / Jarvis',
    operating_mode: 'nuclear_dispatcher',
    readiness_state: 'jarvis_delegated_ready',
    full_access_status: 'FULL_ACCESS_DELEGATED',
    direct_line_route: '/api/bridge/agent-lines/status',
    full_access_route: '/api/bridge/hermes/full-access/status',
    system_command_registry_route: '/api/bridge/hermes/system-command-registry',
    delegated_execute_route: '/api/bridge/hermes/execute',
    mission_control_mcp: {
      server_name: 'mission-control-ron',
      server_script: 'scripts/mc-mcp-server.cjs',
      install_script: 'scripts/install-ron-mc-mcp-server.sh',
      tools_total: 35,
      first_mode: 'read_only',
      write_ladder_mode: 'controlled_write_after_jarvis_concurrence',
      token_policy: 'per_agent_scoped_token_required',
      allowed_read_scopes: ['ron.read', 'ron.gateway_read', 'ron.brain_read', 'ron.cybersecurity_audit_read'],
      owner_secret_handling: 'token values are never printed; use token file or brokered secret store only',
    },
    jarvis_delegation_required_for_execution: true,
    openclaw_in_path: false,
    claudeclaw_in_path: false,
    states: HERMES_READINESS_STATES,
    allowed_actions: HERMES_ALLOWED_ACTIONS,
    forbidden_actions: HERMES_FORBIDDEN_ACTIONS,
    jarvis_approval_required_for: HERMES_JARVIS_APPROVAL_REQUIRED_FOR,
    owner_hard_stop_required_for: HERMES_OWNER_HARD_STOPS,
    audit_summary: audit,
    rollback_policy: 'Every Ron Weasley internal mutation writes a rollback_id and every delegated adapter execution uses the Jarvis adapter rollback path; external rollback remains Jarvis-owned.',
    internal_record_count: records.length,
    writes_enabled: false,
    delegated_exact_scope_execution_enabled: true,
  }
}

export function buildHermesReadiness() {
  return {
    route: 'bridge.hermes.readiness',
    status: 'HERMES_BRAIN_MEMORY_INTEGRATION_READY',
    states: HERMES_READINESS_STATES,
    current_state: 'jarvis_delegated_ready',
    can_observe: true,
    can_recommend: true,
    can_draft: true,
    can_create_dispatch_plans: true,
    can_score_memory_quality: true,
    can_create_memory_correction_drafts: true,
    can_execute_external_actions: false,
    can_execute_jarvis_delegated_exact_scope: true,
    jarvis_signed_delegation_required_for_execution: true,
    owner_hard_stop_required_for: HERMES_OWNER_HARD_STOPS,
    writes_enabled: false,
    delegated_exact_scope_execution_enabled: true,
    ...commonInvariants(),
  }
}

export function buildHermesCapabilityMap() {
  return {
    route: 'bridge.hermes.capability-map',
    capabilities: [
      { id: 'observe', state: 'observe_ready', execution_enabled: false },
      { id: 'recommend', state: 'recommendation_ready', execution_enabled: false },
      { id: 'draft', state: 'draft_ready', execution_enabled: false },
      { id: 'dispatch_safe_mini_agents', state: 'dispatch_plan_ready', execution_enabled: false },
      { id: 'optimize', state: 'draft_ready', execution_enabled: false },
      { id: 'request_jarvis_concurrence', state: 'jarvis_concurrence_required', execution_enabled: false },
      { id: 'execute_jarvis_delegated_exact_scope', state: 'jarvis_delegated_ready', execution_enabled: true },
    ],
    direct_line_route: '/api/bridge/agent-lines/status',
    system_command_registry_route: '/api/bridge/hermes/system-command-registry',
    delegated_execute_route: '/api/bridge/hermes/execute',
    openclaw_in_path: false,
    claudeclaw_in_path: false,
    operating_modes: HERMES_OPERATING_MODES,
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesAuthorityMap() {
  return {
    route: 'bridge.hermes.authority',
    hermes_can_without_repeated_owner_approval: HERMES_ALLOWED_ACTIONS,
    jarvis_approval_required_for: HERMES_JARVIS_APPROVAL_REQUIRED_FOR,
    owner_hard_stop_required_for: HERMES_OWNER_HARD_STOPS,
    mini_agent_forbidden_actions: ['access secrets', 'delete data', 'send external messages', 'run broad connectors', 'modify source', 'override Jarvis'],
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesBrainMap() {
  return {
    route: 'bridge.hermes.brain-map',
    memory_sources: HERMES_BRAIN_SOURCES,
    memory_quality_endpoint: '/api/bridge/hermes/memory-quality',
    memory_correction_draft_endpoint: '/api/bridge/hermes/memory-correction-draft',
    memory_deletion_allowed: false,
    stale_memory_policy: 'mark_historical_or_quarantine_before_removal',
    canonical_truth_policy: 'live Mission Control routes outrank stale reports and unverified memory',
    freshness_score_model: 'v1_static_policy_then_route_freshness',
    retrieval_audit_enabled: true,
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesMemoryQuality() {
  return {
    route: 'bridge.hermes.memory-quality',
    status: 'HERMES_BRAIN_MEMORY_INTEGRATION_READY',
    memory_quality_score: 86,
    memory_sources: HERMES_BRAIN_SOURCES,
    memory_deletion_allowed: false,
    canonical_truth_hierarchy: [
      {
        priority: 1,
        source: 'live_mission_control_routes',
        examples: [
          '/api/bridge/agent-zero/status',
          '/api/bridge/agent-zero/bridge-session',
          '/api/bridge/agent-zero/full-go/readiness',
          '/api/bridge/agent-zero/agent-roster',
        ],
      },
      { priority: 2, source: 'Jarvis audit and rollback records' },
      { priority: 3, source: 'Ron Weasley internal recommendations and correction drafts' },
      { priority: 4, source: 'MemPalace and Obsidian summaries marked fresh' },
      { priority: 5, source: 'historical runtime memory and old reports' },
    ],
    false_claim_detection: {
      enabled: true,
      watch_phrases: [
        'execution disabled',
        'no active Bridge Session',
        'Bridge Session required',
        'Jarvis has no access',
        'OpenClaw is Jarvis',
        'Tony MC is Jarvis',
      ],
      correction_rule: 'Create a memory_correction_draft that cites the live canonical route and asks Jarvis for concurrence before policy changes.',
    },
    stale_memory_quarantine: {
      deletion_allowed: false,
      allowed_actions: [
        'mark_historical',
        'create_correction_draft',
        'request_jarvis_concurrence',
      ],
      rollback_policy: 'Remove or supersede the exact correction draft by rollback_id; do not delete broad memory stores.',
    },
    retrieval_audit: {
      enabled: true,
      audit_event: 'hermes_memory_retrieval_quality_check',
      records_source_route: '/api/bridge/hermes/memory-correction-draft',
    },
    cross_agent_memory_handoff: {
      jarvis_final_authority: true,
      hermes_role: 'detect stale claims and draft corrections',
      mini_agent_role: 'tagging suggestions only',
      smart_agent_role: 'review complex memory conflicts before Jarvis concurrence',
    },
    mini_agent_memory_tagging: {
      enabled_for_drafts: true,
      persistent_activation_requires: 'jarvis_approval',
      forbidden_actions: ['delete memory', 'read secrets', 'write external systems'],
    },
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesToolMap() {
  return {
    ...commonInvariants(),
    route: 'bridge.hermes.tool-map',
    tools: HERMES_TOOL_MAP,
    gateway_tool_intelligence_endpoint: '/api/bridge/hermes/gateway-tool-intelligence',
    tool_recommendation_endpoint: '/api/bridge/hermes/tool-recommendation',
    broad_connector_execution_enabled: false,
    gateway_execution_policy: 'Ron Weasley recommends; Jarvis executes through certified exact-scope adapters.',
    writes_enabled: false,
  }
}

export function buildHermesGatewayToolIntelligence() {
  return {
    route: 'bridge.hermes.gateway-tool-intelligence',
    status: 'HERMES_GATEWAY_TOOL_INTELLIGENCE_READY',
    registry_inputs: [
      '/api/bridge/capability-matrix',
      '/api/bridge/providers',
      '/api/mcp/servers',
      '/api/bridge/agent-zero/certification',
      '/api/bridge/zapier/approved-actions',
    ],
    scoring_dimensions: [
      'capability',
      'risk',
      'cost',
      'latency',
      'reliability',
    ],
    tool_capability_scoring: {
      scale: '0_to_5',
      inputs: ['route availability', 'adapter certification', 'scope fit', 'data freshness'],
    },
    tool_risk_scoring: {
      scale: '0_to_5',
      low_risk_examples: ['read-only status', 'metadata list', 'internal draft'],
      high_risk_examples: ['external write', 'workflow activation', 'credential access'],
    },
    fallback_recommendations: [
      { primary: 'gateway_inventory', fallback: 'capability_matrix', reason: 'Both are read-only and source-backed.' },
      { primary: 'zapier.approved-actions', fallback: 'zapier.status', reason: 'Approved library is preferred; status remains read-only.' },
      { primary: 'hermes.memory-quality', fallback: 'hermes.brain-map', reason: 'Memory quality has richer scoring; brain map has canonical sources.' },
    ],
    collision_detection: {
      enabled: true,
      checks: ['duplicate tool purpose', 'overlapping connector action', 'wrong authority boundary'],
    },
    unavailable_tool_explanations: {
      enabled: true,
      fields: ['tool_id', 'blocker', 'owner_action_required', 'safe_fallback'],
    },
    best_tool_recommendation_policy: {
      hermes_recommends: true,
      jarvis_executes: true,
      broad_connector_execution_enabled: false,
    },
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesProviderModelOptimization() {
  return {
    route: 'bridge.hermes.provider-model-optimization',
    status: 'HERMES_PROVIDER_MODEL_OPTIMIZATION_READY',
    provider_inventory_sources: [
      '/api/bridge/providers',
      '/api/bridge/agent-zero/full-go/provider-model-readiness',
      '/api/bridge/costs',
      '/api/bridge/agent-zero/full-go/dashboard',
    ],
    provider_families: [
      { id: 'local_gateway_model', credential_required: false, preferred_for: ['low-cost summaries', 'internal drafts'] },
      { id: 'openai', credential_required: true, credential_values_exposed: false },
      { id: 'gemini', credential_required: true, credential_values_exposed: false },
      { id: 'openrouter', credential_required: true, credential_values_exposed: false },
      { id: 'anthropic_claude_api', credential_required: true, credential_values_exposed: false },
    ],
    scoring_dimensions: [
      'cost',
      'speed',
      'accuracy',
      'context_length',
      'tool_compatibility',
      'agent_preference',
      'fallback_reliability',
    ],
    token_governor: {
      required: true,
      cost_cap_required_before_external_provider_call: true,
      raw_provider_keys_exposed: false,
    },
    fallback_policy: {
      primary: 'local_gateway_model_when_sufficient',
      fallback: 'credentialed_provider_only_through_gateway_policy',
      max_cost_required: true,
      refusal_reasons_required: true,
    },
    production_route_change_requires: 'jarvis_concurrence',
    raw_provider_keys_exposed: false,
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesWorkflowCompiler() {
  return {
    route: 'bridge.hermes.workflow-compiler',
    status: 'HERMES_WORKFLOW_COMPILER_READY',
    repeated_pattern_detection: {
      enabled: true,
      signals: [
        'same owner request repeated',
        'same route bundle checked repeatedly',
        'manual status report created repeatedly',
        'duplicate Paperclip or Gateway triage steps',
      ],
      output: 'workflow_pattern_draft',
    },
    workflow_schema: {
      required_fields: [
        'name',
        'trigger',
        'steps',
        'systems',
        'risk_level',
        'rollback',
        'activation_requires',
      ],
      activation_requires: ['jarvis_approval'],
      external_execution_enabled: false,
    },
    risk_scoring: {
      levels: ['low', 'medium', 'high', 'owner_hard_stop'],
      low: 'read-only or internal draft/report workflow',
      medium: 'multi-system plan that still writes only internal records',
      high: 'production-impacting workflow that requires Jarvis concurrence before any action',
      owner_hard_stop: 'credentials, public exposure, destructive deletion, broad connectors, live social posting, or spending above cap',
    },
    integrations: {
      n8n: {
        mode: 'inventory_and_draft_only',
        activation_enabled: false,
        exact_workflow_id_required_before_execution: true,
      },
      zapier: {
        mode: 'approved_action_recommendations_only',
        broad_execution_enabled: false,
        zap_creation_enabled: false,
      },
      scheduled_jobs: {
        mode: 'runbook_and_preflight_only',
        run_now_requires: 'jarvis_certified_adapter',
      },
      webhooks: {
        mode: 'registry_and_simulation_only',
        live_delivery_requires: 'exact_scope_adapter',
      },
      paperclip: {
        mode: 'workflow_context_and_report_only',
        writes_require: 'paperclip_exact_scope_adapter',
      },
    },
    simulator: {
      enabled: true,
      route: '/api/bridge/hermes/automation-recommendation',
      external_execution_enabled: false,
      output: 'dry_state_transition_report',
    },
    failure_handling: {
      rollback_required: true,
      audit_required: true,
      failure_report_required: true,
      jarvis_concurrence_required_for_activation: true,
    },
    reports: {
      workflow_pattern_draft_endpoint: '/api/bridge/hermes/workflow-pattern-draft',
      automation_recommendation_endpoint: '/api/bridge/hermes/automation-recommendation',
      jarvis_concurrence_endpoint: '/api/bridge/hermes/jarvis-concurrence-request',
    },
    activation_policy: 'jarvis_approval_required',
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesAutomationOptimization() {
  return {
    ...commonInvariants(),
    ...ronIdentityFields(),
    route: 'bridge.hermes.automation-optimization',
    status: 'RON_WEASLEY_AUTOMATION_OPTIMIZATION_READY',
    purpose: 'Ron Weasley reviews repeated manual work and drafts safe automation improvements for Jarvis concurrence.',
    input_sources: [
      '/api/bridge/hermes/workflow-compiler',
      '/api/bridge/hermes/automation-recommendation',
      '/api/bridge/zapier/approved-actions',
      '/api/tasks',
    ],
    allowed_outputs: [
      'internal automation optimization recommendation',
      'workflow pattern draft',
      'Jarvis concurrence request',
      'rollback plan',
    ],
    activation_enabled: false,
    activation_requires: 'jarvis_approval',
    external_execution_enabled: false,
    writes_enabled: false,
    rollback_policy: 'Archive the exact Ron Weasley optimization recommendation by rollback_id; no workflow is activated from this route.',
  }
}

export function buildHermesPaperclipIntelligenceLayer() {
  return {
    ...commonInvariants(),
    ...ronIdentityFields(),
    route: 'bridge.hermes.paperclip-intelligence',
    status: 'RON_WEASLEY_PAPERCLIP_INTELLIGENCE_READY',
    purpose: 'Ron Weasley analyzes Paperclip company work as a cybersecurity and Gateway optimization advisor under Jarvis.',
    paperclip_write_policy: 'paperclip_exact_scope_adapter_required',
    allowed_outputs: [
      'issue prioritization draft',
      'agent support workflow draft',
      'skill suggestion',
      'company memory map',
      'report draft',
    ],
    direct_execution_enabled: false,
    paperclip_company_creation_enabled: false,
    credential_values_exposed: false,
    writes_enabled: false,
  }
}

export function buildHermesPaperclipAgentPerformance() {
  return {
    ...commonInvariants(),
    ...ronIdentityFields(),
    route: 'bridge.hermes.paperclip-agent-performance',
    status: 'RON_WEASLEY_PAPERCLIP_AGENT_PERFORMANCE_READY',
    scoring_dimensions: [
      'blocked_work',
      'owner_visible_task_proof',
      'handoff_quality',
      'route_accuracy',
      'rollback_readiness',
      'credential_gate_compliance',
    ],
    performance_policy: 'Ron Weasley drafts recommendations only; Jarvis remains final authority and Paperclip writes require exact-scope adapters.',
    paperclip_writes_enabled: false,
    external_execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildHermesPaperclipCompanyMemoryMap() {
  return {
    ...commonInvariants(),
    ...ronIdentityFields(),
    route: 'bridge.hermes.paperclip-company-memory-map',
    status: 'RON_WEASLEY_PAPERCLIP_COMPANY_MEMORY_MAP_READY',
    memory_domains: [
      'company_agents',
      'blocked_credentials',
      'task_routing',
      'issue_priorities',
      'skill_suggestions',
      'audit_and_rollback',
    ],
    stale_memory_policy: 'Ron Weasley can draft corrections and memory hygiene notes only; deletion or promotion requires Jarvis concurrence.',
    paperclip_admin_credential_required_for_company_creation: true,
    memory_deletion_allowed: false,
    external_execution_enabled: false,
    writes_enabled: false,
  }
}

export function buildHermesSkillRegistry() {
  return {
    route: 'bridge.hermes.skill-registry',
    categories: HERMES_SKILL_CATEGORIES,
    skill_foundry_endpoint: '/api/bridge/hermes/skill-foundry',
    skill_version_draft_endpoint: '/api/bridge/hermes/skill-version-draft',
    skill_test_plan_endpoint: '/api/bridge/hermes/skill-test-plan',
    activation_policy: 'jarvis_approval_required',
    drafts_enabled: true,
    activation_enabled: false,
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesSkillFoundry() {
  return {
    route: 'bridge.hermes.skill-foundry',
    status: 'RON_WEASLEY_SKILL_FOUNDRY_READY',
    legacy_status_alias: 'HERMES_SKILL_FOUNDRY_READY',
    owner_facing_name: 'Ron Weasley Skill Foundry',
    inventory_contract: {
      mission_control_registry_route: '/api/skills',
      expected_registered_skills_minimum: 23,
      live_inventory_required_for_ready: true,
      local_draft_library_route: '/api/bridge/ron/skill-draft',
      legacy_local_draft_library_route: '/api/bridge/hermes/skill-draft',
      production_skill_writes_enabled: false,
      draft_writes_enabled: true,
      activation_enabled: false,
      duplicate_detection: {
        key: 'lowercase_slug_without_punctuation',
        action: 'Ron drafts merge recommendations only; Jarvis approves any activation or retirement.',
      },
      missing_skill_policy: {
        action: 'Ron creates a skill draft and test plan, then asks Jarvis for concurrence before activation.',
        visible_task_required_when_blocked: true,
      },
      mapping_fields: [
        'name',
        'source',
        'purpose',
        'required_tools',
        'required_credentials',
        'execution_requirements',
        'blocked_reasons',
        'allowed_scope',
        'forbidden_scope',
        'tests',
        'audit',
        'rollback',
      ],
    },
    schema: {
      required_fields: [
        'name',
        'category',
        'purpose',
        'input',
        'output',
        'allowed_tools',
        'allowed_scope',
        'forbidden_scope',
        'forbidden_actions',
        'tests',
        'audit',
        'rollback',
        'activation_requires',
        'risk_rating',
        'dependencies',
      ],
      activation_requires: ['jarvis_approval'],
      allowed_categories: HERMES_SKILL_CATEGORIES,
    },
    categories: HERMES_SKILL_CATEGORIES,
    spellbook_entry_schema: {
      name: 'string',
      purpose: 'string',
      input: 'string_or_json_schema',
      output: 'string_or_json_schema',
      allowed_scope: 'exact internal draft/read scope only',
      forbidden_scope: [
        'secrets',
        'credential injection',
        'public exposure',
        'broad connector execution',
        'destructive production writes',
        'auth/audit/rollback/redaction disablement',
      ],
      tests: ['static_policy_check', 'no_secret_exposure_check', 'forbidden_action_check', 'rollback_plan_check'],
      audit: 'jarvis_audit_event_required',
      rollback: 'archive_exact_skill_draft_or_version_by_rollback_id',
      jarvis_concurrence_required: true,
    },
    skill_map: {
      registered_mission_control_skills: {
        route: '/api/skills',
        minimum_expected_total: 23,
        source_of_truth: 'live_mission_control_skill_registry',
        state: 'read_only_inventory_required',
      },
      ron_local_skill_library: {
        route: '/api/bridge/ron/skill-registry',
        draft_route: '/api/bridge/ron/skill-draft',
        state: 'draft_only',
        activation_policy: 'jarvis_approval_required',
      },
      duplicates: {
        state: 'detected_from_live_inventory_at_runtime',
        action: 'draft_merge_or_retirement_recommendation_only',
      },
      missing_skills: {
        state: 'detected_from_live_inventory_at_runtime',
        action: 'draft_spellbook_entry_and_test_plan_only',
      },
    },
    draft_workflow: {
      route: '/api/bridge/hermes/skill-draft',
      canonical_route: '/api/bridge/ron/skill-draft',
      state: 'draft_ready',
      external_execution_enabled: false,
    },
    approval_workflow: {
      required_authority: 'Agent Zero / Jarvis',
      route: '/api/bridge/hermes/jarvis-concurrence-request',
      owner_required_for_hard_stops: true,
    },
    test_workflow: {
      route: '/api/bridge/hermes/skill-test-plan',
      steps: [
        'static_policy_check',
        'no_secret_exposure_check',
        'forbidden_action_check',
        'rollback_plan_check',
        'jarvis_concurrence_check',
      ],
    },
    rollback_workflow: {
      route: '/api/bridge/hermes/skill-version-draft',
      rule: 'Archive exact skill draft/version/test-plan by rollback_id; no active skill is changed without Jarvis approval.',
    },
    versioning: {
      enabled: true,
      route: '/api/bridge/hermes/skill-version-draft',
      format: 'semver_draft',
    },
    performance_scoring: {
      enabled: true,
      metrics: [
        'success_rate',
        'rework_rate',
        'false_claim_rate',
        'memory_quality_delta',
        'tool_efficiency_delta',
      ],
    },
    retirement_policy: 'Ron Weasley may draft retirement recommendations only; Jarvis approves deactivation.',
    activation_policy: 'jarvis_approval_required',
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesMiniAgentRegistry() {
  return {
    route: 'bridge.hermes.mini-agent-registry',
    templates: HERMES_MINI_AGENT_TEMPLATES,
    mini_agent_factory_endpoint: '/api/bridge/hermes/mini-agent-factory',
    mini_agent_blueprint_endpoint: '/api/bridge/hermes/mini-agent-blueprint',
    persistent_activation_policy: 'jarvis_approval_required',
    dispatch_policy: 'low_risk_exact_scope_internal_work_only',
    forbidden_actions: ['access secrets', 'delete data', 'send external messages', 'run broad connectors', 'modify source', 'override Jarvis'],
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesMiniAgentFactory() {
  const allowedScopes = Array.from(new Set(HERMES_MINI_AGENT_TEMPLATES.map((template) => template.allowed_scope)))
  return {
    route: 'bridge.hermes.mini-agent-factory',
    status: 'HERMES_MINI_AGENT_FACTORY_READY',
    templates: HERMES_MINI_AGENT_TEMPLATES,
    allowed_scopes: allowedScopes,
    forbidden_actions: [
      'access secrets',
      'delete data',
      'send external messages',
      'run broad connectors',
      'modify source',
      'override Jarvis',
      'bypass audit',
    ],
    lifecycle: {
      states: [
        'draft',
        'jarvis_review_required',
        'active_for_single_task',
        'archived',
      ],
      persistent_agent_requires: 'jarvis_approval',
      owner_hard_stop_for_external_effects: true,
    },
    routing_policy: {
      mini_agent_use_cases: allowedScopes,
      smart_agent_escalation_required_for: [
        'code changes',
        'system integration',
        'adapter design',
        'provider/model routing changes',
        'production troubleshooting with mutation',
      ],
    },
    audit_policy: {
      audit_required: true,
      audit_actor: 'hermes',
      audit_event: 'hermes_mini_agent_blueprint',
    },
    rollback_policy: {
      rollback_required: true,
      rollback_rule: 'Archive the exact mini-agent blueprint by rollback_id; no persistent agent is activated without Jarvis approval.',
    },
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildHermesSmartAgentRouting() {
  return {
    route: 'bridge.hermes.smart-agent-routing',
    status: 'HERMES_SMART_AGENT_ROUTING_READY',
    responsibility_matrix: {
      agent_zero_jarvis: {
        role: 'mission_control_owner_operator',
        final_command_authority: true,
        executes_certified_adapters: true,
      },
      hermes: {
        role: 'nuclear_dispatcher',
        recommends: true,
        drafts: true,
        dispatches_safe_internal_blueprints: true,
        final_command_authority: false,
      },
      pi: {
        role: 'dispatcher_advisory_support',
        recommends_only: true,
      },
      paperclip: {
        role: 'company_workforce_system',
        writes_require_exact_scope_adapter: true,
      },
      space_agent: {
        role: 'browser_research_specialist',
        external_mutation_allowed: false,
      },
      openclaw_plus: {
        type: 'supporting_runtime_system',
        is_jarvis: false,
        is_hermes: false,
      },
    },
    task_complexity_scoring: {
      levels: [
        { id: 'mini_agent', max_risk: 'low', allowed: 'read-only checks, tagging, summaries, draft reports' },
        { id: 'smart_agent', max_risk: 'medium', allowed: 'complex reasoning, workflow architecture, adapter design drafts' },
        { id: 'jarvis_approval_required', max_risk: 'high', allowed: 'production-impacting plans after Jarvis concurrence' },
        { id: 'owner_hard_stop_required', max_risk: 'hard_stop', allowed: 'credentials, public exposure, destructive actions, broad connectors' },
      ],
    },
    escalation_levels: [
      'none',
      'smart_agent_required',
      'jarvis_approval_required',
      'owner_hard_stop_required',
    ],
    routing_decision_api: '/api/bridge/hermes/routing-decision',
    failed_routing_detection: {
      enabled: true,
      signals: ['wrong_agent_selected', 'missing_context', 'stale_memory_used', 'tool_unavailable', 'policy_blocked'],
    },
    wrong_agent_correction: {
      enabled: true,
      action: 'create routing_decision record and request Jarvis concurrence when responsibilities change',
    },
    writes_enabled: false,
    ...commonInvariants(),
  }
}

export function buildRonOwnerActionSheet() {
  return {
    ...commonInvariants(),
    ...ronIdentityFields(),
    route: 'bridge.ron.owner-action-sheet',
    status: 'RON_OWNER_ACTION_SHEET_READY',
    purpose: 'Consolidate owner-gated items so Lou can unblock them from one place without exposing secrets in chat.',
    actions: [
      {
        task_id: 'paperclip-pacman-bootstrap',
        blocker: 'paperclip_board_admin_credential_required',
        why_owner_needed: 'Paperclip company/team bootstrap requires a credentialed board-admin action.',
        safe_action: 'Provide or approve the credential through the existing secure broker, then retry the Paperclip bootstrap adapter.',
        risk: 'credentialed_company_write',
        secure_input_method: 'Mission Control credential broker or approved server-side secret file only',
        continues_without_owner: ['Paperclip read-only inventory', 'Ron workflow drafts', 'Jarvis exact-scope planning'],
      },
      {
        task_id: 'identity-device-permission',
        blocker: 'device_camera_microphone_permission_required',
        why_owner_needed: 'Camera, microphone, and biometric prompts must be approved by the owner in the browser/device UI.',
        safe_action: 'Open the Identity Verification panel and approve only the expected browser permission prompt.',
        risk: 'local_device_permission',
        secure_input_method: 'Owner browser permission prompt only',
        continues_without_owner: ['identity source tests', 'policy checks', 'non-device UI routes'],
      },
      {
        task_id: 'brain-graphify-live-producer',
        blocker: 'graphify_live_producer_required',
        why_owner_needed: 'Full READY needs live producer observation from the deployed Brain lane.',
        safe_action: 'Confirm the producer is running or allow Jarvis to observe the live event stream.',
        risk: 'live_runtime_observation',
        secure_input_method: 'authenticated Mission Control live route; no secrets',
        continues_without_owner: ['Brain status reads', 'memory hygiene drafts', 'route matrix updates'],
      },
      {
        task_id: 'brain-buildwiki-farmer-event',
        blocker: 'buildwiki_live_farmer_event_observation_required',
        why_owner_needed: 'The final READY claim needs a real Build-Wiki/Farmer event seen in Mission Control.',
        safe_action: 'Trigger or allow observation of one Build-Wiki/Farmer event.',
        risk: 'live_runtime_observation',
        secure_input_method: 'authenticated Mission Control live route; no secrets',
        continues_without_owner: ['Build-Wiki status reads', 'draft runbook updates'],
      },
      {
        task_id: 'ron-mcp-token',
        blocker: 'ron_scoped_token_required',
        why_owner_needed: 'Ron must use his own scoped token instead of the global master key.',
        safe_action: 'Create a scoped Ron token and store it in the configured token file with 0600 permissions.',
        risk: 'credential_storage',
        secure_input_method: 'server-side token file or credential broker; never chat',
        continues_without_owner: ['MCP source wiring', 'read-only route tests', 'install script dry run'],
      },
      {
        task_id: 'direct-line-voice-probe',
        blocker: 'live_telegram_voice_probe_requires_owner_message',
        why_owner_needed: 'Only the owner can send the real voice probe from the expected channel.',
        safe_action: 'Send the trace nonce through the approved owner channel when asked by Mission Control.',
        risk: 'owner_channel_live_probe',
        secure_input_method: 'approved owner Telegram/browser channel; no token values',
        continues_without_owner: ['local direct-line probes', 'script install', 'trace API validation'],
      },
      {
        task_id: 'spaceagent-live-proof',
        blocker: 'live_route_proof_pending_if_required',
        why_owner_needed: 'A live route click or authenticated route check may be needed for final owner-visible proof.',
        safe_action: 'Open SpaceAgent from Agent Hub or let Jarvis run an authenticated route smoke.',
        risk: 'read_only_live_proof',
        secure_input_method: 'authenticated Mission Control browser/session',
        continues_without_owner: ['source route proof', 'tests', 'Gateway registry updates'],
      },
      {
        task_id: 'pi-live-proof',
        blocker: 'live_route_proof_pending_if_required',
        why_owner_needed: 'Pi advisory dispatcher final proof may need owner-visible live route confirmation.',
        safe_action: 'Open Pi from Agent Hub or let Jarvis run an authenticated route smoke.',
        risk: 'read_only_live_proof',
        secure_input_method: 'authenticated Mission Control browser/session',
        continues_without_owner: ['Pi source route proof', 'tests', 'Gateway registry updates'],
      },
    ],
    buttons_if_owner_action_center_available: ['acknowledge', 'defer', 'mark_complete', 'request_retry', 'copy_secure_instruction'],
    secrets_in_report: false,
    project_continues: true,
  }
}

function findSecurityCheck(scan: ScanResult, id: string): (Check & { category: string }) | null {
  for (const [category, summary] of Object.entries(scan.categories)) {
    const check = summary.checks.find((item) => item.id === id)
    if (check) return { ...check, category }
  }
  return null
}

function securityCheckStatus(scan: ScanResult, ids: string[]): 'READY' | 'FINDINGS' | 'NOT_OBSERVED' {
  const checks = ids.map((id) => findSecurityCheck(scan, id)).filter((item): item is Check & { category: string } => Boolean(item))
  if (checks.length === 0) return 'NOT_OBSERVED'
  return checks.every((check) => check.status === 'pass') ? 'READY' : 'FINDINGS'
}

function safeSecurityFinding(check: Check & { category: string }) {
  return {
    id: check.id,
    category: check.category,
    name: check.name,
    status: check.status,
    severity: check.severity || 'medium',
    fix_safety: FIX_SAFETY[check.id] || check.fixSafety || 'manual-only',
    remediation_draft: check.status === 'pass'
      ? 'No remediation needed.'
      : 'Draft remediation only; Jarvis and owner approval are required for restart, public exposure, firewall, DNS, Caddy, Tailscale, credential, or production-impacting changes.',
  }
}

export function buildRonCybersecurityPosture() {
  const scan = runSecurityScan()
  const findings = Object.values(scan.categories)
    .flatMap((category) => category.checks)
    .filter((check) => check.status !== 'pass')
    .map((check) => safeSecurityFinding(findSecurityCheck(scan, check.id) || { ...check, category: 'unknown' }))

  return {
    ...commonInvariants(),
    ...ronIdentityFields(),
    route: 'bridge.ron.cybersecurity-posture',
    legacy_route: 'bridge.hermes.cybersecurity-posture',
    status: 'RON_WEASLEY_CYBERSECURITY_POSTURE_READY',
    purpose: 'Ron Weasley performs read-only cybersecurity posture review and drafts remediations under Jarvis authority.',
    scan_summary: {
      overall: scan.overall,
      score: scan.score,
      timestamp: scan.timestamp,
      categories: Object.fromEntries(
        Object.entries(scan.categories).map(([category, summary]) => [
          category,
          {
            score: summary.score,
            checks: summary.checks.length,
            findings: summary.checks.filter((check) => check.status !== 'pass').length,
          },
        ]),
      ),
    },
    read_only_checks: {
      exposed_port_audit: {
        status: securityCheckStatus(scan, ['gateway_local', 'gateway_bind']),
        source: 'gateway bind and OpenClaw gateway bind checks',
        changes_allowed: false,
      },
      tailscale_acl_review: {
        status: 'OWNER_APPROVAL_REQUIRED_FOR_CHANGES',
        source: 'read-only policy lane; no ACL mutation from Ron',
        changes_allowed: false,
      },
      caddy_cloudflare_tunnel_review: {
        status: 'OWNER_APPROVAL_REQUIRED_FOR_CHANGES',
        source: 'read-only tunnel/public exposure lane; no DNS/Caddy/Cloudflare mutation from Ron',
        changes_allowed: false,
      },
      csp_cookie_audit: {
        status: securityCheckStatus(scan, ['hsts_enabled', 'cookie_secure']),
        source: 'Mission Control HSTS and secure-cookie checks',
        changes_allowed: false,
      },
      auth_token_hygiene_review: {
        status: securityCheckStatus(scan, ['auth_pass', 'api_key_set', 'env_permissions']),
        source: 'credential configuration and file-permission checks; token values are never exposed',
        changes_allowed: false,
      },
      secret_hygiene_scan: {
        status: securityCheckStatus(scan, ['env_permissions', 'log_redaction']),
        source: 'secret hygiene checks with value redaction',
        changes_allowed: false,
      },
      service_binding_check: {
        status: securityCheckStatus(scan, ['gateway_local', 'gateway_bind']),
        source: 'local-only service binding checks',
        changes_allowed: false,
      },
    },
    findings,
    finding_count: findings.length,
    remediation_policy: {
      ron_can_create_findings: true,
      ron_can_draft_remediations: true,
      jarvis_concurrence_required_for_changes: true,
      owner_required_for_public_exposure_or_credentials: true,
      exact_scope_write_adapters_only_after_approval: true,
    },
    forbidden_actions: [
      'print secrets or .env values',
      'credential injection',
      'public exposure, DNS, Caddy, Tailscale, or firewall changes',
      'destructive production deletion',
      'disable auth, audit, rollback, or redaction',
      'broad connector execution',
    ],
    visible_task_policy: 'Create visible Mission Control findings/tasks for blockers; continue safe read-only checks without stopping the project.',
    writes_enabled: false,
    execution_enabled: false,
    public_exposure_created: false,
    raw_env_values_exposed: false,
    secrets_exposed: false,
  }
}

export function createHermesRecommendation(input: {
  title: string
  recommendation: string
  target_system?: string
  risk_level: RiskLevel
}) {
  return createRecord('recommendation', input.title, input, 'Mark the exact Ron Weasley recommendation record historical; keep Jarvis audit event.')
}

export function createHermesDispatchPlan(input: {
  request: string
  target_system?: string
  risk_level: RiskLevel
  desired_mode: 'observe' | 'recommend' | 'draft' | 'dispatch' | 'optimize'
  context_refs?: string[]
}) {
  return createRecord('dispatch_plan', input.request, input, 'Archive the exact dispatch plan and cancel any unstarted mini-agent blueprint; no external state was changed.')
}

export function createHermesMemoryCorrectionDraft(input: {
  stale_claim: string
  correction: string
  source_route: string
  affected_agents: string[]
  risk_level: RiskLevel
}) {
  return createRecord(
    'memory_correction_draft',
    input.stale_claim,
    {
      ...input,
      activation_requires: 'jarvis_concurrence',
      deletion_allowed: false,
      canonical_truth_required: true,
    },
    'Archive the exact memory correction draft by rollback_id; do not delete broad memory stores or source notes.',
  )
}

export function createHermesSkillDraft(input: {
  name: string
  category: string
  purpose: string
  allowed_tools: string[]
  forbidden_actions: string[]
  activation_requires: 'jarvis_approval'
}) {
  return createRecord('skill_draft', input.name, input, 'Archive the exact skill draft; no skill activation occurred.')
}

export function createHermesSkillVersionDraft(input: {
  skill_id: string
  version: string
  change_summary: string
  risk_rating: RiskLevel
  dependencies: string[]
  activation_requires: 'jarvis_approval'
}) {
  return createRecord('skill_version_draft', input.skill_id, input, 'Archive the exact skill version draft by rollback_id; no active skill was changed.')
}

export function createHermesSkillTestPlan(input: {
  skill_id: string
  checks: string[]
  expected_outcome: string
  rollback: string
}) {
  return createRecord('skill_test_plan', input.skill_id, input, 'Archive the exact skill test plan by rollback_id; no skill activation occurred.')
}

export function createHermesMiniAgentBlueprint(input: {
  name: string
  template_id: string
  task: string
  allowed_scope: string
  expected_output: string
  persistence: 'single_task_only' | 'persistent_requires_jarvis_approval'
  activation_requires: 'jarvis_approval_for_persistent'
}) {
  return createRecord(
    'mini_agent_blueprint',
    input.name,
    {
      ...input,
      external_execution_enabled: false,
      secrets_access_allowed: false,
      production_writes_allowed: false,
    },
    'Archive the exact mini-agent blueprint by rollback_id; cancel any unstarted single-task dispatch.',
  )
}

export function createHermesRoutingDecision(input: {
  task: string
  requested_system: string
  complexity: 'mini_agent' | 'smart_agent' | 'jarvis_approval_required' | 'owner_hard_stop_required'
  recommended_agent: string
  reason: string
  escalation: 'none' | 'smart_agent_required' | 'jarvis_approval_required' | 'owner_hard_stop_required'
  rollback: string
}) {
  return createRecord(
    'routing_decision',
    input.task,
    {
      ...input,
      jarvis_final_authority: true,
      openclaw_is_supporting_runtime_only: true,
    },
    input.rollback || 'Archive the exact routing decision record by rollback_id.',
  )
}

export function createHermesToolRecommendation(input: {
  job: string
  recommended_tool: string
  fallback_tool: string
  reason: string
  risk_score: number
  cost_score: number
  latency_score: number
  reliability_score: number
  rollback: string
}) {
  return createRecord(
    'tool_recommendation',
    input.job,
    {
      ...input,
      hermes_recommends: true,
      jarvis_executes: true,
      external_execution_enabled: false,
    },
    input.rollback || 'Archive the exact tool recommendation record by rollback_id.',
  )
}

export function createHermesModelRouteRecommendation(input: {
  task_class: string
  primary_provider: string
  fallback_provider: string
  max_cost_usd: number
  reason: string
  rollback: string
}) {
  return createRecord(
    'model_route_recommendation',
    input.task_class,
    {
      ...input,
      token_governor_required: true,
      raw_provider_keys_exposed: false,
      production_change_requires: 'jarvis_concurrence',
    },
    input.rollback || 'Archive the exact model route recommendation by rollback_id; no provider route was changed.',
  )
}

export function createHermesWorkflowPatternDraft(input: {
  pattern_name: string
  observed_repetition: string
  candidate_systems: string[]
  proposed_trigger: string
  risk_level: RiskLevel
  rollback: string
}) {
  return createRecord(
    'workflow_pattern_draft',
    input.pattern_name,
    {
      ...input,
      activation_requires: 'jarvis_approval',
      workflow_activation_enabled: false,
      external_execution_enabled: false,
    },
    input.rollback || 'Archive the exact workflow pattern draft by rollback_id; no workflow was activated.',
  )
}

export function createHermesAutomationRecommendation(input: {
  title: string
  workflow_type: string
  systems: string[]
  safe_steps: string[]
  activation_requires: 'jarvis_approval'
  rollback: string
}) {
  return createRecord(
    'automation_recommendation',
    input.title,
    {
      ...input,
      workflow_activation_enabled: false,
      connector_execution_enabled: false,
      jarvis_concurrence_required: true,
    },
    input.rollback || 'Archive the exact automation recommendation by rollback_id; no automation was activated.',
  )
}

export function createHermesAutomationOptimizationRecommendation(input: {
  title: string
  repeated_manual_work: string
  systems: string[]
  recommended_trigger: string
  safe_path: string
  risk_level: RiskLevel
  rollback: string
}) {
  return createRecord(
    'automation_optimization_recommendation',
    input.title,
    {
      ...input,
      recommended_by: RON_WEASLEY_IDENTITY.canonical_name,
      activation_requires: 'jarvis_approval',
      workflow_activation_enabled: false,
      connector_execution_enabled: false,
      external_execution_enabled: false,
    },
    input.rollback || 'Archive the exact Ron Weasley automation optimization recommendation by rollback_id; no workflow was activated.',
  )
}

export function createHermesInactiveTemplateRecommendation(input: {
  title: string
  target_system: 'n8n' | 'zapier' | 'scheduled_jobs' | 'webhooks'
  template_name: string
  reason: string
  required_credentials: string[]
  rollback: string
}) {
  return createRecord(
    'inactive_template_recommendation',
    input.title,
    {
      ...input,
      recommended_by: RON_WEASLEY_IDENTITY.canonical_name,
      activation_requires: 'jarvis_approval',
      template_activation_enabled: false,
      credential_values_exposed: false,
      external_execution_enabled: false,
    },
    input.rollback || 'Archive the exact inactive template recommendation by rollback_id; no workflow template was activated.',
  )
}

export function createHermesPaperclipBlockerResolutionDraft(input: {
  blocker: string
  affected_agent: string
  proposed_resolution: string
  rollback: string
}) {
  return createRecord(
    'paperclip_blocker_resolution_draft',
    input.blocker,
    {
      ...input,
      drafted_by: RON_WEASLEY_IDENTITY.canonical_name,
      paperclip_writes_enabled: false,
      activation_requires: 'jarvis_approval',
      credential_values_exposed: false,
    },
    input.rollback || 'Archive the exact Paperclip blocker resolution draft by rollback_id; no Paperclip state was changed.',
  )
}

export function createHermesPaperclipAgentSupportWorkflow(input: {
  agent: string
  workflow_name: string
  safe_steps: string[]
  activation_requires: 'jarvis_approval'
  rollback: string
}) {
  return createRecord(
    'paperclip_agent_support_workflow',
    input.workflow_name,
    {
      ...input,
      drafted_by: RON_WEASLEY_IDENTITY.canonical_name,
      paperclip_writes_enabled: false,
      workflow_activation_enabled: false,
      external_execution_enabled: false,
    },
    input.rollback || 'Archive the exact Paperclip support workflow draft by rollback_id; no Paperclip workflow was activated.',
  )
}

export function createHermesPaperclipIssuePrioritization(input: {
  issue_ref: string
  priority: RiskLevel
  rationale: string
  next_action: string
  rollback: string
}) {
  return createRecord(
    'paperclip_issue_prioritization',
    input.issue_ref,
    {
      ...input,
      prioritized_by: RON_WEASLEY_IDENTITY.canonical_name,
      paperclip_writes_enabled: false,
      activation_requires: 'jarvis_approval',
    },
    input.rollback || 'Archive the exact Paperclip issue prioritization by rollback_id; no Paperclip issue was changed.',
  )
}

export function createHermesPaperclipReportDraft(input: {
  title: string
  audience: string
  sections: string[]
  rollback: string
}) {
  return createRecord(
    'paperclip_report_draft',
    input.title,
    {
      ...input,
      drafted_by: RON_WEASLEY_IDENTITY.canonical_name,
      paperclip_writes_enabled: false,
      external_delivery_enabled: false,
    },
    input.rollback || 'Archive the exact Paperclip report draft by rollback_id; no external report was sent.',
  )
}

export function createHermesPaperclipSkillSuggestion(input: {
  skill_name: string
  target_agent: string
  purpose: string
  allowed_tools: string[]
  rollback: string
}) {
  return createRecord(
    'paperclip_skill_suggestion',
    input.skill_name,
    {
      ...input,
      suggested_by: RON_WEASLEY_IDENTITY.canonical_name,
      activation_requires: 'jarvis_approval',
      paperclip_writes_enabled: false,
    },
    input.rollback || 'Archive the exact Paperclip skill suggestion by rollback_id; no skill was activated.',
  )
}

export function createHermesPaperclipTaskRoutingRecommendation(input: {
  title: string
  issue_ref: string
  recommended_agent: string
  reason: string
  priority: RiskLevel
  rollback: string
}) {
  return createRecord(
    'paperclip_task_routing_recommendation',
    input.title,
    {
      ...input,
      recommended_by: RON_WEASLEY_IDENTITY.canonical_name,
      route_change_enabled: false,
      paperclip_writes_enabled: false,
      activation_requires: 'jarvis_approval',
    },
    input.rollback || 'Archive the exact Paperclip task routing recommendation by rollback_id; no routing rule was changed.',
  )
}

export function createHermesZapierExactActionRecommendation(input: {
  title: string
  approved_action: string
  allowed_target: string
  reason: string
  rollback: string
}) {
  return createRecord(
    'zapier_exact_action_recommendation',
    input.title,
    {
      ...input,
      recommended_by: RON_WEASLEY_IDENTITY.canonical_name,
      broad_connector_execution_enabled: false,
      zap_creation_enabled: false,
      exact_action_execution_enabled: false,
      activation_requires: 'jarvis_approval',
    },
    input.rollback || 'Archive the exact action recommendation by rollback_id; no connector action was executed.',
  )
}

export function createHermesWorkflowDraft(input: {
  title: string
  purpose: string
  systems: string[]
  activation_requires: 'jarvis_approval'
}) {
  return createRecord('workflow_draft', input.title, input, 'Archive the exact workflow draft; no workflow activation occurred.')
}

export function createHermesJarvisConcurrenceRequest(input: {
  plan_id?: string
  request_id?: string
  requested_by?: string
  target_authority?: string
  action_type?: string
  affected_system?: string
  risk_level?: string
  exact_scope?: unknown
  expected_benefit?: string
  rollback_path?: string
  audit_path?: string
  visible_task_id?: string
  reason?: string
  risk?: string
  rollback?: string
  expected_outcome?: string
}) {
  const requestId = input.request_id || input.plan_id || 'ron-jarvis-concurrence-request'
  return createRecord(
    'jarvis_concurrence_request',
    requestId,
    {
      ...input,
      request_id: requestId,
      requested_by: input.requested_by || 'ron-weasley',
      target_authority: input.target_authority || 'agent-zero-jarvis',
      jarvis_response_contract: [
        'approved',
        'rejected',
        'needs_owner',
        'needs_credential',
        'needs_sudo',
        'needs_design_approval',
      ],
      jarvis_final_authority: true,
      opencloud_intermediary: false,
      credential_values_exposed: false,
    },
    input.rollback_path || input.rollback || 'Close the concurrence request as superseded; Jarvis remains final authority.',
  )
}
