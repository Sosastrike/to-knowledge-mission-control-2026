#!/usr/bin/env node
import { execFileSync } from 'node:child_process'

export const SECRET_SCAN_ALLOWLIST = [
  'backend-support/src/__tests__/redact.test.ts',
  'backend-support/src/__tests__/safety.test.ts',
  'src/lib/__tests__/scan-credentials.test.ts',
]

const highConfidenceSecretPattern = [
  'sk-[A-Za-z0-9_-]{20,}',
  'ghp_[A-Za-z0-9_]{20,}',
  'xox[baprs]-[A-Za-z0-9-]{20,}',
  'AIza[0-9A-Za-z_-]{35}',
  'BEGIN [A-Z ]*PRIVATE KEY',
  ['Bearer', ' [A-Za-z0-9._~+/=-]{24,}'].join(''),
].join('|')

const envPathPattern = /(^|\/)\.env($|\.)/

function runGit(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  })
}

function lines(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

function safeUnique(values) {
  return [...new Set(values)].sort()
}

function isAllowlisted(path) {
  return SECRET_SCAN_ALLOWLIST.includes(path)
}

export function classifySecretScanFiles(paths) {
  return safeUnique(paths).map((path) => ({
    path,
    disposition: isAllowlisted(path) ? 'allowlisted_test_fixture' : 'unresolved',
  }))
}

function readProtectedFileReport() {
  try {
    return JSON.parse(runGit(['status', '--short']).length >= 0
      ? execFileSync('node', ['scripts/check-protected-file-invariants.mjs'], {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      })
      : '{}')
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 180) : 'protected_file_check_failed',
      protected_changes: [{ path: '[check-failed]', protection: 'protected_file_check_failed' }],
    }
  }
}

function gitTrackedSecretFiles() {
  try {
    return lines(runGit([
      'grep',
      '-IlE',
      highConfidenceSecretPattern,
      '--',
      '.',
      ':!pnpm-lock.yaml',
      ':!package-lock.json',
      ':!runtime/*.pdf',
      ':!*.png',
      ':!*.jpg',
      ':!*.jpeg',
      ':!*.gif',
    ]))
  } catch (error) {
    return []
  }
}

function gitUntrackedSecretFiles() {
  const untracked = lines(runGit(['ls-files', '--others', '--exclude-standard']))
    .filter((path) => !/\.(png|jpe?g|gif|pdf|zip|tar|tgz|gz)$/i.test(path))

  if (!untracked.length) return []

  try {
    return lines(execFileSync('rg', [
      '-Il',
      highConfidenceSecretPattern,
      ...untracked,
    ], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }))
  } catch (error) {
    return []
  }
}

function envStatusPaths() {
  return lines(runGit(['status', '--short', '--untracked-files=all']))
    .map((line) => line.slice(3).trim().replace(/^"|"$/g, ''))
    .filter((path) => envPathPattern.test(path))
}

export function buildSecretScanReport({
  checked_at,
  tracked_secret_files,
  untracked_secret_files,
  protected_file_report,
  env_status_paths,
}) {
  const trackedFindings = classifySecretScanFiles(tracked_secret_files).map((finding) => ({
    ...finding,
    source: 'tracked',
  }))
  const untrackedFindings = classifySecretScanFiles(untracked_secret_files).map((finding) => ({
    ...finding,
    source: 'untracked',
  }))
  const allFindings = [...trackedFindings, ...untrackedFindings]
  const unresolvedSecretLikeFiles = allFindings.filter((finding) => finding.disposition === 'unresolved')
  const protectedChanges = Array.isArray(protected_file_report?.protected_changes)
    ? protected_file_report.protected_changes
    : []
  const blockers = [
    ...(unresolvedSecretLikeFiles.length ? ['unresolved_secret_like_file'] : []),
    ...(protected_file_report?.ok === false ? ['protected_file_invariant_failed'] : []),
    ...(env_status_paths.length ? ['.env_changed_or_untracked'] : []),
  ]

  return {
    ok: blockers.length === 0,
    checked_at,
    mode: 'secret_scan_closure',
    blocker_class: blockers.length ? 'BLOCKED' : 'NONE',
    blockers,
    patterns_checked: [
      'OpenAI-style API tokens',
      'GitHub personal access tokens',
      'Slack bot/app/user tokens',
      'Google API keys',
      'private key blocks',
      'long bearer tokens',
    ],
    values_printed: false,
    secret_values_printed: false,
    response_bodies_printed: false,
    allowlist: SECRET_SCAN_ALLOWLIST,
    tracked_secret_like_files: trackedFindings,
    untracked_secret_like_files: untrackedFindings,
    unresolved_secret_like_files: unresolvedSecretLikeFiles,
    protected_file_report,
    protected_changes: protectedChanges,
    env_status_paths,
  }
}

function run() {
  const report = buildSecretScanReport({
    checked_at: new Date().toISOString(),
    tracked_secret_files: gitTrackedSecretFiles(),
    untracked_secret_files: gitUntrackedSecretFiles(),
    protected_file_report: readProtectedFileReport(),
    env_status_paths: envStatusPaths(),
  })

  const text = JSON.stringify(report, null, 2)
  if (!report.ok) {
    console.error(text)
    process.exit(1)
  }
  console.log(text)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run()
}
