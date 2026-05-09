import { describe, expect, it } from 'vitest'
import { normalizeStatusLabel, rollupStatuses } from '../label-map.js'
import { CANONICAL_STATUSES, isCanonicalStatus } from '../types.js'

describe('normalizeStatusLabel', () => {
  it('returns identity for canonical labels', () => {
    for (const s of CANONICAL_STATUSES) {
      expect(normalizeStatusLabel(s)).toBe(s)
    }
  })

  it('maps existing connector vocabulary into canonical labels', () => {
    expect(normalizeStatusLabel('BACKEND_REQUIRED')).toBe('BLOCKED')
    expect(normalizeStatusLabel('CREDENTIAL_REQUIRED')).toBe('CREDENTIAL_GATED')
    expect(normalizeStatusLabel('OWNER_APPROVAL_REQUIRED')).toBe('OWNER_GATED')
  })

  it('maps BuildWiki ui_state strings', () => {
    expect(normalizeStatusLabel('pending_approval')).toBe('OWNER_GATED')
    expect(normalizeStatusLabel('running')).toBe('LIVE')
    expect(normalizeStatusLabel('denied')).toBe('BLOCKED')
    expect(normalizeStatusLabel('failed')).toBe('DEGRADED')
    expect(normalizeStatusLabel('completed')).toBe('READY')
  })

  it('returns UNKNOWN for unmapped, null, or empty values', () => {
    expect(normalizeStatusLabel(null)).toBe('UNKNOWN')
    expect(normalizeStatusLabel(undefined)).toBe('UNKNOWN')
    expect(normalizeStatusLabel('')).toBe('UNKNOWN')
    expect(normalizeStatusLabel('something_we_have_never_seen')).toBe('UNKNOWN')
    expect(normalizeStatusLabel(42 as unknown as string)).toBe('UNKNOWN')
  })

  it('outputs are always canonical', () => {
    const inputs = ['LIVE', 'BACKEND_REQUIRED', 'foo', 'pending_approval', null, '']
    for (const i of inputs) {
      expect(isCanonicalStatus(normalizeStatusLabel(i))).toBe(true)
    }
  })
})

describe('rollupStatuses', () => {
  it('returns UNKNOWN on empty input', () => {
    expect(rollupStatuses([])).toBe('UNKNOWN')
  })

  it('LIVE rolls up to LIVE if everything is LIVE', () => {
    expect(rollupStatuses(['LIVE', 'LIVE'])).toBe('LIVE')
  })

  it('any DEGRADED outranks READY', () => {
    expect(rollupStatuses(['READY', 'DEGRADED'])).toBe('DEGRADED')
  })

  it('SERVICE_DOWN beats DEGRADED', () => {
    expect(rollupStatuses(['DEGRADED', 'SERVICE_DOWN'])).toBe('SERVICE_DOWN')
  })

  it('UNKNOWN only wins when everyone is UNKNOWN', () => {
    expect(rollupStatuses(['UNKNOWN', 'READY'])).toBe('READY')
    expect(rollupStatuses(['UNKNOWN', 'UNKNOWN'])).toBe('UNKNOWN')
  })

  it('OWNER_GATED outranks READY but not BLOCKED', () => {
    expect(rollupStatuses(['READY', 'OWNER_GATED'])).toBe('OWNER_GATED')
    expect(rollupStatuses(['OWNER_GATED', 'BLOCKED'])).toBe('BLOCKED')
  })
})
