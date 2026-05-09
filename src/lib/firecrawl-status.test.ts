import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { buildFirecrawlClosureSummary, getFirecrawlStatus } from './firecrawl-status'

const originalKey = process.env.FIRECRAWL_API_KEY
const tempRoots: string[] = []
const firecrawlKeyName = ['FIRECRAWL', 'API', 'KEY'].join('_')

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.FIRECRAWL_API_KEY
  } else {
    process.env.FIRECRAWL_API_KEY = originalKey
  }
  while (tempRoots.length) {
    const root = tempRoots.pop()
    if (root) rmSync(root, { recursive: true, force: true })
  }
})

function tempRootWithSdk() {
  const root = mkdtempSync(join(tmpdir(), 'mc-firecrawl-'))
  tempRoots.push(root)
  const packageDir = join(root, 'node_modules', '@mendable', 'firecrawl-js')
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(packageDir, 'package.json'), '{"name":"@mendable/firecrawl-js"}')
  return root
}

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), 'mc-firecrawl-'))
  tempRoots.push(root)
  return root
}

describe('Firecrawl closure status', () => {
  it('classifies missing credential and backend without exposing secrets or paths', () => {
    delete process.env.FIRECRAWL_API_KEY
    const status = getFirecrawlStatus(tempRoot())

    expect(status).toMatchObject({
      state: 'CREDENTIAL_REQUIRED',
      canonical_status: 'CREDENTIAL_GATED',
      blocker_class: 'CREDENTIAL_GATED',
      blocked_reason: 'firecrawl_credential_required',
      blockers: ['firecrawl_credential_required', 'firecrawl_backend_adapter_not_configured'],
      key_present: false,
      sdk_loaded: false,
    })
    expect(status.proof_packet).toMatchObject({
      lane: 'SpaceAgent Firecrawl',
      result: 'CREDENTIAL_GATED',
      credential_present: false,
      backend_adapter_present: false,
      read_only_smoke_allowed: false,
      write_execution_enabled: false,
      broad_crawl_enabled: false,
      public_exposure: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    expect(JSON.stringify(status)).not.toMatch(/fc-[A-Za-z0-9]{20,}|FIRECRAWL_API_KEY=|\/home\/tony|\/Users\/sosastrike/i)
  })

  it('marks backend missing when credential exists but SDK is absent', () => {
    process.env[firecrawlKeyName] = 'present-for-test-only'
    const status = getFirecrawlStatus(tempRoot())

    expect(status).toMatchObject({
      state: 'BACKEND_REQUIRED',
      canonical_status: 'SERVICE_DOWN',
      blocker_class: 'SERVICE_DOWN',
      blocked_reason: 'firecrawl_backend_adapter_not_configured',
      blockers: ['firecrawl_backend_adapter_not_configured'],
      key_present: true,
      sdk_loaded: false,
    })
    expect(JSON.stringify(status)).not.toContain('present-for-test-only')
  })

  it('allows only read-only smoke readiness when credential and SDK are present', () => {
    process.env[firecrawlKeyName] = 'present-for-test-only'
    const root = tempRootWithSdk()
    const status = getFirecrawlStatus(root)

    expect(status).toMatchObject({
      state: 'LIVE',
      canonical_status: 'READY',
      blocker_class: 'NONE',
      blocked_reason: null,
      blockers: [],
      key_present: true,
      sdk_loaded: true,
    })
    expect(status.proof_packet).toMatchObject({
      read_only_smoke_allowed: true,
      write_execution_enabled: false,
      broad_crawl_enabled: false,
    })
  })

  it('builds a standalone closure packet for reports', () => {
    expect(buildFirecrawlClosureSummary({
      keyPresent: false,
      sdkLoaded: true,
      timestamp: '2026-05-09T00:00:00.000Z',
    })).toMatchObject({
      canonical_status: 'CREDENTIAL_GATED',
      blocker_class: 'CREDENTIAL_GATED',
      blocked_reason: 'firecrawl_credential_required',
      proof_packet: {
        timestamp: '2026-05-09T00:00:00.000Z',
        credential_present: false,
        backend_adapter_present: true,
      },
    })
  })
})
