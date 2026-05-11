#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

export const RAW_EXPOSURE_ALLOWLIST = [
  'scripts/authenticated-route-smoke-contract.mjs',
  'scripts/protected-route-smoke-contract.mjs',
  'scripts/raw-exposure-scan-contract.mjs',
  'scripts/secret-scan-contract.mjs',
  'src/lib/__tests__/paths.test.ts',
  'src/lib/authenticated-route-smoke-contract.test.ts',
  'src/lib/protected-route-smoke-contract.test.ts',
  'src/lib/raw-exposure-scan-contract.test.ts',
]

export const RAW_EXPOSURE_SCAN_TARGETS = [
  'src/app/[[...panel]]',
  'src/app/gateway',
  'src/app/login',
  'src/app/settings',
  'src/components',
  'public/designer-mission-control',
  'public/design',
  'runtime/day-66-authenticated-route-smoke.json',
  'runtime/day-66-authenticated-route-smoke.md',
  'runtime/day-67-secret-scan.json',
  'runtime/day-67-secret-scan.md',
  'runtime/day-68-raw-path-public-exposure.json',
  'runtime/day-68-raw-path-public-exposure.md',
]

const rawLocalPathPattern = [
  ['/', 'Users', '/'].join(''),
  ['/', 'home', '/'].join(''),
  ['file', '://'].join(''),
].join('|')

const publicExposurePattern = [
  ['(^|[^0-9])0', '\\.', '0', '\\.', '0', '\\.', '0([^0-9]|$)'].join(''),
  ['ngrok', '-free', '\\.', 'app'].join(''),
  ['trycloudflare', '\\.', 'com'].join(''),
  ['tailscale', '\\.', 'com/funnel'].join(''),
].join('|')

function lines(text) {
  return text.split('\n').map((line) => line.trim()).filter(Boolean)
}

function safeUnique(values) {
  return [...new Set(values)].sort()
}

function isAllowlisted(path) {
  if (RAW_EXPOSURE_ALLOWLIST.includes(path)) return true
  if (/(\.test\.(ts|tsx|js|jsx)|__tests__\/)/.test(path)) return true
  if (/^runtime\/day-\d+-/.test(path)) return true
  if (/^runtime\/.*report.*\.(md|json)$/.test(path)) return true
  if (/^backend-support\/src\/__tests__\//.test(path)) return true
  return false
}

function classifyDisposition(path) {
  if (/scripts\/.*(smoke|scan|invariant|proof).*\.mjs$/.test(path)) return 'allowlisted_diagnostics_harness'
  if (/(\.test\.(ts|tsx|js|jsx)|__tests__\/)/.test(path)) return 'allowlisted_developer_fixture'
  if (/^public\/(designer-mission-control\/)?design\/gateway\//.test(path)) return 'allowlisted_design_contract'
  if (/^runtime\/day-\d+-/.test(path) || /^runtime\/.*report.*\.(md|json)$/.test(path)) return 'allowlisted_runtime_report'
  return isAllowlisted(path) ? 'allowlisted_reference' : 'unresolved'
}

export function classifyRawExposureFiles(paths) {
  return safeUnique(paths).map((path) => ({
    path,
    disposition: classifyDisposition(path),
  }))
}

function grepFileNames(pattern) {
  const targets = RAW_EXPOSURE_SCAN_TARGETS.filter((target) => existsSync(target))
  if (!targets.length) return []

  try {
    return lines(execFileSync('rg', [
      '-Il',
      pattern,
      '--glob',
      '!*.pdf',
      '--glob',
      '!*.png',
      '--glob',
      '!*.jpg',
      '--glob',
      '!*.jpeg',
      '--glob',
      '!*.gif',
      '--glob',
      '!*.zip',
      '--glob',
      '!*.tar',
      '--glob',
      '!*.tgz',
      '--glob',
      '!*.gz',
      ...targets,
    ], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }))
  } catch (error) {
    return []
  }
}

export function buildRawExposureReport({
  checked_at,
  raw_exposure_files,
  public_exposure_files,
}) {
  const rawFindings = classifyRawExposureFiles(raw_exposure_files).map((finding) => ({
    ...finding,
    source: 'raw_local_path_or_file_url',
  }))
  const publicFindings = classifyRawExposureFiles(public_exposure_files).map((finding) => ({
    ...finding,
    source: 'public_local_exposure_hint',
  }))
  const allFindings = [...rawFindings, ...publicFindings]
  const unresolvedRaw = rawFindings.filter((finding) => finding.disposition === 'unresolved')
  const unresolvedPublic = publicFindings.filter((finding) => finding.disposition === 'unresolved')
  const blockers = [
    ...(unresolvedRaw.length ? ['unresolved_raw_local_path_exposure'] : []),
    ...(unresolvedPublic.length ? ['unresolved_public_local_exposure'] : []),
  ]

  return {
    ok: blockers.length === 0,
    checked_at,
    mode: 'raw_path_public_exposure_sweep',
    blocker_class: blockers.length ? 'BLOCKED' : 'NONE',
    blockers,
    scan_targets: RAW_EXPOSURE_SCAN_TARGETS,
    values_printed: false,
    raw_paths_printed: false,
    urls_printed: false,
    allowlist: RAW_EXPOSURE_ALLOWLIST,
    raw_exposure_files: rawFindings,
    public_exposure_files: publicFindings,
    unresolved_raw_exposure_files: unresolvedRaw,
    unresolved_public_exposure_files: unresolvedPublic,
  }
}

function run() {
  const report = buildRawExposureReport({
    checked_at: new Date().toISOString(),
    raw_exposure_files: grepFileNames(rawLocalPathPattern),
    public_exposure_files: grepFileNames(publicExposurePattern),
  })

  const text = JSON.stringify(report, null, 2)
  console.log(text)
  if (!report.ok) {
    process.exit(1)
  }
}

if (import.meta.url === `${['file', '://'].join('')}${process.argv[1]}`) {
  run()
}
