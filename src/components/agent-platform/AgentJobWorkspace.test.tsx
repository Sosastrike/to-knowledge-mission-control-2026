/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentJobWorkspace } from './AgentJobWorkspace'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function jsonResponse(payload: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }))
}

describe('AgentJobWorkspace', () => {
  it('loads through Mission Control relative APIs and never renders internal origins', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.startsWith('/api/agent-platform/agents/agent_zero/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'agent_zero', display_name: 'Agent Zero', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_1', task_id: 'task_1', target_agent_id: 'agent_zero', state: 'QUEUED', current_model: 'openai/gpt-4o' }],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_1')) {
        return jsonResponse({ ok: true, job: { job_id: 'job_1', task_id: 'task_1', target_agent_id: 'agent_zero', state: 'QUEUED' }, events: [], result: null })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="agent_zero" />)

    expect(await screen.findByTestId('agent-job-workspace')).toBeInTheDocument()
    expect(await screen.findByText('job_1')).toBeInTheDocument()
    expect(screen.queryByText(/100\.116\.35\.95|127\.0\.0\.1|localhost|50080/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.every(([input]) => String(input).startsWith('/api/agent-platform/'))).toBe(true)
  })

  it('submits a default queued job and surfaces the durable job id', async () => {
    let listed = false
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url === '/api/agent-platform/agents/agent_zero/jobs' && init?.method === 'POST') {
        return jsonResponse({ accepted: true, job_id: 'job_new', task_id: 'task_new', target_agent_id: 'agent_zero', state: 'QUEUED', input_mode: 'QUEUE' }, 202)
      }
      if (url.startsWith('/api/agent-platform/agents/agent_zero/jobs')) {
        listed = true
        return jsonResponse({
          agents: [{ agent_id: 'agent_zero', display_name: 'Agent Zero', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_new', task_id: 'task_new', target_agent_id: 'agent_zero', state: 'QUEUED' }],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_new')) {
        return jsonResponse({ ok: true, job: { job_id: 'job_new', task_id: 'task_new', target_agent_id: 'agent_zero', state: 'QUEUED' }, events: [], result: null })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="agent_zero" />)
    const button = await screen.findByTestId('agent-job-submit')
    fireEvent.click(button)

    await waitFor(() => expect(screen.getByTestId('last-submit-job')).toHaveTextContent('job_new'))
    expect(listed).toBe(true)
  })

  it('restores a selected durable job after direct navigation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.startsWith('/api/agent-platform/agents/agent_zero/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'agent_zero', display_name: 'Agent Zero', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_direct', task_id: 'task_direct', target_agent_id: 'agent_zero', state: 'RUNNING', current_model: 'openai/gpt-4o' }],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_direct')) {
        return jsonResponse({ ok: true, job: { job_id: 'job_direct', task_id: 'task_direct', target_agent_id: 'agent_zero', state: 'RUNNING' }, events: [], result: null })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="agent_zero" initialJobId="job_direct" />)

    expect(await screen.findByText('job_direct')).toBeInTheDocument()
    expect(await screen.findByText('task_id: task_direct')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([input]) => String(input).startsWith('/api/agent-platform/jobs/job_direct'))).toBe(true)
  })
})
