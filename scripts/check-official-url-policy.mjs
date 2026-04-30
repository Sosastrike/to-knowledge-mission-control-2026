#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const root = process.cwd()

const temporaryUrlPatterns = [
  /\bhttps?:\/\/tkmc\.knowledge-vs-ai\.com:8080\b/g,
  /\bhttps?:\/\/mc\.knowledge-vs-ai\.com:8080\b/g,
  /\bhttps?:\/\/gw\.knowledge-vs-ai\.com:8080\b/g,
]

const officialUrls = {
  mission_control: 'https://tkmc.knowledge-vs-ai.com/login',
  claudeclaw_admin: 'https://mc.knowledge-vs-ai.com/',
  openclaw_gateway: 'https://gw.knowledge-vs-ai.com/',
}

const scannedRoots = [
  'src/',
  'public/',
  'docs/',
  'runtime/',
]

const ignoredPathFragments = [
  '/__tests__/',
  '.test.',
  '.spec.',
  'runtime/cloudflare-caddy-login-url-diagnosis.md',
  'runtime/official-login-url-report.md',
]

function trackedFiles() {
  return execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function shouldScan(path) {
  return scannedRoots.some((prefix) => path.startsWith(prefix))
    && !ignoredPathFragments.some((fragment) => path.includes(fragment))
}

const matches = []

for (const file of trackedFiles().filter(shouldScan)) {
  let text = ''
  try {
    text = readFileSync(file, 'utf8')
  } catch {
    continue
  }

  for (const pattern of temporaryUrlPatterns) {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(0, match.index)
      const line = before.split('\n').length
      matches.push({
        file,
        line,
        temporary_url: match[0],
      })
    }
  }
}

const report = {
  ok: matches.length === 0,
  checked_at: new Date().toISOString(),
  policy: {
    temporary_8080_urls_allowed_for_owner_facing_links: false,
    official_urls: officialUrls,
  },
  scanned_roots: scannedRoots,
  ignored_path_fragments: ignoredPathFragments,
  matches,
}

const text = JSON.stringify(report, null, 2)
if (matches.length) {
  console.error(text)
  process.exit(1)
}

console.log(text)
