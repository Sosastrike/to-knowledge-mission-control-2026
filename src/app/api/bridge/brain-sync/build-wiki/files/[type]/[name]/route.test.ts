import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  readFileSafe: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/build-wiki-files', () => ({
  isValidFilename: (name: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}\.md$/.test(name),
  isValidType: (value: unknown) => value === 'raw' || value === 'wiki',
  ownerSafeFileContent: (file: Record<string, unknown>) => {
    const { full_path: _fullPath, ...rest } = file
    void _fullPath
    return { ...rest, path_ref: `buildwiki_${file.type}_file` }
  },
  readFileSafe: mocks.readFileSafe,
}))

import { GET } from './route'

function request() {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/files/raw/example.md', {
    method: 'GET',
  }) as NextRequest
}

describe('Build-Wiki file read route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
  })

  it('does not expose raw local paths or secret-like values in owner-facing file responses', async () => {
    mocks.readFileSafe.mockResolvedValue({
      name: 'example.md',
      type: 'raw',
      relative_path: 'raw/example.md',
      full_path: '/home/tony/obsidian-vault/08-Wiki/OpenCloud/raw/example.md',
      size_bytes: 128,
      modified_at: '2026-05-09T12:00:00.000Z',
      title: 'Example',
      imported_at: '2026-05-09T12:00:00.000Z',
      source: '/Users/sosastrike/private/source.md',
      immutable: true,
      content: `Owner note references /home/tony/private and ${'Bearer'} sample-token-value-1234567890`,
      content_truncated: false,
      secrets_present: false,
      secrets_redactions: [],
      scan_warnings: [],
    })

    const response = await GET(request(), {
      params: Promise.resolve({ type: 'raw', name: 'example.md' }),
    })
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(payload.file.full_path).toBeUndefined()
    expect(payload.file.path_ref).toBe('buildwiki_raw_file')
    expect(serialized).not.toMatch(/\/home\/|\/Users\/|Bearer\s+sample-token|sk-[A-Za-z0-9_-]{16,}/)
    expect(serialized).toContain('<redacted-path>')
    expect(serialized).toContain('<redacted-secret>')
  })
})
