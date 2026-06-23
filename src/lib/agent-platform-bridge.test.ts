import { describe, expect, it } from 'vitest'
import {
  buildAgentPlatformSubmissionBody,
  buildMissionControlActorContext,
  normalizeAgentPlatformAgentId,
  normalizeAgentPlatformDiagnostics,
  sanitizeAgentPlatformPayload,
} from './agent-platform-bridge'
import type { User } from './auth'

const user: User = {
  id: 42,
  username: 'luis',
  display_name: 'Luis',
  role: 'operator',
  workspace_id: 1,
  tenant_id: 1,
  created_at: 1,
  updated_at: 1,
  last_login_at: 1,
}

describe('agent platform bridge', () => {
  it('redacts secrets, internal origins, and raw host paths from diagnostics', () => {
    const sanitized = sanitizeAgentPlatformPayload({
      url: 'http://100.116.35.95:50080/api/durable_jobs',
      local: 'http://127.0.0.1:50080/',
      path: '/home/tony/agent-zero-deploy/data/.env',
      token: 'SYNTHETIC_FAKE_TOKEN',
    })

    const text = JSON.stringify(sanitized)
    expect(text).not.toContain('100.116.35.95')
    expect(text).not.toContain('127.0.0.1')
    expect(text).not.toContain('/home/tony')
    expect(text).not.toContain('SYNTHETIC_FAKE_TOKEN')
    expect(text).toContain('[internal-origin]')
  })

  it('rejects test agents and normalizes hyphenated Agent Zero IDs', () => {
    expect(normalizeAgentPlatformAgentId('agent-zero')).toBe('agent_zero')
    expect(normalizeAgentPlatformAgentId('test_agent_alpha')).toBeNull()
    expect(normalizeAgentPlatformAgentId('../agent_zero')).toBeNull()
  })

  it('builds actor context from immutable ids instead of display names', () => {
    const context = buildMissionControlActorContext({ user, targetAgentId: 'agent_zero' })
    expect(context.requesting_actor_id).toBe('usr_42')
    expect(context.effective_permissions).toEqual(['agent:diagnostics', 'agent:message'])
    expect(JSON.stringify(context)).not.toContain('Luis')
    expect(JSON.stringify(context)).not.toContain('Tony')
  })

  it('builds default QUEUE submission payload without synchronous execution fields', () => {
    const body = buildAgentPlatformSubmissionBody({ user, targetAgentId: 'agent_zero', message: '  hello  ' })
    expect(body.input_mode).toBe('QUEUE')
    expect(body.message).toBe('hello')
    expect(body.target_agent_id).toBe('agent_zero')
    expect(body).not.toHaveProperty('sync_compat')
    expect(body).not.toHaveProperty('execution_mode')
  })

  it('normalizes diagnostics into production agents and safe Mission Control URLs', () => {
    const diagnostics = normalizeAgentPlatformDiagnostics({
      schema_version: 'agent_platform_execution.v1',
      platform_schema_version: 'agent_platform_durable_jobs.v2',
      migration_id: 'batch4_1c_agent_platform_ownership',
      controls: { durable_message_submission_enabled: true, durable_worker_enabled: true },
      registered_agents: ['agent_zero', 'test_agent_alpha'],
      jobs_total: 1,
      jobs: [{
        platform_job_id: 'pjob_1',
        job_id: 'job_1',
        task_id: 'task_1',
        target_agent_id: 'agent_zero',
        runtime_adapter: 'agent_zero',
        state: 'QUEUED',
        current_model: 'openai/gpt-4o',
      }],
    })

    expect(diagnostics.registered_agents).toEqual(['agent_zero'])
    expect(diagnostics.agents[0]?.owner_route).toBe('/gateway/agent-hub/agent-zero/chat')
    expect(diagnostics.jobs[0]?.status_url).toBe('/api/agent-platform/jobs/job_1')
    expect(JSON.stringify(diagnostics)).not.toContain('test_agent_alpha')
  })

  it('normalizes Hermes as a production agent while keeping Ron WebUI as a control surface', () => {
    const diagnostics = normalizeAgentPlatformDiagnostics({
      platform_schema_version: 'agent_platform_durable_jobs.v2',
      controls: {
        durable_message_submission_enabled: true,
        durable_worker_enabled: true,
        hermes_durable_submission_enabled: true,
        hermes_shared_worker_enabled: true,
      },
      registered_agents: ['agent_zero', 'hermes', 'ron', 'hermes-webui', 'test_agent_beta'],
      registered_agent_details: {
        hermes: {
          display_name: 'Hermes',
          runtime_adapter: 'hermes',
          control_surfaces: [{ component_type: 'control_surface', target_agent_id: 'hermes', durable_job_owner: false }],
        },
      },
    })

    expect(diagnostics.registered_agents).toEqual(['agent_zero', 'hermes'])
    expect(diagnostics.agents.find((agent) => agent.agent_id === 'hermes')).toMatchObject({
      display_name: 'Hermes',
      runtime_adapter: 'hermes',
      owner_route: '/gateway/agents/hermes/jobs',
      durable_submission_enabled: true,
      durable_worker_enabled: true,
      test_fixture: false,
    })
    expect(diagnostics.agents.some((agent) => agent.agent_id === 'ron' || agent.agent_id === 'hermes_webui')).toBe(false)
    expect(JSON.stringify(diagnostics)).not.toContain('test_agent_beta')
  })

})
