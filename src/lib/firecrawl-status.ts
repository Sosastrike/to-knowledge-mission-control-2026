import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

export type FirecrawlUiState = 'CREDENTIAL_REQUIRED' | 'BACKEND_REQUIRED' | 'LIVE'

export type FirecrawlProofPacket = {
  lane: 'SpaceAgent Firecrawl'
  timestamp: string
  runtime_commit: string | null
  route_or_service_checked: string
  result: MissionControlCanonicalStatus
  blocker: string | null
  blocker_class: MissionControlClosureBlockerClass
  blockers: string[]
  audit_pointer: string | null
  safe_log_pointer: string | null
  rollback_command: string
  credential_present: boolean
  backend_adapter_present: boolean
  read_only_smoke_allowed: boolean
  write_execution_enabled: false
  broad_crawl_enabled: false
  public_exposure: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type FirecrawlClosureSummary = {
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  blocked_reason: string | null
  blockers: string[]
  proof_packet: FirecrawlProofPacket
}

export function hasFirecrawlEnvName(path: string, name = 'FIRECRAWL_API_KEY'): boolean {
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .some((line) => line.trim().startsWith(`${name}=`))
  } catch {
    return false
  }
}

export function firecrawlSdkLoaded(root = process.cwd()): boolean {
  return existsSync(join(root, 'node_modules', '@mendable', 'firecrawl-js', 'package.json'))
}

export function buildFirecrawlClosureSummary(input: {
  keyPresent: boolean
  sdkLoaded: boolean
  timestamp?: string
  runtimeCommit?: string | null
  routeOrServiceChecked?: string
  rollbackCommand?: string
}): FirecrawlClosureSummary {
  const blockers = [
    !input.keyPresent ? 'firecrawl_credential_required' : null,
    !input.sdkLoaded ? 'firecrawl_backend_adapter_not_configured' : null,
  ].filter((blocker): blocker is string => Boolean(blocker))
  const canonicalStatus: MissionControlCanonicalStatus = blockers.length === 0
    ? 'READY'
    : !input.keyPresent
      ? 'CREDENTIAL_GATED'
      : 'SERVICE_DOWN'
  const blockerClass: MissionControlClosureBlockerClass = blockers.length === 0
    ? 'NONE'
    : !input.keyPresent
      ? 'CREDENTIAL_GATED'
      : 'SERVICE_DOWN'
  const blockedReason = blockers[0] || null

  return {
    canonical_status: canonicalStatus,
    blocker_class: blockerClass,
    blocked_reason: blockedReason,
    blockers,
    proof_packet: {
      lane: 'SpaceAgent Firecrawl',
      timestamp: input.timestamp || new Date().toISOString(),
      runtime_commit: input.runtimeCommit || null,
      route_or_service_checked: input.routeOrServiceChecked || '/api/firecrawl/status',
      result: canonicalStatus,
      blocker: blockedReason,
      blocker_class: blockerClass,
      blockers,
      audit_pointer: blockers.length === 0 ? '/api/firecrawl/status' : null,
      safe_log_pointer: null,
      rollback_command: input.rollbackCommand || 'git revert <day-08-spaceagent-firecrawl-commit>',
      credential_present: input.keyPresent,
      backend_adapter_present: input.sdkLoaded,
      read_only_smoke_allowed: blockers.length === 0,
      write_execution_enabled: false,
      broad_crawl_enabled: false,
      public_exposure: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    },
  }
}

export function getFirecrawlStatus(root = process.cwd()) {
  const keyPresent = Boolean((process.env.FIRECRAWL_API_KEY || '').trim())
  const sdkLoaded = firecrawlSdkLoaded(root)
  const closure = buildFirecrawlClosureSummary({ keyPresent, sdkLoaded })
  const missionControlEnvPresent =
    hasFirecrawlEnvName('/home/tony/mission-control/.env') ||
    hasFirecrawlEnvName('/home/tony/mission-control/.env.local')
  const claudeClawEnvPresent = hasFirecrawlEnvName('/home/tony/claudeclaw/.env')
  const openClawEnvPresent = hasFirecrawlEnvName('/home/tony/.openclaw/.env')
  const envMismatch = !keyPresent && (claudeClawEnvPresent || openClawEnvPresent)
  const state: FirecrawlUiState = !keyPresent
    ? 'CREDENTIAL_REQUIRED'
    : !sdkLoaded
      ? 'BACKEND_REQUIRED'
      : 'LIVE'
  const status = state === 'LIVE' ? 'live' : state === 'BACKEND_REQUIRED' ? 'backend_required' : 'credential_required'
  const nextAction = keyPresent
    ? sdkLoaded
      ? 'Wire FireCrawl SDK job runner and persistence tables after owner approval.'
      : 'Install @mendable/firecrawl-js and wire the job runner after owner approval.'
    : 'Mission Control FIRECRAWL_API_KEY is missing. ClaudeClaw/OpenClaw may have the credential, but Mission Control does not. Approved credential sync path required.'

  return {
    ok: true,
    status,
    state,
    canonical_status: closure.canonical_status,
    blocker_class: closure.blocker_class,
    blocked_reason: closure.blocked_reason,
    blockers: closure.blockers,
    proof_packet: closure.proof_packet,
    keyPresent,
    sdkLoaded,
    key_present: keyPresent,
    sdk_loaded: sdkLoaded,
    firecrawl_backend_truth: {
      mission_control_process_has_firecrawl_api_key: keyPresent,
      mission_control_env_has_firecrawl_api_key: missionControlEnvPresent,
      claudeclaw_env_has_firecrawl_api_key: claudeClawEnvPresent,
      openclaw_env_has_firecrawl_api_key: openClawEnvPresent,
      mission_control_sdk_present: sdkLoaded,
      mismatch: envMismatch || !sdkLoaded,
      conclusion: envMismatch
        ? 'Mission Control is missing FIRECRAWL_API_KEY even though ClaudeClaw/OpenClaw have it by name.'
        : !sdkLoaded
          ? 'Mission Control FireCrawl SDK is missing.'
          : 'Mission Control FireCrawl credential and SDK are present.',
      approved_fix_required: !keyPresent || !sdkLoaded,
      approved_fix_note: 'Use an owner-approved credential sync path and package install path. Do not copy secrets manually or run FireCrawl jobs from this endpoint.',
    },
    mcp: { name: 'firecrawl-mcp', status: sdkLoaded ? 'unknown' : 'not_wired' },
    api: { reachable: sdkLoaded },
    jobs: { active: 0, queued: 0, completed: 0, failed: 0 },
    last_successful_crawl: null,
    assigned_agents: ['Agent Zero', 'Researcher', 'Builder', 'Operator', 'Marketing', 'Support'],
    cost_today_usd: null,
    nextAction,
    next_action: nextAction,
  }
}
