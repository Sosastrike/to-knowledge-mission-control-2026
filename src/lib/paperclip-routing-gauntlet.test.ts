import { describe, expect, it, vi } from 'vitest'
import {
  buildPaperclipGatewayTaskPayload,
  buildPaperclipGatewayWorkforceFlowPayload,
  buildPaperclipHermesProposalPayload,
  buildPaperclipPiDispatcherRecommendationPayload,
  buildPaperclipSpaceAgentResearchTaskPayload,
  buildPaperclipStatusPayload,
  buildPaperclipTestTaskPayload,
  buildPaperclipTokenGovernorPlan,
  createPaperclipCoWorkerAgentDefinition,
  validatePaperclipCoWorkerGatewayPolicy,
} from './paperclip-bridge'
import { buildGatewayRegistrySnapshot, getGatewayNodeDetail } from './gateway-registry-api'

const GENERATED_AT = '2026-05-07T00:00:00.000Z'

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function createPaperclipFetchMock() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/api/health')) {
      return jsonResponse({
        status: 'ok',
        version: 'sandbox-gauntlet',
        deploymentMode: 'local_sandbox',
        deploymentExposure: 'loopback',
        authReady: true,
      })
    }
    if (url.endsWith('/api/companies')) {
      return jsonResponse([
        {
          id: 'company-1',
          name: 'To Knowledge Gateway',
          issuePrefix: 'TKG',
          status: 'sandbox',
          budgetMonthlyCents: 50000,
          spentMonthlyCents: 1250,
          requireBoardApprovalForNewAgents: true,
        },
      ])
    }
    if (url.endsWith('/api/companies/company-1/agents')) {
      return jsonResponse({
        agents: [
          {
            id: 'agent_zero',
            name: 'Agent Zero',
            role: 'commander',
            status: 'active',
            metadata: {
              gateway_role: 'commander',
              owner_visible_status: 'active_commander',
              bridge_session_required_for_execution: true,
            },
          },
          {
            id: 'hermes',
            name: 'Hermes',
            role: 'lieutenant_skill_workflow_builder',
            status: 'planning_only',
            reportsTo: 'agent_zero',
          },
          {
            id: 'pi',
            name: 'Pi',
            role: 'dispatcher_candidate',
            status: 'shadow_mode',
            reportsTo: 'gateway',
          },
        ],
      })
    }
    if (url.endsWith('/api/companies/company-1/issues')) {
      return jsonResponse({
        issues: [
          {
            id: 'issue-1',
            identifier: 'TKG-1',
            title: 'Safe read-only workforce proof',
            status: 'todo',
            assigneeAgentId: 'agent_zero',
          },
        ],
      })
    }
    return jsonResponse({ error: 'not found' }, 404)
  })
}

function expectOwnerSafe(payload: unknown) {
  const serialized = JSON.stringify(payload)
  expect(serialized).not.toMatch(/sk-[A-Za-z0-9_-]+/i)
  expect(serialized).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/i)
  expect(serialized).not.toMatch(/auth[_-]?file/i)
  expect(serialized).not.toMatch(/token[_-]?value/i)
  expect(serialized).not.toMatch(/secret[_-]?value/i)
  expect(serialized).not.toMatch(/\/home\//i)
  expect(serialized).not.toMatch(/"execution_enabled":true/)
  expect(serialized).not.toMatch(/"writes_enabled":true/)
  expect(serialized).not.toMatch(/\bDone\b/i)
}

function expectBlockedOrSessionGated(payload: unknown) {
  const serialized = JSON.stringify(payload)
  expect(serialized).toMatch(/read_only|requires_session|blocked|missing_credential|not_configured|not_created|not_running|not_reachable/i)
}

