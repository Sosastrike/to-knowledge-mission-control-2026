'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Job = {
  platform_job_id?: string | null
  job_id: string
  task_id: string
  target_agent_id: string
  state: string
  queue_reason?: string | null
  worker_id?: string | null
  last_heartbeat_at?: number | null
  lease_expires_at?: number | null
  checkpoint_id?: string | null
  current_model?: string | null
  previous_models?: string[]
  cancellation_requested?: boolean
  error_code?: string | null
  correlation_id?: string | null
}

type Agent = {
  agent_id: string
  display_name: string
  durable_submission_enabled: boolean
  durable_worker_enabled: boolean
}

type EventRow = {
  event_id?: string | null
  type: string
  previous_state?: string | null
  new_state?: string | null
  reason?: string | null
  created_at?: number | null
}

type JobsPayload = {
  ok?: boolean
  agents?: Agent[]
  jobs?: Job[]
  events?: EventRow[]
  results?: Record<string, unknown>
  active_workers?: number
  worker_slots_configured?: number
  controls?: Record<string, unknown>
  store_health?: Record<string, unknown>
  upstream_error?: unknown
}

type JobDetailPayload = {
  ok?: boolean
  job?: Job
  events?: EventRow[]
  result?: unknown
  error?: string
}

const ACTIVE_STATES = new Set(['QUEUED', 'CLAIMED', 'RUNNING', 'WAITING_FOR_MODEL', 'WAITING_FOR_TOOL', 'WAITING_FOR_APPROVAL', 'CHECKPOINTING', 'PAUSED', 'RECOVERING', 'CANCEL_REQUESTED'])

function resultText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.result === 'string') return record.result
    if (typeof record.error === 'string') return record.error
    return JSON.stringify(record, null, 2)
  }
  return String(value)
}

function containsInternalOrigin(value: string): boolean {
  return /100\.116\.35\.95|127\.0\.0\.1|localhost|:50080/.test(value)
}

function defaultMessageForAgent(agentId: string): string {
  if (agentId === 'hermes') return 'Reply exactly: HERMES_UI_OK'
  return 'Reply exactly: AGENT_ZERO_UI_OK'
}

