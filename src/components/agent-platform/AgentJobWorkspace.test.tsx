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

  it('submits Hermes jobs through the shared platform without invoking legacy Ron endpoints', async () => {
    const legacyCalls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/api/chat/start') || url.includes('/api/chat/stream')) legacyCalls.push(url)
      if (url === '/api/agent-platform/agents/hermes/jobs' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body || '{}'))
        expect(body.message).toContain('HERMES_UI_OK')
        return jsonResponse({ accepted: true, job_id: 'job_hermes', task_id: 'task_hermes', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'QUEUED', input_mode: 'QUEUE' }, 202)
      }
      if (url.startsWith('/api/agent-platform/agents/hermes/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'hermes', display_name: 'Hermes', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_hermes', task_id: 'task_hermes', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'QUEUED', queue_reason: 'waiting_for_worker_slot' }],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_hermes')) {
        return jsonResponse({ ok: true, job: { job_id: 'job_hermes', task_id: 'task_hermes', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'QUEUED' }, events: [], result: null })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="hermes" />)
    expect(await screen.findByDisplayValue(/HERMES_UI_OK/)).toBeInTheDocument()
    fireEvent.click(await screen.findByTestId('agent-job-submit'))

    await waitFor(() => expect(screen.getByTestId('last-submit-job')).toHaveTextContent('job_hermes'))
    expect(legacyCalls).toEqual([])
    expect(screen.getByTestId('last-submit-task')).toHaveTextContent('task_hermes')
  })

  it('prevents double-click duplicate Hermes submissions while one accepted request is pending', async () => {
    let postCount = 0
    let releasePost!: () => void
    const pendingPost = new Promise<Response>((resolve) => {
      releasePost = () => resolve(new Response(JSON.stringify({ accepted: true, job_id: 'job_once', task_id: 'task_once', target_agent_id: 'hermes', state: 'QUEUED' }), { status: 202, headers: { 'Content-Type': 'application/json' } }))
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url === '/api/agent-platform/agents/hermes/jobs' && init?.method === 'POST') {
        postCount += 1
        return pendingPost
      }
      if (url.startsWith('/api/agent-platform/agents/hermes/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'hermes', display_name: 'Hermes', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [],
          events: [],
          results: {},
        })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="hermes" />)
    const button = await screen.findByTestId('agent-job-submit')
    fireEvent.click(button)
    fireEvent.click(button)
    expect(postCount).toBe(1)
    releasePost()
    await waitFor(() => expect(screen.getByTestId('last-submit-job')).toHaveTextContent('job_once'))
  })

  it('persists Hermes follow-up input as default QUEUE without cancelling the active job', async () => {
    const postBodies: Record<string, unknown>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.startsWith('/api/agent-platform/jobs/job_active/messages') && init?.method === 'POST') {
        postBodies.push(JSON.parse(String(init.body || '{}')))
        return jsonResponse({ accepted: true, job_id: 'job_active', task_id: 'task_active', target_agent_id: 'hermes', input_mode: 'QUEUE', state: 'RUNNING' }, 202)
      }
      if (url.includes('/cancel')) return jsonResponse({ error: 'cancel_should_not_be_called' }, 500)
      if (url.startsWith('/api/agent-platform/agents/hermes/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'hermes', display_name: 'Hermes', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_active', task_id: 'task_active', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'WAITING_FOR_MODEL' }],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_active')) {
        return jsonResponse({ ok: true, job: { job_id: 'job_active', task_id: 'task_active', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'WAITING_FOR_MODEL' }, events: [], result: null })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="hermes" initialJobId="job_active" />)
    await screen.findByText('job_active')
    fireEvent.change(screen.getByLabelText('Queued message'), { target: { value: 'Reply exactly: HERMES_QUEUED_AFTER_A_OK' } })
    fireEvent.click(screen.getByRole('button', { name: /queue message/i }))

    await waitFor(() => expect(postBodies).toHaveLength(1))
    expect(postBodies[0]).toMatchObject({
      message: 'Reply exactly: HERMES_QUEUED_AFTER_A_OK',
      target_agent_id: 'hermes',
    })
  })

})