describe('Paperclip final Gateway routing gauntlet', () => {
  it('keeps Paperclip visible as a workforce node without replacing the command hierarchy', () => {
    const registry = buildGatewayRegistrySnapshot()
    const paperclip = getGatewayNodeDetail(registry, 'paperclip')
    const agentZero = getGatewayNodeDetail(registry, 'agent_zero')
    const hermes = getGatewayNodeDetail(registry, 'hermes')
    const pi = getGatewayNodeDetail(registry, 'pi')
    const spaceAgent = getGatewayNodeDetail(registry, 'space_agent')

    expect(paperclip).toBeTruthy()
    expect(paperclip?.node).toMatchObject({
      id: 'paperclip',
      label: 'Paperclip Workforce Control Plane',
      kind: 'workforce_layer',
      status: 'blocked',
    })
    expect(agentZero?.node.label).toContain('Agent Zero')
    expect(hermes?.node.label).toContain('Hermes')
    expect(pi?.node.label).toContain('Pi')
    expect(spaceAgent?.node.label).toContain('Space')
    expect(JSON.stringify(paperclip)).toContain('paperclip_service_not_configured')
    expect(JSON.stringify(paperclip)).toContain('paperclip_is_commander')
    expect(JSON.stringify(paperclip)).toContain('false')
    expectOwnerSafe({ paperclip, agentZero, hermes, pi, spaceAgent })
  })

  it('passes 1,000 deterministic Paperclip routing scenarios without writes, secrets, or fake completion', async () => {
    const fetchImpl = createPaperclipFetchMock()
    const payloads: unknown[] = []
    const scenarioKinds = [
      'status',
      'test_task',
      'agent_zero_task',
      'hermes_proposal',
      'pi_recommendation',
      'space_agent_research',
      'workforce_flow',
      'coworker_definition',
      'coworker_policy_read',
      'coworker_policy_execute_blocked',
      'token_governor',
    ] as const

    for (let index = 0; index < 1000; index += 1) {
      const kind = scenarioKinds[index % scenarioKinds.length]
      const generatedAt = new Date(Date.parse(GENERATED_AT) + index * 1000).toISOString()
      if (kind === 'status') {
        payloads.push(await buildPaperclipStatusPayload({ generatedAt, fetchImpl }))
      } else if (kind === 'test_task') {
        payloads.push(await buildPaperclipTestTaskPayload({ message: 'Can you see Paperclip?', generatedAt, fetchImpl }))
      } else if (kind === 'agent_zero_task') {
        payloads.push(await buildPaperclipGatewayTaskPayload({
          requester: 'agent_zero',
          assignee: index % 2 === 0 ? 'hermes' : 'space_agent',
          title: `Plan safe workforce task ${index}`,
          requestedAction: 'Create planning issue only; do not execute external writes.',
          generatedAt,
          bridgeSessionActive: false,
          fetchImpl,
        }))
      } else if (kind === 'hermes_proposal') {
        payloads.push(await buildPaperclipHermesProposalPayload({
          proposalKind: index % 2 === 0 ? 'skill_proposal_document' : 'paperclip_routine',
          title: `Hermes workforce proposal ${index}`,
          objective: 'Draft a planning-only routine for Agent Zero review.',
          routineSteps: ['Read Gateway registry', 'Return proposal to Agent Zero'],
          miniAgentScope: ['read-only planning', 'no external writes'],
          generatedAt,
          fetchImpl,
        }))
      } else if (kind === 'pi_recommendation') {
        payloads.push(await buildPaperclipPiDispatcherRecommendationPayload({
          ownerRequest: index % 3 === 0
            ? 'Recommend a worker for a web research mission.'
            : 'Recommend a worker for a skill design mission.',
          generatedAt,
          fetchImpl,
        }))
      } else if (kind === 'space_agent_research') {
        payloads.push(await buildPaperclipSpaceAgentResearchTaskPayload({
          requester: 'agent_zero',
          taskType: index % 2 === 0 ? 'web_research' : 'youtube_research',
          request: 'Research a public source and return evidence only.',
          responsibleAgent: 'hermes',
          generatedAt,
          firecrawlConfigured: false,
          bridgeSessionActive: false,
          fetchImpl,
          evidence: [{ summary: 'Public evidence summary', url: 'https://example.com/source' }],
          webSources: [{ url: 'https://example.com/source', title: 'Example Source', type: 'article', method: 'browser', status: 'success' }],
        }))
      } else if (kind === 'workforce_flow') {
        payloads.push(await buildPaperclipGatewayWorkforceFlowPayload({
          ownerRequest: 'Route a read-only workforce task through Paperclip tracking.',
          assignee: 'hermes',
          workerResult: index % 2 === 0 ? 'Planning-only worker result returned to Agent Zero.' : null,
          generatedAt,
          bridgeSessionActive: false,
          fetchImpl,
        }))
      } else if (kind === 'coworker_definition') {
        payloads.push(createPaperclipCoWorkerAgentDefinition({
          id: `scenario-${index}`,
          name: `Scenario Worker ${index}`,
          supervisor: index % 2 === 0 ? 'agent_zero' : 'hermes',
          purpose: 'Dry-run scoped workforce helper for Gateway tests.',
          taskScope: ['read-only registry review', 'return result to Agent Zero'],
          budgetMaxCents: 1000,
          memoryTtlMinutes: 60,
          allowedTools: ['gateway.getSystems', 'gateway.getAgents'],
          forbiddenTools: ['email_send', 'drive_upload'],
          expirationCondition: 'Expire after dry-run scenario.',
          generatedAt,
        }))
      } else if (kind === 'coworker_policy_read' || kind === 'coworker_policy_execute_blocked') {
        const definitionResult = createPaperclipCoWorkerAgentDefinition({
          id: `policy-${index}`,
          name: `Policy Worker ${index}`,
          supervisor: 'agent_zero',
          purpose: 'Validate Paperclip co-worker policy gates.',
          taskScope: ['read-only registry review'],
          budgetMaxCents: 1000,
          memoryTtlMinutes: 60,
          allowedTools: ['gateway.getSystems'],
          forbiddenTools: ['email_send'],
          expirationCondition: 'Expire after policy check.',
          generatedAt,
        })
        expect(definitionResult.definition).toBeTruthy()
        payloads.push(validatePaperclipCoWorkerGatewayPolicy({
          definition: definitionResult.definition!,
          requestedAction: kind === 'coworker_policy_read' ? 'read' : 'execute',
          credentialMode: 'configured_reference',
          bridgeSessionActive: false,
          ownerApproved: false,
          requestedScope: ['read-only registry review'],
          requestedTools: kind === 'coworker_policy_read' ? ['gateway.getSystems'] : ['email_send'],
          memoryTtlMinutes: 30,
          outputContract: 'Return a concise owner-safe summary to Agent Zero.',
          auditRequired: true,
          recordedAt: generatedAt,
        }))
      } else {
        payloads.push(buildPaperclipTokenGovernorPlan({
          generatedAt,
          budgets: [
            { scope: 'company', id: 'company-1', name: 'To Knowledge Gateway', budgetCents: 100000, spentCents: index % 4 === 0 ? 76000 : 10000, projectedCents: 1000 },
            { scope: 'agent', id: 'agent_zero', name: 'Agent Zero', budgetCents: 50000, spentCents: index % 5 === 0 ? 47000 : 5000, projectedCents: 500 },
          ],
        }))
      }
    }

    expect(payloads).toHaveLength(1000)
    for (const payload of payloads) {
      expectOwnerSafe(payload)
      expectBlockedOrSessionGated(payload)
    }

    const serialized = JSON.stringify(payloads)
    expect(serialized).toContain('agent_zero')
    expect(serialized).toContain('hermes')
    expect(serialized).toContain('pi')
    expect(serialized).toContain('space_agent')
    expect(serialized).toContain('paperclip')
    expect(fetchImpl).toHaveBeenCalled()
    console.info('Paperclip routing gauntlet summary:', JSON.stringify({ scenarios: payloads.length, failures: 0 }))
  })
})
