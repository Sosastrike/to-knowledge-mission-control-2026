import { describe, expect, it } from 'vitest'

import {
  canMiniAgentReadMemory,
  createMiniAgentDefinition,
  createMiniAgentMemory,
  expireMiniAgentMemory,
  requestMiniAgentMemoryPromotion,
  reviewMiniAgentMemoryPromotion,
  summarizeMiniAgentMemoryForAgentZero,
} from './gateway-mini-agent-contracts'

describe('MiniAgentDefinition and MiniAgentMemory contracts', () => {
  it('creates a supervised read-only MiniAgentDefinition with TTL, output contract, and audit trail', () => {
    const result = createMiniAgentDefinition({
      name: 'Research Scout',
      purpose: 'Summarize Gateway registry context for Agent Zero.',
      parent_supervisor: 'hermes',
      scope: ['read-only discovery', 'return summary to Agent Zero'],
      allowed_tools: ['gateway.queryData'],
      memory_ttl_minutes: 60,
      output_contract: 'Return facts, assumptions, blockers, and next step.',
      kill_condition: 'Expire after task completion or TTL.',
    })

    expect(result.ok).toBe(true)
    expect(result.definition).toMatchObject({
      id: 'mini_agent_research_scout',
      parent_supervisor: 'hermes',
      command_authority: 'agent_zero',
      memory_ttl_minutes: 60,
      lifecycle: 'proposed',
      read_enabled: true,
      write_enabled: false,
      execution_enabled: false,
      external_writes_enabled: false,
      can_self_promote: false,
      can_create_child_agents: false,
      direct_secret_access_allowed: false,
      raw_root_shell_allowed: false,
      docker_socket_allowed: false,
      owner_direct_channel_allowed: false,
    })
    expect(result.definition?.audit_trail).toHaveLength(1)
    expect(result.policy_result).toBe('requires_session')
    expect(result.blocked_reason).toBe('mini_agent_activation_requires_bridge_session_and_registered_runtime_adapter')
  })

  it('blocks reserved identities and unsafe scopes', () => {
    const duplicate = createMiniAgentDefinition({
      name: 'Agent Zero',
      purpose: 'Duplicate commander',
      scope: ['planning'],
    })
    const unsafe = createMiniAgentDefinition({
      name: 'Unsafe Worker',
      purpose: 'Unsafe scope',
      scope: ['use root shell and docker socket'],
    })

    expect(duplicate.ok).toBe(false)
    expect(duplicate.blocked_reason).toBe('mini_agent_id_reserved_existing_authority')
    expect(unsafe.ok).toBe(false)
    expect(unsafe.blocked_reason).toBe('mini_agent_scope_contains_forbidden_access')
  })

  it('creates temporary task-scoped memory and expires it by TTL', () => {
    const result = createMiniAgentMemory({
      mini_agent_id: 'mini_agent_research_scout',
      parent_task: 'task_research',
      parent_supervisor: 'agent_zero',
      source: 'gateway_context',
      facts: ['Gateway registry was checked.'],
      assumptions: ['Connector status may change.'],
      unknowns: ['Live adapter freshness.'],
      blocked_items: ['Drive upload missing connector.'],
      ttl_minutes: 30,
      created_at: '2026-05-05T12:00:00.000Z',
    })

    expect(result.ok).toBe(true)
    expect(result.memory).toMatchObject({
      state: 'temporary',
      ttl_minutes: 30,
      contains_secrets: false,
      parent_supervisor: 'agent_zero',
    })

    const expired = expireMiniAgentMemory(result.memory!, '2026-05-05T12:31:00.000Z')
    expect(expired.state).toBe('expired')
    expect(expired.audit_trail.map((event) => event.event)).toContain('gateway.mini_agent.memory.expired')
  })

  it('requires explicit review for memory promotion and supports rejection', () => {
    const memory = createMiniAgentMemory({
      mini_agent_id: 'mini_agent_reporter',
      parent_task: 'task_report',
      source: 'mini_agent_output',
      facts: ['Report outline is safe.'],
      created_at: '2026-05-05T12:00:00.000Z',
    }).memory!

    const request = requestMiniAgentMemoryPromotion(memory, 'hermes')
    expect(request.ok).toBe(true)
    expect(request.policy_result).toBe('requires_review')
    expect(request.memory?.state).toBe('pending_review')

    const approved = reviewMiniAgentMemoryPromotion(request.memory!, {
      approved: true,
      reviewer: 'agent_zero',
      reason: 'Safe sourced summary.',
      reviewed_at: '2026-05-05T12:05:00.000Z',
    })
    expect(approved.memory).toMatchObject({ state: 'promoted', promoted_to: 'agent_zero_memory_review_queue' })

    const rejectedRequest = requestMiniAgentMemoryPromotion(memory, 'pi')
    const rejected = reviewMiniAgentMemoryPromotion(rejectedRequest.memory!, {
      approved: false,
      reviewer: 'agent_zero',
      reason: 'Too speculative.',
    })
    expect(rejected.memory?.state).toBe('rejected')
    expect(rejected.blocked_reason).toBe('memory_promotion_rejected')
  })

  it('blocks secret storage and isolates memory between mini-agents', () => {
    const secret = createMiniAgentMemory({
      mini_agent_id: 'mini_agent_secret_probe',
      parent_task: 'task_secret',
      source: 'TOKEN=secret-value',
      facts: ['unsafe'],
    })
    const memory = createMiniAgentMemory({
      mini_agent_id: 'mini_agent_source',
      parent_task: 'task_a',
      source: 'gateway_context',
      facts: ['safe'],
    }).memory!
    const denied = canMiniAgentReadMemory({ requester_mini_agent_id: 'mini_agent_other', memory })
    const allowed = canMiniAgentReadMemory({ requester_mini_agent_id: 'mini_agent_source', memory })

    expect(secret.ok).toBe(false)
    expect(secret.blocked_reason).toBe('mini_agent_memory_secret_storage_forbidden')
    expect(denied.ok).toBe(false)
    expect(denied.blocked_reason).toBe('mini_agent_cross_memory_access_not_allowed')
    expect(allowed.ok).toBe(true)
    expect(summarizeMiniAgentMemoryForAgentZero(memory)).toContain('ttl')
  })
})
