import { describe, expect, it } from 'vitest'
import { buildAgentZeroReadOnlyContext } from '@/lib/agent-zero-bridge'
import {
  HERMES_COLLABORATION_TASK_TYPES,
  requestAgentZeroHermesCollaboration,
  type HermesCollaborationAuditEvent,
} from '@/lib/agent-zero-hermes-collaboration'

function fakeContext(hermesStatus = 'degraded') {
  return buildAgentZeroReadOnlyContext({
    providerIds: ['agent_zero', 'hermes', 'openrouter', 'zapier'],
    providerRegistry: [
      { id: 'agent_zero', name: 'Agent Zero', state: 'active', category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
      { id: 'hermes', name: 'Hermes', state: hermesStatus, category: 'agent', execution_enabled: false, direct_access: false, proxy_access: true },
    ],
    agents: [
      { id: 'agent_zero', status: 'active', role: 'commander', execution_enabled: true, direct_access: false, proxy_access: true },
      { id: 'hermes', status: hermesStatus, role: 'lieutenant / skill and workflow specialist', execution_enabled: false, direct_access: false, proxy_access: true },
    ],
    skillNames: ['email-triage-designer'],
    skillRegistry: [{
      name: 'email-triage-designer',
      source: 'openclaw_plus',
      source_label: 'OpenClaw+',
      path: '/home/tony/.openclaw/skills/email-triage-designer',
      skill_doc_path: '/home/tony/.openclaw/skills/email-triage-designer/SKILL.md',
      description: 'Designs safe email triage workflows.',
      dependencies: ['agentmail'],
      required_tools: ['agentmail'],
      required_credentials: ['AGENTMAIL_API_KEY'],
      execution_requirements: ['Bridge Session required for sends'],
      missing_dependencies: [],
      blocked_dependencies: [],
      blocked_reasons: [],
      runtime_layer: 'OpenClaw+',
      shared_runtime: true,
      owner_agent: null,
      available_to_agents: ['agent_zero', 'hermes'],
      tony_owns_skill_system: false,
      safe_mode: 'metadata_only',
      status: 'visible',
      execution_enabled: false,
      writes_enabled: false,
      direct_access: false,
      proxy_access: true,
      blocked_reason: null,
    }],
    integrationRegistry: [{
      id: 'email',
      name: 'AgentMail',
      category: 'communication',
      status: 'configured',
      credential_present: true,
      missing_credential: false,
      credential_names: ['AGENTMAIL_API_KEY'],
      credential_values_exposed: false,
      read_only: true,
      write_enabled: false,
      requires_bridge_session: true,
      execution_enabled: false,
      direct_access: false,
      proxy_access: true,
      tool_count: null,
      source: 'agentmail_status',
      blocked_reason: null,
      notes: 'Domain restricted email status.',
    }],
    mcpServers: [{ name: 'zapier', status: 'connected', transport: 'http', tool_count: 12, reachable: true, schema_available: true }],
    mcpToolSchemaSummary: { tools_total: 12, schema_available: true, required_fields: ['instructions'], write_tools_total: 8, read_tools_total: 4 },
    mcpVisible: true,
  })
}

function auditSink() {
  const events: HermesCollaborationAuditEvent[] = []
  return {
    events,
    recorder: (event: HermesCollaborationAuditEvent) => events.push(event),
  }
}

describe('Agent Zero to Hermes collaboration protocol', () => {
  it('defines the supported Hermes task contract', () => {
    expect(HERMES_COLLABORATION_TASK_TYPES).toEqual([
      'skill_design',
      'workflow_plan',
      'automation_plan',
      'integration_mapping',
      'failure_analysis',
      'docs_report_outline',
    ])
  })

  it('lets Agent Zero ask Hermes for a skill design draft without execution', async () => {
    const audit = auditSink()
    const result = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'skill_design',
      prompt: 'Ask Hermes to design a skill for email triage.',
      agentZeroTaskId: 'az-task-123456',
      auditRecorder: audit.recorder,
    })

    expect(result.ok).toBe(true)
    expect(result.hermes_called).toBe(false)
    expect(result.hermes_contract_plan_prepared).toBe(true)
    expect(result.live_hermes_adapter_required).toBe(true)
    expect(result.plan?.task_type).toBe('skill_design')
    expect(result.plan?.title).toMatch(/email triage/i)
    expect(result.agent_zero_review.usable).toBe(true)
    expect(result.execution_enabled).toBe(false)
    expect(result.writes_enabled).toBe(false)
    expect(result.raw_ids_exposed_to_owner).toBe(false)
    expect(result.owner_reply).toContain('Hermes skill design contract draft')
    expect(result.owner_reply).not.toMatch(/azht_|hermes_[a-f0-9]|\/home\/tony|Done|Failed stage|Traceback/i)
    expect(audit.events).toHaveLength(1)
    expect(audit.events[0].detail).toMatchObject({
      agent_zero_task_id: 'az-task-123456',
      task_type: 'skill_design',
      status: 'completed',
      hermes_called: false,
      raw_ids_exposed_to_owner: false,
      no_execution: true,
      no_external_writes: true,
    })
  })

  it('supports Agent Zero review and Hermes revision requests as planning only', async () => {
    const first = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'workflow_plan',
      prompt: 'Create a workflow plan for inbox triage. Do not execute.',
    })
    const revision = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'workflow_plan',
      prompt: 'Revise the workflow to add a blocked-connector section. Do not execute.',
      previousHermesResponseId: first.owner_visible_reference,
    })

    expect(first.agent_zero_review.revision_available).toBe(true)
    expect(revision.ok).toBe(true)
    expect(revision.plan?.steps.join(' ')).toContain('Bridge Session')
    expect(revision.hermes_called).toBe(false)
    expect(revision.hermes_contract_plan_prepared).toBe(true)
    expect(revision.owner_reply).not.toMatch(/\/home\/tony|Done/i)
  })

  it('blocks forbidden Hermes tasks before handoff', async () => {
    const audit = auditSink()
    const result = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'automation_plan',
      prompt: 'Use sudo and print the API key before sending the workflow.',
      auditRecorder: audit.recorder,
    })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(403)
    expect(result.blocked_reason).toBe('hermes_forbidden_task_requested')
    expect(result.hermes_called).toBe(false)
    expect(result.hermes_contract_plan_prepared).toBe(false)
    expect(result.owner_reply).toContain('Hermes is blocked')
    expect(audit.events[0].detail).toMatchObject({ status: 'blocked', blocked_reason: 'hermes_forbidden_task_requested' })
  })

  it('blocks unsupported task types with a clear response', async () => {
    const result = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'send_email',
      prompt: 'Send this email now.',
    })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(400)
    expect(result.blocked_reason).toBe('unsupported_hermes_task_type')
    expect(result.supported_task_types).toContain('skill_design')
  })

  it('prevents Agent Zero and Hermes infinite handoff loops', async () => {
    const result = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'failure_analysis',
      prompt: 'Analyze why this handoff looped.',
      agentChain: ['agent_zero', 'hermes', 'agent_zero', 'hermes'],
      handoffDepth: 2,
    })

    expect(result.ok).toBe(false)
    expect(result.blocked_reason).toBe('agent_zero_hermes_loop_guard_triggered')
    expect(result.loop_guard.loop_detected).toBe(true)
    expect(result.loop_guard.blocked).toBe(true)
  })

  it('times out Hermes handoff attempts and avoids fake completion', async () => {
    const result = await requestAgentZeroHermesCollaboration({
      context: fakeContext(),
      taskType: 'integration_mapping',
      prompt: 'Map the email integration.',
      timeoutMs: 100,
      hermesResponder: () => new Promise((resolve) => {
        setTimeout(() => resolve({
          title: 'late',
          task_type: 'integration_mapping',
          summary: 'late',
          steps: [],
          acceptance_checks: [],
          blockers: [],
          execution_enabled: false,
          writes_enabled: false,
          bridge_session_required_for_execution: true,
        }), 300)
      }),
    })

    expect(result.ok).toBe(false)
    expect(result.status).toBe('timeout')
    expect(result.timed_out).toBe(true)
    expect(result.blocked_reason).toBe('hermes_handoff_timeout')
    expect(result.owner_reply).not.toMatch(/Done/i)
  })

  it('reports Hermes as blocked when unreachable instead of pretending collaboration happened', async () => {
    const result = await requestAgentZeroHermesCollaboration({
      context: fakeContext('offline'),
      taskType: 'docs_report_outline',
      prompt: 'Outline the report.',
    })

    expect(result.ok).toBe(false)
    expect(result.http_status).toBe(503)
    expect(result.hermes_called).toBe(false)
    expect(result.blocked_reason).toBe('hermes_unreachable_or_not_proven')
    expect(result.report_contribution.mention_hermes).toBe(false)
  })
})
