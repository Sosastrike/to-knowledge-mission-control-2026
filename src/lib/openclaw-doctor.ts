import path from 'node:path'

import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

export type OpenClawDoctorLevel = 'healthy' | 'warning' | 'error'
export type OpenClawDoctorCategory = 'config' | 'state' | 'security' | 'general'

export interface OpenClawDoctorStatus {
  level: OpenClawDoctorLevel
  category: OpenClawDoctorCategory
  healthy: boolean
  summary: string
  issues: string[]
  canFix: boolean
  raw: string
}

export type OpenClawDoctorProofPacket = {
  lane: 'OpenClaw+'
  timestamp: string
  runtime_commit: string | null
  route_or_service_checked: string
  result: MissionControlCanonicalStatus
  blocker: string | null
  blocker_class: MissionControlClosureBlockerClass
  audit_pointer: string | null
  safe_log_pointer: string | null
  rollback_command: string
  service_user: string | null
  execution_enabled: false
  writes_enabled: false
  destructive_repair_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type OpenClawDoctorClosureSummary = {
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  blocker: string | null
  proof_packet: OpenClawDoctorProofPacket
}

export type OpenClawDoctorMissingPayload = OpenClawDoctorClosureSummary & {
  error: 'OpenClaw is not installed or not reachable'
  execution_enabled: false
  writes_enabled: false
  destructive_repair_enabled: false
  no_secrets_exposed: true
  raw_paths_exposed: false
}

function normalizeLine(line: string): string {
  return line
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/^[\s│┃║┆┊╎╏]+/, '')
    .trim()
}

function isSessionAgingLine(line: string): boolean {
  return /^agent:[\w:-]+ \(\d+[mh] ago\)$/i.test(line)
}

function isPositiveOrInstructionalLine(line: string): boolean {
  return /^no .* warnings? detected/i.test(line) ||
    /^no issues/i.test(line) ||
    /^run:\s/i.test(line) ||
    /^all .* (healthy|ok|valid|passed)/i.test(line)
}

function isDecorativeLine(line: string): boolean {
  return /^[▄█▀░\s]+$/.test(line) || /openclaw doctor/i.test(line) || /🦞\s*openclaw\s*🦞/i.test(line)
}

function isStateDirectoryListLine(line: string): boolean {
  return /^(?:\$OPENCLAW_HOME(?:\/\.openclaw)?|~\/\.openclaw|\/\S+)$/.test(line)
}

function normalizeFsPath(candidate: string): string {
  return path.resolve(candidate.trim())
}

function normalizeDisplayedPath(candidate: string, stateDir: string): string {
  const trimmed = candidate.trim()
  if (!trimmed) return trimmed
  if (trimmed === '~/.openclaw') return stateDir
  if (trimmed === '$OPENCLAW_HOME' || trimmed === '$OPENCLAW_HOME/.openclaw') return stateDir
  return trimmed
}

function stripForeignStateDirectoryWarning(rawOutput: string, stateDir?: string): string {
  if (!stateDir) return rawOutput

  const normalizedStateDir = normalizeFsPath(stateDir)
  const lines = rawOutput.split(/\r?\n/)
  const kept: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    const normalized = normalizeLine(line)

    if (!/multiple state directories detected/i.test(normalized)) {
      kept.push(line)
      continue
    }

    const blockLines = [line]
    let cursor = index + 1
    while (cursor < lines.length) {
      const nextLine = lines[cursor] ?? ''
      const nextNormalized = normalizeLine(nextLine)
      if (!nextNormalized) {
        blockLines.push(nextLine)
        cursor += 1
        continue
      }
      if (/^(active state dir:|[-*]\s+(?:\/|~\/|\$OPENCLAW_HOME)|\|)/i.test(nextNormalized)) {
        blockLines.push(nextLine)
        cursor += 1
        continue
      }
      break
    }

    const listedDirs = blockLines
      .map(normalizeLine)
      .filter(entry => /^[-*]\s+/.test(entry))
      .map(entry => entry.replace(/^[-*]\s+/, '').trim())
      .filter(Boolean)
      .map(entry => normalizeDisplayedPath(entry, normalizedStateDir))

    const foreignDirs = listedDirs.filter(entry => normalizeFsPath(entry) !== normalizedStateDir)
    const onlyForeignDirs = foreignDirs.length > 0

    if (!onlyForeignDirs) {
      kept.push(...blockLines)
    }

    index = cursor - 1
  }

  return kept.join('\n')
}

function detectCategory(raw: string, issues: string[]): OpenClawDoctorCategory {
  const haystack = `${raw}\n${issues.join('\n')}`.toLowerCase()

  if (/invalid config|config invalid|unrecognized key|invalid option/.test(haystack)) {
    return 'config'
  }

  if (/state integrity|orphan transcript|multiple state directories|session history/.test(haystack)) {
    return 'state'
  }

  if (/security audit|channel security|security /.test(haystack)) {
    return 'security'
  }

  return 'general'
}

