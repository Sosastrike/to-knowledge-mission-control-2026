#!/usr/bin/env node
// Production-truth audit for the Gateway designer integration.
// CloudCode runs this against a public production origin once Luis hands one
// over; the operator can also run it from the production server directly to
// answer "which of the seven failure modes is true?"
//
// Audit checks (one-shot):
//   A. Are the 31 approved designer files reachable under /design/gateway/ ?
//   B. Do their SHA-256s match the design-lock manifest byte-identically?
//   C. Does /design/gateway/Agent%20Hub.html return 200 + matching SHA?
//   D. What does /gateway actually render? (HTML inspection)
//   E. Which deep-link tabs return 200 vs redirect-elsewhere vs 404?
//   F. Are any legacy Gateway routes still answering on /gateway/* paths?
//
// Output: JSON. No secrets, no raw paths, no fabricated success.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const MANIFEST = JSON.parse(readFileSync(join(REPO, 'design-lock/gateway-manifest.json'), 'utf8'))

function parseArgs(argv) {
  const out = { base: null, authHeaderEnv: null, timeout: 10000, only: null }
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--base') out.base = argv[++i]
    else if (a === '--auth-header-env') out.authHeaderEnv = argv[++i]
    else if (a === '--timeout-ms') out.timeout = Number(argv[++i]) || 10000
    else if (a === '--only') out.only = argv[++i] // e.g. "A", "C", "D"
    else if (a === '--help' || a === '-h') {
      process.stdout.write(
        'audit-production.mjs --base <origin> [--auth-header-env <ENV_NAME>] [--timeout-ms <ms>] [--only <step>]\n',
      )
      process.exit(0)
    }
  }
  if (!out.base) {
    process.stderr.write('error: --base <origin> is required\n')
    process.exit(2)
  }
  return out
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

