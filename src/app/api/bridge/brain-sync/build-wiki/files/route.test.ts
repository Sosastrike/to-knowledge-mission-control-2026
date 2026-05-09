import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listLatestFiles: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  requireRole: mocks.requireRole,
}))

vi.mock('@/lib/build-wiki-files', () => ({
  RAW_DIR: '/home/tony/obsidian-vault/08-Wiki/OpenCloud/raw',
  WIKI_DIR: '/home/tony/obsidian-vault/08-Wiki/OpenCloud/wiki',
  isValidType: (value: unknown) => value === 'raw' || value === 'wiki',
  listLatestFiles: mocks.listLatestFiles,
  ownerSafeFileMeta: (file: Record<string, unknown>) => {
    const { full_path: _fullPath, ...rest } = file
    void _fullPath
    return { ...rest, path_ref: `buildwiki_${file.type}_file` }
  },
}))

import { GET } from './route'

function request() {
  return new Request('http://mission-control.test/api/bridge/brain-sync/build-wiki/files?type=all&limit=5', {
    method: 'GET',
  }) as NextRequest
}

describe('Build-Wiki files listing route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireRole.mockReturnValue({
      user: { id: 1, username: 'owner', role: 'admin', workspace_id: 1, tenant_id: 1 },
    })
    mocks.listLatestFiles.mockImplementation(async (type: string) => [
      {
        name: `${type}-example.md`,
        type,
        relative_path: `${type}/${type}-example.md`,
        full_path: `/home/tony/obsidian-vault/08-Wiki/OpenCloud/${type}/${type}-example.md`,
        size_bytes: 64,
        modified_at: '2026-05-09T12:00:00.000Z',
        title: `${type} example`,
        imported_at: null,
        source: '/Users/sosastrike/private/source.md',
        immutable: type === 'raw',
      },
    ])
  })

  it('lists file metadata without raw local paths or full_path fields', async () => {
    const response = await GET(request())
    const payload = await response.json()
    const serialized = JSON.stringify(payload)

    expect(response.status).toBe(200)
    expect(payload.raw.items[0].full_path).toBeUndefined()
    expect(payload.wiki.items[0].full_path).toBeUndefined()
    expect(payload.raw.items[0].path_ref).toBe('buildwiki_raw_file')
    expect(payload.wiki.items[0].path_ref).toBe('buildwiki_wiki_file')
    expect(serialized).not.toMatch(/\/home\/|\/Users\/|Bearer\s+|sk-[A-Za-z0-9_-]{16,}/)
    expect(serialized).toContain('<redacted-path>')
  })
})
