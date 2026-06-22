import { readFileSync, readlinkSync } from 'node:fs'

export type MissionControlServiceOwnershipInput = {
  pid: number
  cwd: string
  cgroup: string
}

export type MissionControlServiceOwnershipStatus = {
  status: 'healthy' | 'stale_process' | 'unowned_process'
  pid: number
  cwd: string
  cwd_exposed: false
  systemd_owned: boolean
  stale_deleted_cwd: boolean
  exact_blocker: string | null
  next_action: string
  credential_values_exposed: false
}

export function summarizeMissionControlServiceOwnership(input: MissionControlServiceOwnershipInput): MissionControlServiceOwnershipStatus {
  const staleDeletedCwd = input.cwd.includes('(deleted)')
  const systemdOwned = input.cgroup.includes('/system.slice/mission-control.service')
  const status = staleDeletedCwd
    ? 'stale_process'
    : systemdOwned
      ? 'healthy'
      : 'unowned_process'
  const exactBlocker = staleDeletedCwd
    ? 'mission_control_process_running_from_deleted_standalone'
    : systemdOwned
      ? null
      : 'mission_control_service_not_owner_of_serving_process'

  return {
    status,
    pid: input.pid,
    cwd: input.cwd.replace(/\/home\/[^/]+/g, '/home/<redacted>'),
    cwd_exposed: false,
    systemd_owned: systemdOwned,
    stale_deleted_cwd: staleDeletedCwd,
    exact_blocker: exactBlocker,
    next_action: exactBlocker === null
      ? 'Mission Control service owns the serving process and the standalone cwd is current.'
      : 'Recycle mission-control.service after a production build so the serving process loads the fresh standalone directory.',
    credential_values_exposed: false,
  }
}

export function currentMissionControlServiceOwnership() {
  const pid = process.pid
  const cwd = (() => {
    try {
      return readlinkSync(`/proc/${pid}/cwd`)
    } catch {
      return process.cwd()
    }
  })()
  const cgroup = (() => {
    try {
      return readFileSync(`/proc/${pid}/cgroup`, 'utf8')
    } catch {
      return ''
    }
  })()
  return summarizeMissionControlServiceOwnership({ pid, cwd, cgroup })
}
