'use client'

import { useState } from 'react'

type ActionState = {
  label: string
  status: 'idle' | 'running' | 'done' | 'error'
  message: string
  payload?: Record<string, unknown>
}

const initialState: ActionState = {
  label: 'No action run',
  status: 'idle',
  message: 'Connection tests and sync preview results appear here without leaving AgentMail Local Control.',
}

function summarizePayload(payload: Record<string, unknown>) {
  const status = typeof payload.status === 'string' ? payload.status : null
  const blocker = typeof payload.exact_blocker === 'string'
    ? payload.exact_blocker
    : typeof payload.current_blocker === 'string'
      ? payload.current_blocker
      : null
  const preview = payload.preview && typeof payload.preview === 'object' ? payload.preview as Record<string, unknown> : payload
  const missing = Array.isArray(preview.missing_inboxes) ? preview.missing_inboxes.length : null
  const proposed = Array.isArray(preview.proposed_inbox_assignments) ? preview.proposed_inbox_assignments.length : null
  const liveAgentMail = preview.live_agentmail && typeof preview.live_agentmail === 'object'
    ? preview.live_agentmail as Record<string, unknown>
    : payload.live_agentmail && typeof payload.live_agentmail === 'object'
      ? payload.live_agentmail as Record<string, unknown>
      : null
  const liveInboxes = typeof liveAgentMail?.inbox_count === 'number' ? liveAgentMail.inbox_count : null
  return [
    status ? `status=${status}` : null,
    blocker ? `blocker=${blocker}` : null,
    liveInboxes !== null ? `live_inboxes=${liveInboxes}` : null,
    missing !== null ? `missing_inboxes=${missing}` : null,
    proposed !== null ? `proposed_assignments=${proposed}` : null,
  ].filter(Boolean).join(' · ') || 'No status summary returned.'
}

export function AgentMailConnectActions({ consoleUrl }: { consoleUrl: string }) {
  const [state, setState] = useState<ActionState>(initialState)

  async function runAction(label: string, path: string) {
    setState({ label, status: 'running', message: 'Running protected Mission Control check...' })
    try {
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>
      if (!response.ok) {
        setState({
          label,
          status: 'error',
          message: response.status === 401
            ? 'Mission Control auth is required. Return to login, then reopen AgentMail Local Control.'
            : `Request failed with HTTP ${response.status}.`,
          payload,
        })
        return
      }
      setState({ label, status: 'done', message: summarizePayload(payload), payload })
    } catch (error) {
      setState({
        label,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown AgentMail action error.',
      })
    }
  }

  function openConsole() {
    setState({
      label: 'Connect AgentMail',
      status: 'done',
      message: 'Opened hosted AgentMail console. Mission Control does not collect Google credentials or browser cookies.',
    })
    window.open(consoleUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <div className="am-actions">
        <button className="am-button am-button-primary" type="button" onClick={openConsole}>Connect AgentMail</button>
        <a className="am-button" href={consoleUrl} target="_blank" rel="noreferrer">Open AgentMail Console</a>
        <button className="am-button" type="button" onClick={() => runAction('Test connection', '/api/agentmail/connect/test')}>Test connection</button>
        <button className="am-button" type="button" onClick={() => runAction('Sync inbox registry', '/api/agentmail/connect/provision-preview')}>Sync inbox registry</button>
        <button className="am-button" type="button" onClick={() => runAction('Request inbox provisioning approval', '/api/agentmail/connect/provision-request')}>Request inbox provisioning approval</button>
        <button className="am-button" type="button" onClick={() => runAction('Request Bridge Session', '/api/agentmail/bridge-session/request')}>Request Bridge Session</button>
        <button className="am-button" type="button" onClick={() => runAction('Revoke Bridge Session', '/api/agentmail/bridge-session/revoke')}>Revoke Bridge Session</button>
      </div>
      <div className={`am-action-result am-action-${state.status}`} role="status" aria-live="polite">
        <strong>{state.label}</strong>
        <span>{state.message}</span>
      </div>
    </>
  )
}
