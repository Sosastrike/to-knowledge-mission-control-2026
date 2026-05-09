import type { BuildWikiFarmerStatus } from './types.js'
import { redactString } from './redact.js'

// READ-ONLY helper for the Build-Wiki / OpenCloud-Docs Farmer.
// This module never invokes systemctl. It never spawns child processes.
// It only describes state and produces an owner-facing snapshot.
// The exact target service is fixed by spec.
export const BUILDWIKI_TARGET_SERVICE = 'opencloud-docs-farmer.service' as const

// Fork-1 only — explicit deny-list that lives next to the helper so any
// drift is caught by the typechecker / linter rather than at runtime.
export const BUILDWIKI_FORK1_FORBIDDEN = [
  'smb',
  'fork2',
  'gmail-farmer',
  'slack-farmer',
  'youtube-farmer',
  'web-farmer',
  'zapier-write',
] as const

export interface BuildWikiRawTelegramApproval {
  id: string
  status: 'pending' | 'approved' | 'denied' | 'expired' | string
  run_status: 'completed' | 'failed' | 'running' | null | string
  run_exit_code: number | null
  run_summary: string | null
  expires_at_iso?: string | null
  decision_at_iso?: string | null
}

export interface BuildWikiRawSystemd {
  active_state?: string | null      // 'active' | 'inactive' | 'failed' | …
  sub_state?: string | null         // 'running' | 'dead' | 'exited' | …
  timer_active?: boolean | null
  last_run_finished_at?: string | null
  last_run_exit_code?: number | null
}

export interface BuildWikiRawInput {
  telegram?: BuildWikiRawTelegramApproval | null
  systemd?: BuildWikiRawSystemd | null
}

function deriveServiceRunning(systemd: BuildWikiRawSystemd | null | undefined): boolean | null {
  if (!systemd || !systemd.active_state) return null
  if (systemd.active_state === 'active') return true
  if (['inactive', 'failed', 'dead'].includes(systemd.active_state)) return false
  return null
}

function deriveUiState(telegram: BuildWikiRawTelegramApproval | null | undefined, serviceRunning: boolean | null): string {
  if (telegram) {
    if (telegram.status === 'pending') return 'pending_approval'
    if (telegram.status === 'denied') return 'denied'
    if (telegram.status === 'expired') return 'expired'
    if (telegram.run_status === 'running') return 'running'
    if (telegram.run_status === 'completed') return 'completed'
    if (telegram.run_status === 'failed') return 'failed'
    if (telegram.status === 'approved') return 'approved'
  }
  if (serviceRunning === true) return 'running'
  return 'idle'
}

export function buildBuildWikiStatus(raw: BuildWikiRawInput | null | undefined): BuildWikiFarmerStatus {
  const systemd = raw?.systemd ?? null
  const telegram = raw?.telegram ?? null
  const serviceRunning = deriveServiceRunning(systemd)
  const ui_state = deriveUiState(telegram, serviceRunning)
  const exitCode = systemd?.last_run_exit_code ?? telegram?.run_exit_code ?? null

  let blocker: string | null = null
  let next_action: string | null = null

  if (telegram?.status === 'pending') {
    blocker = 'Awaiting owner approval in Telegram.'
    next_action = 'Owner approves or denies the Build-Wiki run-now request in Telegram.'
  } else if (telegram?.status === 'denied' || telegram?.status === 'expired') {
    blocker = `Last run-now request ${telegram.status}.`
    next_action = 'Owner re-issues the run-now request from Mission Control if needed.'
  } else if (telegram?.run_status === 'failed' || (typeof exitCode === 'number' && exitCode !== 0 && telegram?.run_status !== 'running')) {
    blocker = telegram?.run_summary ? redactString(telegram.run_summary).slice(0, 200) : 'Last run exited non-zero.'
    next_action = 'Owner inspects last run summary; Codex reads but does not retry without approval.'
  }

  let status: BuildWikiFarmerStatus['status']
  if (ui_state === 'running') status = 'LIVE'
  else if (ui_state === 'completed' || ui_state === 'approved') status = 'READY'
  else if (ui_state === 'pending_approval') status = 'OWNER_GATED'
  else if (ui_state === 'denied' || ui_state === 'expired' || ui_state === 'failed') status = 'BLOCKED'
  else if (serviceRunning === false && telegram == null) status = 'READ_ONLY'
  else status = 'READ_ONLY'

  return {
    status,
    service_name: BUILDWIKI_TARGET_SERVICE,
    service_running: serviceRunning,
    timer_active: typeof systemd?.timer_active === 'boolean' ? systemd.timer_active : null,
    approval_state: telegram?.status ?? null,
    ui_state,
    last_run_finished_at: systemd?.last_run_finished_at ?? null,
    last_run_exit_code: typeof exitCode === 'number' ? exitCode : null,
    blocker,
    next_action,
    run_now_requires_owner_approval: true,
  }
}

// Bridge-side gate — given the same telegram + systemd + the bridge readiness
// flags, decide whether `Run Now` should be enabled in the UI. The answer is
// always BOOLEAN-FALSE unless the approval is explicitly approved AND running
// is allowed; otherwise we surface the reason and the next action.
export interface RunNowGateInput {
  telegram?: BuildWikiRawTelegramApproval | null
  bridge?: { approval_persistence_ready: boolean; runner_available: boolean } | null
  global_execution_enabled: boolean
}

export interface RunNowGateOutput {
  run_now_button_enabled: boolean
  reason: string
  next_action: string
}

export function evaluateRunNowGate(input: RunNowGateInput): RunNowGateOutput {
  if (!input.global_execution_enabled) {
    return {
      run_now_button_enabled: false,
      reason: 'Global execution is disabled.',
      next_action: 'Owner toggles execution on in Mission Control before run-now is offered.',
    }
  }
  if (!input.bridge?.approval_persistence_ready) {
    return {
      run_now_button_enabled: false,
      reason: 'Bridge approval persistence not ready.',
      next_action: 'Codex finishes Bridge approval persistence before exposing run-now.',
    }
  }
  if (!input.bridge?.runner_available) {
    return {
      run_now_button_enabled: false,
      reason: 'Bridge runner not available.',
      next_action: 'Codex confirms the Bridge runner is reachable before run-now is offered.',
    }
  }
  if (!input.telegram) {
    return {
      run_now_button_enabled: true,
      reason: 'No outstanding request — owner may issue a new run-now approval request.',
      next_action: 'Owner taps Run Now to issue an approval request.',
    }
  }
  if (input.telegram.status === 'pending') {
    return {
      run_now_button_enabled: false,
      reason: 'A run-now request is already pending owner approval in Telegram.',
      next_action: 'Owner resolves the pending approval before issuing another.',
    }
  }
  if (input.telegram.status === 'approved' && input.telegram.run_status === 'running') {
    return {
      run_now_button_enabled: false,
      reason: 'A run is already in progress.',
      next_action: 'Wait for the running job to finish before queuing another.',
    }
  }
  return {
    run_now_button_enabled: true,
    reason: 'Last request resolved — owner may issue a new run-now request.',
    next_action: 'Owner taps Run Now to issue an approval request.',
  }
}
