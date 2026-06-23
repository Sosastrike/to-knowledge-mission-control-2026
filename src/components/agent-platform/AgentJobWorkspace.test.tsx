/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
    const postBodies: Record<string, unknown>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.includes('/api/chat/start') || url.includes('/api/chat/stream')) legacyCalls.push(url)
      if (url === '/api/agent-platform/agents/hermes/jobs' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body || '{}'))
        postBodies.push(body)
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
    expect(postBodies[0]?.idempotency_key).toMatch(/^mc_hermes_submission_[a-f0-9]{24}$/)
  })

  it('keeps accepted Hermes metadata visible when the diagnostics list has not caught up yet', async () => {
    const detailCalls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url === '/api/agent-platform/agents/hermes/jobs' && init?.method === 'POST') {
        return jsonResponse({
          accepted: true,
          platform_job_id: 'pjob_first_visible',
          job_id: 'job_first_visible',
          task_id: 'task_first_visible',
          target_agent_id: 'hermes',
          runtime_adapter: 'hermes',
          state: 'QUEUED',
          input_mode: 'QUEUE',
          status_url: '/api/agents/hermes/jobs/job_first_visible',
          correlation_id: 'corr_first_visible',
        }, 202)
      }
      if (url.startsWith('/api/agent-platform/agents/hermes/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'hermes', display_name: 'Hermes', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_first_visible')) {
        detailCalls.push(url)
        return jsonResponse({
          ok: true,
          job: {
            platform_job_id: 'pjob_first_visible',
            job_id: 'job_first_visible',
            task_id: 'task_first_visible',
            target_agent_id: 'hermes',
            runtime_adapter: 'hermes',
            state: 'QUEUED',
            correlation_id: 'corr_first_visible',
          },
          events: [],
          result: null,
        })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="hermes" />)
    fireEvent.change(await screen.findByLabelText('Agent job message'), { target: { value: 'Reply exactly: ZXQ7_CANARY|8F3C-42' } })
    fireEvent.click(await screen.findByTestId('agent-job-submit'))

    await waitFor(() => expect(screen.getByTestId('last-submit-platform-job')).toHaveTextContent('pjob_first_visible'))
    expect(screen.getByTestId('last-submit-job')).toHaveTextContent('job_first_visible')
    expect(screen.getByTestId('last-submit-task')).toHaveTextContent('task_first_visible')
    expect(within(screen.getByTestId('agent-job-detail')).getByText('task_id: task_first_visible')).toBeInTheDocument()
    expect(detailCalls).toEqual(expect.arrayContaining([expect.stringMatching(/^\/api\/agent-platform\/jobs\/job_first_visible\?agent_id=hermes/)]))
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

  it('renders safe exact-response canary results without local person-name replacement', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input)
      if (url.startsWith('/api/agent-platform/agents/hermes/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'hermes', display_name: 'Hermes', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_exact', task_id: 'task_exact', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'SUCCEEDED' }],
          events: [],
          results: { job_exact: { result: 'ZXQ7_CANARY|8F3C-42' } },
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_exact')) {
        return jsonResponse({
          ok: true,
          job: { job_id: 'job_exact', task_id: 'task_exact', target_agent_id: 'hermes', runtime_adapter: 'hermes', state: 'SUCCEEDED' },
          events: [],
          result: { result: 'ZXQ7_CANARY|8F3C-42' },
        })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="hermes" initialJobId="job_exact" />)

    expect(await screen.findByTestId('agent-job-result')).toHaveTextContent('ZXQ7_CANARY|8F3C-42')
    expect(screen.getByTestId('agent-job-result')).not.toHaveTextContent('[PERSON_NAME]')
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


  it('shows canonical model routes and posts selection without changing the agent', async () => {
    const modelRoutePosts: Record<string, unknown>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input)
      if (url.startsWith('/api/agent-platform/agents/hermes/model-routes')) {
        return jsonResponse({
          ok: true,
          catalog_version: 'model_route_catalog.v1',
          target_agent_id: 'hermes',
          routes: [
            { route_id: 'google_direct/gemini-2.5-pro', provider_id: 'google_direct', provider_display_name: 'Google Direct', provider_model_id: 'gemini-2.5-pro', model_display_name: 'Gemini 2.5 Pro', access_path: 'direct', deployment_type: 'cloud', data_destination: 'cloud:google', capabilities: ['text', 'tools'], context_limit: 100, output_limit: 10, streaming_support: true, tool_support: true, structured_output_support: true, image_support: false, reasoning_support: true, cost_class: 'standard', latency_class: 'interactive', health_state: 'healthy', circuit_state: 'closed', enabled: true, available: true, selectable_scopes: ['THIS_JOB'], fallback_support: ['STRICT', 'ASK_BEFORE_FALLBACK'] },
            { route_id: 'openrouter/openai/gpt-4o', provider_id: 'openrouter', provider_display_name: 'OpenRouter', provider_model_id: 'openai/gpt-4o', model_display_name: 'GPT-4o via OpenRouter', access_path: 'aggregator', deployment_type: 'cloud', data_destination: 'cloud:openrouter', capabilities: ['text'], context_limit: 100, output_limit: 10, streaming_support: true, tool_support: false, structured_output_support: false, image_support: false, reasoning_support: true, cost_class: 'standard', latency_class: 'interactive', health_state: 'healthy', circuit_state: 'closed', enabled: true, available: true, selectable_scopes: ['THIS_JOB'], fallback_support: ['STRICT'] },
            { route_id: 'local_vllm/qwen3', provider_id: 'local_vllm', provider_display_name: 'Local vLLM', provider_model_id: 'qwen3', model_display_name: 'Qwen3', access_path: 'local', deployment_type: 'local', data_destination: 'local:self-hosted', capabilities: ['text'], context_limit: 100, output_limit: 10, streaming_support: true, tool_support: false, structured_output_support: false, image_support: false, reasoning_support: true, cost_class: 'fixed', latency_class: 'local', health_state: 'healthy', circuit_state: 'closed', enabled: true, available: true, selectable_scopes: ['THIS_JOB'], fallback_support: ['STRICT'] },
            { route_id: 'google_direct/gemini-disabled', provider_id: 'google_direct', provider_display_name: 'Google Direct', provider_model_id: 'gemini-disabled', model_display_name: 'Gemini disabled', access_path: 'direct', deployment_type: 'cloud', data_destination: 'cloud:google', capabilities: [], context_limit: 0, output_limit: 0, streaming_support: false, tool_support: false, structured_output_support: false, image_support: false, reasoning_support: false, cost_class: 'unknown', latency_class: 'unknown', health_state: 'disabled', circuit_state: 'closed', enabled: false, available: false, disabled_reason: 'credential unavailable', selectable_scopes: [], fallback_support: ['STRICT'] },
          ],
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_route/model-route') && init?.method === 'POST') {
        modelRoutePosts.push(JSON.parse(String(init.body || '{}')))
        return jsonResponse({ ok: true, job_id: 'job_route', task_id: 'task_route', target_agent_id: 'hermes', requested_route_id: 'local_vllm/qwen3', requested_provider_id: 'local_vllm', requested_model_id: 'qwen3', selection_scope: 'THIS_JOB', fallback_policy: 'STRICT', route_state: 'AWAITING_BACKEND_SELECTION' }, 202)
      }
      if (url.startsWith('/api/agent-platform/agents/hermes/jobs')) {
        return jsonResponse({
          agents: [{ agent_id: 'hermes', display_name: 'Hermes', durable_submission_enabled: true, durable_worker_enabled: true }],
          jobs: [{ job_id: 'job_route', task_id: 'task_route', target_agent_id: 'hermes', state: 'RUNNING', requested_route_id: 'google_direct/gemini-2.5-pro', requested_provider_id: 'google_direct', requested_model_id: 'gemini-2.5-pro', effective_route_id: null, effective_provider_id: null, effective_model_id: null, route_state: 'AWAITING_BACKEND_SELECTION', fallback_policy: 'STRICT' }],
          events: [],
          results: {},
        })
      }
      if (url.startsWith('/api/agent-platform/jobs/job_route')) {
        return jsonResponse({ ok: true, job: { job_id: 'job_route', task_id: 'task_route', target_agent_id: 'hermes', state: 'RUNNING', requested_route_id: 'google_direct/gemini-2.5-pro', requested_provider_id: 'google_direct', requested_model_id: 'gemini-2.5-pro', effective_route_id: null, route_state: 'AWAITING_BACKEND_SELECTION', fallback_policy: 'STRICT' }, events: [], result: null })
      }
      return jsonResponse({ error: 'unexpected_url', url }, 500)
    })

    render(<AgentJobWorkspace agentId="hermes" initialJobId="job_route" />)

    expect(await screen.findByText('Google Gemini Direct')).toBeInTheDocument()
    expect(await screen.findByText('OpenRouter')).toBeInTheDocument()
    expect(await screen.findByText('Local / Self-hosted')).toBeInTheDocument()
    expect(screen.getByText(/Unavailable: credential unavailable/)).toBeInTheDocument()
    expect(screen.getByTestId('model-route-requested-actual')).toHaveTextContent('Awaiting backend route selection')
    fireEvent.click(screen.getByRole('radio', { name: /Local vLLM \/ qwen3/ }))
    fireEvent.click(screen.getByTestId('model-route-apply'))

    await waitFor(() => expect(modelRoutePosts).toHaveLength(1))
    expect(modelRoutePosts[0]).toMatchObject({
      requested_route_id: 'local_vllm/qwen3',
      selection_scope: 'THIS_JOB',
      fallback_policy: 'STRICT',
      provider_lock: 'local_vllm',
      deployment_lock: 'local',
    })
    expect(await screen.findByText(/agent: Hermes/)).toBeInTheDocument()
    expect(JSON.stringify(modelRoutePosts[0])).not.toContain('agent_zero')
  })

})