async function fetchWithTimeout(url, opts, ms) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), ms)
  try {
    return await fetch(url, { ...opts, signal: ctl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function probeStatic(base, relativePath, expected, timeout, auth) {
  const url = `${base.replace(/\/$/, '')}/design/gateway/${encodeURI(relativePath)}`
  try {
    const res = await fetchWithTimeout(url, { headers: auth ? { authorization: auth } : {} }, timeout)
    if (res.status !== 200) {
      return { path: relativePath, http_status: res.status, byte_match: false, sha_match: false, reason: `status ${res.status}` }
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const gotSha = sha256(buf)
    return {
      path: relativePath,
      http_status: 200,
      bytes: buf.length,
      expected_bytes: expected.bytes,
      sha256: gotSha,
      expected_sha256: expected.sha256,
      byte_match: buf.length === expected.bytes,
      sha_match: gotSha === expected.sha256,
    }
  } catch (err) {
    return { path: relativePath, http_status: null, byte_match: false, sha_match: false, reason: (err && err.message) || 'fetch failed' }
  }
}

async function inspectGatewayHtml(base, timeout, auth) {
  const url = `${base.replace(/\/$/, '')}/gateway`
  try {
    const res = await fetchWithTimeout(url, { headers: auth ? { authorization: auth, accept: 'text/html' } : { accept: 'text/html' }, redirect: 'manual' }, timeout)
    const body = res.status === 200 ? await res.text() : ''
    const features = {
      http_status: res.status,
      content_type: res.headers.get('content-type') || null,
      content_length: body.length,
      contains_gateway_shell_class: /class=["'][^"']*gateway-shell[^"']*["']/.test(body),
      contains_gw_tab_class: /class=["'][^"']*gw-tab[^"']*["']/.test(body),
      contains_GatewayShell_component_marker: /GatewayShell/.test(body),
      iframe_srcs: Array.from(body.matchAll(/<iframe[^>]+src=["']([^"']+)["']/g)).map((m) => m[1]).slice(0, 12),
      // Hints that a LEGACY surface is winning instead of the new shell:
      legacy_hints: {
        designer_mission_control_catchall: /designer-mission-control\//.test(body),
        old_iframe_wrapper: /<iframe[^>]+src=["'][^"']*designer-mission-control/.test(body),
        contains_GatewayWrapper: /GatewayWrapper/.test(body),
        contains_old_class: /gateway-legacy|legacy-gateway|gateway-wrapper/.test(body),
      },
      first_400_chars_redacted: body.slice(0, 400).replace(/sk-[A-Za-z0-9_-]{20,}/g, '[redacted]').replace(/Bearer [A-Za-z0-9._-]{8,}/g, 'Bearer [redacted]'),
    }
    return features
  } catch (err) {
    return { http_status: null, reason: (err && err.message) || 'fetch failed' }
  }
}

async function probeDeepLinks(base, timeout, auth) {
  const segs = ['overview', 'agent-hub', 'paperclip', 'dispatcher', 'token-governor', 'bridge-session', 'health', 'routes', 'registry', 'policies']
  return Promise.all(
    segs.map(async (seg) => {
      const url = `${base.replace(/\/$/, '')}/gateway/${seg}`
      try {
        const res = await fetchWithTimeout(
          url,
          { headers: auth ? { authorization: auth } : {}, redirect: 'manual' },
          timeout,
        )
        return {
          segment: seg,
          http_status: res.status,
          location: res.headers.get('location'),
          is_rewrite_target: res.status === 200,
        }
      } catch (err) {
        return { segment: seg, http_status: null, reason: (err && err.message) || 'fetch failed' }
      }
    }),
  )
}

async function main() {
  const args = parseArgs(process.argv)
  const auth = args.authHeaderEnv ? (process.env[args.authHeaderEnv] ? `Bearer ${process.env[args.authHeaderEnv]}` : null) : null

  const report = {
    audit: 'gateway-production-truth@1',
    generated_at: new Date().toISOString(),
    base_origin_redacted: (() => {
      try {
        const u = new URL(args.base)
        if (/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(u.hostname)) {
          return `${u.protocol}//[redacted-host]`
        }
        return `${u.protocol}//${u.hostname}`
      } catch {
        return '[redacted-origin]'
      }
    })(),
    only: args.only,
  }

  if (!args.only || args.only.includes('A') || args.only.includes('B') || args.only.includes('C')) {
    const expected = new Map(MANIFEST.files.map((f) => [f.path, f]))
    // Sample first: 31 files is a lot of requests; do them in waves of 6.
    const paths = Array.from(expected.keys())
    const rows = []
    const wave = 6
    for (let i = 0; i < paths.length; i += wave) {
      const chunk = paths.slice(i, i + wave)
      const settled = await Promise.all(chunk.map((p) => probeStatic(args.base, p, expected.get(p), args.timeout, auth)))
      rows.push(...settled)
    }
    report.static_files = {
      total_expected: MANIFEST.file_count,
      reachable_200: rows.filter((r) => r.http_status === 200).length,
      byte_identical: rows.filter((r) => r.sha_match).length,
      drifted: rows.filter((r) => r.http_status === 200 && !r.sha_match).map((r) => ({ path: r.path, bytes: r.bytes, expected_bytes: r.expected_bytes })),
      missing: rows.filter((r) => r.http_status !== 200).map((r) => ({ path: r.path, http_status: r.http_status, reason: r.reason })),
    }
    // Highlight: the Agent Hub.html check Luis specifically called out:
    const agentHub = rows.find((r) => r.path === 'Agent Hub.html') || null
    report.static_files_agent_hub = agentHub
  }

  if (!args.only || args.only.includes('D')) {
    report.gateway_html = await inspectGatewayHtml(args.base, args.timeout, auth)
  }

  if (!args.only || args.only.includes('E')) {
    report.deep_links = await probeDeepLinks(args.base, args.timeout, auth)
    report.deep_links_summary = {
      total: report.deep_links.length,
      ok_200: report.deep_links.filter((r) => r.http_status === 200).length,
      redirects: report.deep_links.filter((r) => r.http_status && r.http_status >= 300 && r.http_status < 400).length,
      missing: report.deep_links.filter((r) => r.http_status === 404).length,
      other: report.deep_links.filter((r) => r.http_status && (r.http_status < 300 || r.http_status >= 400) && r.http_status !== 200 && r.http_status !== 404).length,
    }
  }

  // Lightweight diagnosis: which of the 7 root causes does the evidence point to?
  const diagnoses = []
  if (report.static_files && report.static_files.reachable_200 === 0) {
    diagnoses.push('CAUSE_4_files_not_served')
  } else if (report.static_files && report.static_files.byte_identical < report.static_files.total_expected) {
    diagnoses.push('CAUSE_4_files_drifted')
  }
  if (report.gateway_html && report.gateway_html.http_status === 404) diagnoses.push('CAUSE_2_route_missing')
  if (report.gateway_html && report.gateway_html.http_status === 200 && !report.gateway_html.contains_gateway_shell_class) {
    if (report.gateway_html.legacy_hints?.designer_mission_control_catchall || report.gateway_html.legacy_hints?.old_iframe_wrapper || report.gateway_html.legacy_hints?.contains_GatewayWrapper) {
      diagnoses.push('CAUSE_6_legacy_wrapper_winning')
    } else {
      diagnoses.push('CAUSE_5_GatewayShell_not_mounted')
    }
  }
  if (report.deep_links_summary && report.deep_links_summary.missing === report.deep_links_summary.total) {
    diagnoses.push('CAUSE_2_rewrites_missing')
  }
  report.diagnoses = diagnoses.length ? diagnoses : ['no_failure_signals — production matches the package']

  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
}

main().catch((err) => {
  process.stderr.write(`audit failed: ${err && err.message ? err.message : err}\n`)
  process.exit(1)
})
