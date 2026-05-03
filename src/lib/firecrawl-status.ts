import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export type FirecrawlUiState = 'CREDENTIAL_REQUIRED' | 'BACKEND_REQUIRED' | 'LIVE'

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

export function getFirecrawlStatus(root = process.cwd()) {
  const keyPresent = Boolean((process.env.FIRECRAWL_API_KEY || '').trim())
  const sdkLoaded = firecrawlSdkLoaded(root)
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
