import { execFileSync } from 'node:child_process'

export interface ClaudeClawRuntimeStatus {
  name: string
  unit: string
  activeState: string
  subState: string
  running: boolean
  pid: number | null
  observedAt: number
}

export function normalizeRuntimeAgentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-|-$/g, '')
}

function agentNameFromUnit(unit: string): string | null {
  if (unit === 'claudeclaw.service') return 'agent_zero'
  const match = unit.match(/^claudeclaw-(.+)\.service$/)
  return match?.[1] || null
}

function readRuntimePids(): Map<string, number> {
  const pids = new Map<string, number>()

  try {
    const output = execFileSync('ps', ['-eo', 'pid=,args='], {
      encoding: 'utf8',
      timeout: 2500,
      maxBuffer: 1024 * 1024,
    })

    const runtimeCommand = /(?:^|\s)(?:node|\S+\/node)\s+\/home\/tony\/claudeclaw\/dist\/index\.js(?:\s|$)/
    for (const line of output.split('\n')) {
      const match = line.match(/^\s*(\d+)\s+(.+)$/)
      if (!match) continue

      const pid = Number(match[1])
      const args = match[2]
      if (!runtimeCommand.test(args)) continue

      const agentMatch = args.match(/--agent(?:=|\s+)([A-Za-z0-9._-]+)/)
      const runtimeName = agentMatch?.[1] || 'agent_zero'
      pids.set(normalizeRuntimeAgentName(runtimeName), pid)
    }
  } catch {
    // ps is a fallback signal only; callers still get systemd state if present.
  }

  return pids
}

export function getClaudeClawRuntimeStatusMap(): Map<string, ClaudeClawRuntimeStatus> {
  const observedAt = Date.now()
  const statuses = new Map<string, ClaudeClawRuntimeStatus>()
  const pids = readRuntimePids()

  try {
    const output = execFileSync(
      'systemctl',
      ['--user', 'list-units', 'claudeclaw*.service', '--no-legend', '--no-pager'],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/run/user/1001',
        },
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 2500,
        maxBuffer: 512 * 1024,
      },
    )

    for (const line of output.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parts = trimmed.split(/\s+/)
      const unit = parts[0]
      const activeState = parts[2] || 'unknown'
      const subState = parts[3] || 'unknown'
      const name = agentNameFromUnit(unit)
      if (!name) continue

      const key = normalizeRuntimeAgentName(name)
      statuses.set(key, {
        name,
        unit,
        activeState,
        subState,
        running: activeState === 'active' && subState === 'running',
        pid: pids.get(key) ?? null,
        observedAt,
      })
    }
  } catch {
    // Fall back to process detection when systemd is unavailable.
  }

  for (const [key, pid] of pids) {
    if (statuses.has(key)) continue
    statuses.set(key, {
      name: key,
      unit: key === 'agent_zero' ? 'claudeclaw.service' : `claudeclaw-${key}.service`,
      activeState: 'unknown',
      subState: 'process-running',
      running: true,
      pid,
      observedAt,
    })
  }

  return statuses
}