export function parseOpenClawDoctorOutput(
  rawOutput: string,
  exitCode = 0,
  options: { stateDir?: string } = {}
): OpenClawDoctorStatus {
  const raw = stripForeignStateDirectoryWarning(rawOutput.trim(), options.stateDir).trim()
  const lines = raw
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)

  const issues = lines
    .filter(line => /^[-*]\s+/.test(line))
    .map(line => line.replace(/^[-*]\s+/, '').trim())
    .filter(line => !isSessionAgingLine(line) && !isStateDirectoryListLine(line) && !isPositiveOrInstructionalLine(line))

  // Strip positive/negated phrases before checking for warning keywords
  const rawForWarningCheck = raw.replace(/\bno\s+\w+\s+(?:security\s+)?warnings?\s+detected\b/gi, '')
  const mentionsWarnings = /\bwarning|warnings|problem|problems|invalid config|fix\b/i.test(rawForWarningCheck)
  const mentionsHealthy = /\bok\b|\bhealthy\b|\bno issues\b|\bno\b.*\bwarnings?\s+detected\b|\bvalid\b/i.test(raw)

  let level: OpenClawDoctorLevel = 'healthy'
  if (exitCode !== 0 || /invalid config|failed|error/i.test(raw)) {
    level = 'error'
  } else if (issues.length > 0 || mentionsWarnings) {
    level = 'warning'
  } else if (!mentionsHealthy && lines.length > 0) {
    level = 'warning'
  }

  const category = detectCategory(raw, issues)

  const summary =
    level === 'healthy'
      ? 'OpenClaw doctor reports a healthy configuration.'
      : issues[0] ||
        lines.find(line =>
          !/^run:/i.test(line) &&
          !/^file:/i.test(line) &&
          !isSessionAgingLine(line) &&
          !isDecorativeLine(line)
        ) ||
        'OpenClaw doctor reported configuration issues.'

  const canFix = level !== 'healthy' || /openclaw doctor --fix/i.test(raw)

  return {
    level,
    category,
    healthy: level === 'healthy',
    summary,
    issues,
    canFix,
    raw,
  }
}

function classifyOpenClawDoctorClosure(input: {
  status?: OpenClawDoctorStatus | null
  blocker?: string | null
}): {
  canonicalStatus: MissionControlCanonicalStatus
  blockerClass: MissionControlClosureBlockerClass
  blocker: string | null
} {
  const blocker = input.blocker || null
  if (blocker) {
    if (/(credential|token|api[_-]?key|oauth|secret)/i.test(blocker)) {
      return { canonicalStatus: 'CREDENTIAL_GATED', blockerClass: 'CREDENTIAL_GATED', blocker }
    }
    if (/(not[_-]?installed|not[_-]?reachable|runtime|binary|path|enoent|command|service|timeout)/i.test(blocker)) {
      return { canonicalStatus: 'SERVICE_DOWN', blockerClass: 'SERVICE_DOWN', blocker }
    }
    if (/(disabled|not[_-]?configured|adapter|blocked)/i.test(blocker)) {
      return { canonicalStatus: 'BLOCKED', blockerClass: 'BLOCKED', blocker }
    }
    return { canonicalStatus: 'BLOCKED', blockerClass: 'BLOCKED', blocker }
  }

  const status = input.status
  if (!status) {
    return {
      canonicalStatus: 'SERVICE_DOWN',
      blockerClass: 'SERVICE_DOWN',
      blocker: 'openclaw_doctor_runtime_not_reachable',
    }
  }
  if (status.healthy) {
    return { canonicalStatus: 'LIVE', blockerClass: 'NONE', blocker: null }
  }
  return {
    canonicalStatus: 'BLOCKED',
    blockerClass: 'BLOCKED',
    blocker: status.issues[0] || 'openclaw_doctor_issues_detected',
  }
}

export function buildOpenClawDoctorClosureSummary(input: {
  status?: OpenClawDoctorStatus | null
  blocker?: string | null
  timestamp?: string
  runtimeCommit?: string | null
  routeOrServiceChecked?: string | null
  serviceUser?: string | null
  rollbackCommand?: string
}): OpenClawDoctorClosureSummary {
  const classified = classifyOpenClawDoctorClosure({
    status: input.status || null,
    blocker: input.blocker || null,
  })

  return {
    canonical_status: classified.canonicalStatus,
    blocker_class: classified.blockerClass,
    blocker: classified.blocker,
    proof_packet: {
      lane: 'OpenClaw+',
      timestamp: input.timestamp || new Date().toISOString(),
      runtime_commit: input.runtimeCommit || null,
      route_or_service_checked: input.routeOrServiceChecked || '/api/openclaw/doctor',
      result: classified.canonicalStatus,
      blocker: classified.blocker,
      blocker_class: classified.blockerClass,
      audit_pointer: classified.blockerClass === 'NONE' ? '/api/openclaw/doctor' : null,
      safe_log_pointer: null,
      rollback_command: input.rollbackCommand || 'git revert <day-05-openclaw-commit>',
      service_user: input.serviceUser || null,
      execution_enabled: false,
      writes_enabled: false,
      destructive_repair_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    },
  }
}

export function withOpenClawDoctorClosure(
  status: OpenClawDoctorStatus,
  input: {
    timestamp?: string
    runtimeCommit?: string | null
    routeOrServiceChecked?: string | null
    serviceUser?: string | null
    rollbackCommand?: string
  } = {}
): OpenClawDoctorStatus & OpenClawDoctorClosureSummary {
  const closure = buildOpenClawDoctorClosureSummary({ ...input, status })
  return {
    ...status,
    ...closure,
  }
}

export function buildOpenClawDoctorMissingPayload(input: {
  timestamp?: string
  runtimeCommit?: string | null
  routeOrServiceChecked?: string | null
  serviceUser?: string | null
  rollbackCommand?: string
} = {}): OpenClawDoctorMissingPayload {
  const closure = buildOpenClawDoctorClosureSummary({
    ...input,
    blocker: 'openclaw_doctor_runtime_not_reachable',
  })
  return {
    error: 'OpenClaw is not installed or not reachable',
    ...closure,
    execution_enabled: false,
    writes_enabled: false,
    destructive_repair_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }
}
