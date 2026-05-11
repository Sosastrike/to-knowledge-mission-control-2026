import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type RuntimeStatus = 'LIVE' | 'SERVICE_DOWN' | 'BLOCKED'

type RuntimeHealthOptions = {
  port?: string
}

function run(command: string, args: string[]) {
  try {
    return execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 2 * 1024 * 1024,
    }).trim()
  } catch {
    return ''
  }
}

function resolveExistingPath(candidates: string[]) {
  for (const label of candidates) {
    const absolutePath = join(process.cwd(), label)
    if (existsSync(absolutePath)) return { label, absolutePath }
  }
  const fallback = candidates[0]
  return { label: fallback, absolutePath: join(process.cwd(), fallback) }
}

function readPid(candidates: string[]) {
  const { absolutePath } = resolveExistingPath(candidates)
  if (!existsSync(absolutePath)) return null
  const raw = readFileSync(absolutePath, 'utf8').trim()
  return /^[0-9]+$/.test(raw) ? raw : null
}

function listenerPids(port: string) {
  const output = run('bash', ['-lc', `if command -v lsof >/dev/null 2>&1; then lsof -nP -tiTCP:${port} -sTCP:LISTEN || true; fi`])
  return output.split(/\s+/).filter((pid) => /^[0-9]+$/.test(pid))
}

function fileMtimeIso(candidates: string[]) {
  const { absolutePath } = resolveExistingPath(candidates)
  if (!existsSync(absolutePath)) return null
  return statSync(absolutePath).mtime.toISOString()
}

export function buildRuntimeHealthPayload(options: RuntimeHealthOptions = {}) {
  const port = options.port || process.env.PORT || '3337'
  const pidFileCandidates = ['.next/standalone/server.pid', 'server.pid']
  const bundleCandidates = ['.next/standalone/server.js', 'server.js']
  const staticCandidates = ['.next/standalone/.next/static', '.next/static']
  const bundlePath = resolveExistingPath(bundleCandidates)
  const staticPath = resolveExistingPath(staticCandidates)
  const pidFromFile = readPid(pidFileCandidates)
  const listeners = listenerPids(port)
  const pidMatchesListener = Boolean(pidFromFile && listeners.includes(pidFromFile))
  const bundlePresent = existsSync(bundlePath.absolutePath)
  const staticPresent = existsSync(staticPath.absolutePath)
  const status: RuntimeStatus = bundlePresent && listeners.length > 0
    ? 'LIVE'
    : bundlePresent
      ? 'SERVICE_DOWN'
      : 'BLOCKED'

  const sourceCommit = run('git', ['rev-parse', '--short', 'HEAD']) || 'unknown'
  const sourceBranch = run('git', ['branch', '--show-current']) || 'unknown'

  return {
    ok: status === 'LIVE',
    mode: 'runtime_health',
    status,
    checked_at: new Date().toISOString(),
    source_commit: sourceCommit,
    source_branch: sourceBranch,
    bind: {
      expected_host: '127.0.0.1',
      override_env: 'MC_HOSTNAME',
      port,
      no_public_exposure_added: true,
    },
    standalone: {
      bundle_present: bundlePresent,
      static_present: staticPresent,
      pid_file: '.next/standalone/server.pid',
      pid_from_file: pidFromFile,
      listener_pids: listeners,
      pid_matches_listener: pidMatchesListener,
      runtime_cwd_mode: bundlePath.label === 'server.js' ? 'standalone' : 'source_tree',
    },
    deployment: {
      last_build_at: fileMtimeIso(bundleCandidates),
      static_synced_at: fileMtimeIso(staticCandidates),
      rollback_command: `git revert <runtime-health-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=${port} bash scripts/start-standalone.sh`,
    },
    blockers: status === 'LIVE'
      ? []
      : status === 'SERVICE_DOWN'
        ? ['runtime_listener_missing']
        : ['standalone_bundle_missing'],
  }
}