export function AgentJobWorkspace({ agentId = 'agent_zero', initialJobId = null }: { agentId?: string; initialJobId?: string | null }) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => initialJobId)
  const [detail, setDetail] = useState<JobDetailPayload | null>(null)
  const [message, setMessage] = useState(() => defaultMessageForAgent(agentId))
  const [followUp, setFollowUp] = useState('')
  const [steer, setSteer] = useState('')
  const [cancelReason, setCancelReason] = useState('Owner requested cancellation from Mission Control.')
  const [phase, setPhase] = useState<'idle' | 'loading' | 'submitting' | 'ready' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSubmit, setLastSubmit] = useState<Record<string, unknown> | null>(null)
  const submitInFlight = useRef(false)

  const activeJobCount = useMemo(() => jobs.filter((job) => ACTIVE_STATES.has(job.state)).length, [jobs])
  const selectedJob = useMemo(() => jobs.find((job) => job.job_id === selectedJobId) || detail?.job || null, [jobs, selectedJobId, detail])
  const selectedResultText = resultText(detail?.result)
  const payloadText = JSON.stringify({ agents, jobs, detail })
  const unsafeInternalValueVisible = containsInternalOrigin(payloadText)

  const loadJobs = useCallback(async () => {
    setPhase((current) => current === 'idle' ? 'loading' : current)
    try {
      const response = await fetch(`/api/agent-platform/agents/${encodeURIComponent(agentId)}/jobs?include_events=true&include_results=true`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({})) as JobsPayload
      if (!response.ok) throw new Error(typeof payload.upstream_error === 'string' ? payload.upstream_error : `agent_platform_jobs_http_${response.status}`)
      setAgents(payload.agents || [])
      setJobs(payload.jobs || [])
      setEvents(payload.events || [])
      setSelectedJobId((current) => current || initialJobId || payload.jobs?.[0]?.job_id || null)
      setPhase('ready')
      setError(null)
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'agent_platform_jobs_failed')
    }
  }, [agentId, initialJobId])

  const loadDetail = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/agent-platform/jobs/${encodeURIComponent(jobId)}?agent_id=${encodeURIComponent(agentId)}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({})) as JobDetailPayload
      if (response.ok) setDetail(payload)
    } catch {
      // keep the list visible if a detail poll fails
    }
  }, [agentId])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    if (initialJobId) setSelectedJobId(initialJobId)
  }, [initialJobId])

  useEffect(() => {
    if (!selectedJobId) return
    void loadDetail(selectedJobId)
  }, [selectedJobId, loadDetail])

  useEffect(() => {
    const interval = setInterval(() => {
      void loadJobs()
      if (selectedJobId) void loadDetail(selectedJobId)
    }, activeJobCount > 0 ? 2500 : 8000)
    return () => clearInterval(interval)
  }, [activeJobCount, loadJobs, loadDetail, selectedJobId])

  async function postJson(url: string, body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : `agent_platform_http_${response.status}`)
    return payload
  }

  async function submitNewJob() {
    const trimmed = message.trim()
    if (!trimmed || submitInFlight.current) return
    submitInFlight.current = true
    setPhase('submitting')
    setError(null)
    try {
      const payload = await postJson(`/api/agent-platform/agents/${encodeURIComponent(agentId)}/jobs`, { message: trimmed })
      setLastSubmit(payload)
      if (typeof payload.job_id === 'string') setSelectedJobId(payload.job_id)
      await loadJobs()
      setPhase('ready')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'agent_platform_submit_failed')
    } finally {
      submitInFlight.current = false
    }
  }

  async function submitJobMessage(kind: 'messages' | 'steer' | 'cancel') {
    const jobId = selectedJob?.job_id
    if (!jobId) return
    const text = kind === 'messages' ? followUp.trim() : kind === 'steer' ? steer.trim() : cancelReason.trim()
    if (!text) return
    setPhase('submitting')
    setError(null)
    try {
      const payload = await postJson(`/api/agent-platform/jobs/${encodeURIComponent(jobId)}/${kind}?agent_id=${encodeURIComponent(agentId)}`, {
        message: text,
        reason: text,
        target_agent_id: agentId,
      })
      setLastSubmit(payload)
      if (kind === 'messages') setFollowUp('')
      if (kind === 'steer') setSteer('')
      await loadJobs()
      await loadDetail(jobId)
      setPhase('ready')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : `agent_platform_${kind}_failed`)
    }
  }

  return (
    <section className="control-status" data-testid="agent-job-workspace">
      <div className="status-head">
        <strong>Agent Platform Jobs</strong>
        <span>{activeJobCount} active · {jobs.length} visible</span>
      </div>

      <div className="control-grid" style={{ gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, .85fr)', marginBottom: 12 }}>
        <article className="control-card" data-testid="agent-job-submit-panel">
          <strong>New Agent Job</strong>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            aria-label="Agent job message"
            rows={4}
            style={{ minHeight: 96, borderRadius: 6, border: '1px solid rgba(255,255,255,.14)', background: '#0d131c', color: '#e5edf8', padding: 10, resize: 'vertical' }}
          />
          <button type="button" className="control-action" onClick={() => void submitNewJob()} disabled={phase === 'submitting'} data-testid="agent-job-submit">
            {phase === 'submitting' ? 'Submitting...' : 'Queue Job'}
          </button>
          {Boolean(lastSubmit?.job_id) && <small data-testid="last-submit-job">job_id: {String(lastSubmit?.job_id)}</small>}
          {Boolean(lastSubmit?.task_id) && <small data-testid="last-submit-task">task_id: {String(lastSubmit?.task_id)}</small>}
        </article>

        <article className="control-card">
          <strong>Runtime State</strong>
          <span>agent: {agents.find((agent) => agent.agent_id === agentId)?.display_name || agentId}</span>
          <small>durable submission: {String(agents.find((agent) => agent.agent_id === agentId)?.durable_submission_enabled ?? false)}</small>
          <small>durable worker: {String(agents.find((agent) => agent.agent_id === agentId)?.durable_worker_enabled ?? false)}</small>
          <small>internal origins exposed: {unsafeInternalValueVisible ? 'blocked' : 'no'}</small>
        </article>
      </div>

      {error && <div className="control-status warning" data-testid="agent-job-error">{error}</div>}

      <div className="control-grid" style={{ gridTemplateColumns: 'minmax(280px, .8fr) minmax(0, 1.2fr)', marginBottom: 12 }}>
        <article className="control-card" data-testid="agent-job-list" style={{ alignContent: 'start' }}>
          <strong>Jobs</strong>
          {jobs.length === 0 ? <span>No durable jobs are visible for this agent.</span> : jobs.map((job) => (
            <button
              key={job.job_id}
              type="button"
              className="control-action"
              onClick={() => setSelectedJobId(job.job_id)}
              data-testid={`agent-job-row-${job.job_id}`}
              style={{ justifyContent: 'space-between', background: selectedJobId === job.job_id ? '#17342e' : '#102520' }}
            >
              <span>{job.job_id}</span>
              <span>{job.state}</span>
            </button>
          ))}
        </article>

        <article className="control-card" data-testid="agent-job-detail" style={{ alignContent: 'start' }}>
          <strong>{selectedJob ? `Job ${selectedJob.job_id}` : 'Job detail'}</strong>
          {selectedJob ? (
            <>
              <span>task_id: {selectedJob.task_id}</span>
              <small>state: {selectedJob.state}</small>
              <small>checkpoint: {selectedJob.checkpoint_id || 'none'}</small>
              <small>model: {selectedJob.current_model || 'not reported'}</small>
              <small>queue: {selectedJob.queue_reason || 'none'}</small>
              <small>correlation: {selectedJob.correlation_id || 'not reported'}</small>
              {selectedResultText && <pre data-testid="agent-job-result" style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#dbeafe', fontSize: 12 }}>{selectedResultText}</pre>}
            </>
          ) : <span>Select a job after submitting or polling.</span>}
        </article>
      </div>

      {selectedJob && (
        <div className="control-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: 12 }}>
          <article className="control-card">
            <strong>Queue</strong>
            <textarea value={followUp} onChange={(event) => setFollowUp(event.target.value)} aria-label="Queued message" rows={3} style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,.14)', background: '#0d131c', color: '#e5edf8', padding: 10 }} />
            <button type="button" className="control-action" onClick={() => void submitJobMessage('messages')} disabled={!followUp.trim()}>Queue Message</button>
          </article>
          <article className="control-card">
            <strong>Steer</strong>
            <textarea value={steer} onChange={(event) => setSteer(event.target.value)} aria-label="Steer instruction" rows={3} style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,.14)', background: '#0d131c', color: '#e5edf8', padding: 10 }} />
            <button type="button" className="control-action" onClick={() => void submitJobMessage('steer')} disabled={!steer.trim()}>Send Steer</button>
          </article>
          <article className="control-card">
            <strong>Cancel</strong>
            <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} aria-label="Cancel reason" rows={3} style={{ borderRadius: 6, border: '1px solid rgba(255,255,255,.14)', background: '#0d131c', color: '#e5edf8', padding: 10 }} />
            <button type="button" className="control-action" onClick={() => void submitJobMessage('cancel')} disabled={!cancelReason.trim()}>Request Cancel</button>
          </article>
        </div>
      )}

      <article className="control-card" data-testid="agent-job-events" style={{ minHeight: 80 }}>
        <strong>Events</strong>
        {events.length === 0 ? <span>No durable events reported yet.</span> : events.slice(0, 12).map((event, index) => (
          <small key={event.event_id || `${event.type}-${index}`}>{event.type}: {event.previous_state || 'none'} → {event.new_state || 'none'} {event.reason ? `· ${event.reason}` : ''}</small>
        ))}
      </article>
    </section>
  )
}
