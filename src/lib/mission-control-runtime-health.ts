import { existsSync, readlinkSync } from 'node:fs'

export type MissionControlRuntimeHealthStatus =
  | 'ACTIVE_BUNDLE_CURRENT'
  | 'STALE_BUNDLE_RESTART_REQUIRED'
  | 'UNKNOWN_RUNTIME_CWD'

export type MissionControlRuntimeHealthInput = {
  pid?: number
  processCwd?: string | null
  procCwdLink?: string | null
  cwdExists?: boolean
  checkedAt?: string
}

export type MissionControlRuntimeHealth = {
  status: MissionControlRuntimeHealthStatus
  checked_at: string
  process_id: number
  stale_next_bundle_detected: boolean
  owner_action_required: boolean
  owner_action: 'sudo systemctl restart mission-control.service' | null
  exact_blocker: 'mission_control_service_restart_required_stale_next_bundle' | null
  service_restart_attempted: false
  public_exposure_changed: false
  secrets_exposed: false
  credential_values_exposed: false
  raw_env_values_exposed: false
  no_secret_proof: {
    env_values_printed: false
    tokens_printed: false
    cookies_printed: false
    credential_values_printed: false
  }
  cwd_summary: {
    expected_standalone_bundle: boolean
    proc_cwd_contains_deleted: boolean
    process_cwd_exists: boolean
    path_values_redacted: true
  }
  evidence: {
    proc_cwd_state: 'deleted' | 'present' | 'unavailable'
    process_cwd_state: 'exists' | 'missing' | 'unavailable'
    stale_detection_rule: 'proc_cwd_deleted_or_missing_standalone_cwd'
  }
  recommended_validation: string[]
  rollback_command: string
}

function safeProcessCwd() {
  try {
    return process.cwd()
  } catch {
    return null
  }
}

function safeProcCwdLink(pid: number) {
  try {
    return readlinkSync('/proc/' + pid + '/cwd', 'utf8')
  } catch {
    return null
  }
}

function cwdExists(cwd: string | null) {
  if (!cwd) return false
  try {
    return existsSync(cwd)
  } catch {
    return false
  }
}

export function buildMissionControlRuntimeHealth(input: MissionControlRuntimeHealthInput = {}): MissionControlRuntimeHealth {
  const pid = input.pid ?? process.pid
  const processCwd = input.processCwd === undefined ? safeProcessCwd() : input.processCwd
  const procCwdLink = input.procCwdLink === undefined ? safeProcCwdLink(pid) : input.procCwdLink
  const exists = input.cwdExists ?? cwdExists(processCwd)
  const expectedStandalone = Boolean((processCwd || procCwdLink || '').includes('.next/standalone'))
  const procDeleted = Boolean(procCwdLink?.includes('(deleted)'))
  const stale = Boolean(expectedStandalone && (procDeleted || !exists))

  return {
    status: stale ? 'STALE_BUNDLE_RESTART_REQUIRED' : processCwd || procCwdLink ? 'ACTIVE_BUNDLE_CURRENT' : 'UNKNOWN_RUNTIME_CWD',
    checked_at: input.checkedAt || new Date().toISOString(),
    process_id: pid,
    stale_next_bundle_detected: stale,
    owner_action_required: stale,
    owner_action: stale ? 'sudo systemctl restart mission-control.service' : null,
    exact_blocker: stale ? 'mission_control_service_restart_required_stale_next_bundle' : null,
    service_restart_attempted: false,
    public_exposure_changed: false,
    secrets_exposed: false,
    credential_values_exposed: false,
    raw_env_values_exposed: false,
    no_secret_proof: {
      env_values_printed: false,
      tokens_printed: false,
      cookies_printed: false,
      credential_values_printed: false,
    },
    cwd_summary: {
      expected_standalone_bundle: expectedStandalone,
      proc_cwd_contains_deleted: procDeleted,
      process_cwd_exists: exists,
      path_values_redacted: true,
    },
    evidence: {
      proc_cwd_state: procCwdLink ? procDeleted ? 'deleted' : 'present' : 'unavailable',
      process_cwd_state: processCwd ? exists ? 'exists' : 'missing' : 'unavailable',
      stale_detection_rule: 'proc_cwd_deleted_or_missing_standalone_cwd',
    },
    recommended_validation: [
      'sudo systemctl restart mission-control.service',
      'curl -I http://127.0.0.1:3337/login',
      'readlink /proc/$(systemctl show mission-control.service -p MainPID --value)/cwd',
    ],
    rollback_command: 'No source rollback required for service restart; if reverting this health check use git revert <commit>.',
  }
}
