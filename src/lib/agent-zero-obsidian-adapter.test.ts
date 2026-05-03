import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getAgentZeroObsidianStatus,
  readAgentZeroObsidianNote,
  searchAgentZeroObsidianNotes,
  summarizeAgentZeroObsidianNote,
} from './agent-zero-obsidian-adapter'

function makeVault() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'az-obsidian-vault-'))
  mkdirSync(path.join(root, 'Projects'), { recursive: true })
  mkdirSync(path.join(root, '.obsidian'), { recursive: true })
  writeFileSync(
    path.join(root, 'Projects', 'Safe Test Note.md'),
    [
      '---',
      'title: Safe Test Note',
      '---',
      '# Safe Test Note',
      '',
      'This note documents the Obsidian adapter smoke test for Agent Zero.',
      'It mentions Bridge visibility and read-only access.',
      'api_key=should-not-leak',
      'Local path example: /home/tony/obsidian-vault/Private.md',
      '[[Linked Note]]',
    ].join('\n'),
  )
  writeFileSync(path.join(root, '.obsidian', 'workspace.md'), '# Hidden workspace')
  return root
}

describe('Agent Zero Obsidian read-only adapter', () => {
  it('reports vault status without enabling writes or direct filesystem exposure', () => {
    const root = makeVault()
    const status = getAgentZeroObsidianStatus(root)

    expect(status.ok).toBe(true)
    expect(status.status).toBe('connected')
    expect(status.vault_path_status).toBe('present')
    expect(status.note_count).toBe(1)
    expect(status.available_actions).toEqual(['status', 'search', 'read', 'summarize'])
    expect(status.write_enabled).toBe(false)
    expect(status.execution_enabled).toBe(false)
    expect(status.direct_filesystem_exposed).toBe(false)
  })

  it('searches safe notes and returns bounded redacted snippets with relative paths only', () => {
    const root = makeVault()
    const result = searchAgentZeroObsidianNotes({ root, query: 'Bridge adapter', limit: 5 })

    expect(result.ok).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0].title).toBe('Safe Test Note')
    expect(result.results[0].relative_path).toBe('Projects/Safe Test Note.md')
    expect(result.results[0].relative_path).not.toContain(root)
    expect(result.results[0].snippet).not.toContain('should-not-leak')
    expect(result.results[0].snippet).toContain('<redacted>')
  })

  it('reads a safe note by path or title without returning raw absolute filesystem paths', () => {
    const root = makeVault()
    const byPath = readAgentZeroObsidianNote({ root, path: 'Projects/Safe Test Note.md' })
    const byTitle = readAgentZeroObsidianNote({ root, title: 'Safe Test Note' })

    expect(byPath.ok).toBe(true)
    expect(byTitle.ok).toBe(true)
    expect(byPath.note?.relative_path).toBe('Projects/Safe Test Note.md')
    expect(byPath.note?.content_preview).toContain('read-only access')
    expect(byPath.note?.content_preview).not.toContain('should-not-leak')
    expect(byPath.note?.content_preview).not.toContain('/home/tony')
    expect(byPath.note?.content_preview).toContain('<server-local-path>')
    expect(JSON.stringify(byPath)).not.toContain(root)
    expect(byPath.write_enabled).toBe(false)
  })

  it('summarizes a safe note through the adapter and keeps writes disabled', () => {
    const root = makeVault()
    const result = summarizeAgentZeroObsidianNote({ root, title: 'Safe Test Note' })

    expect(result.ok).toBe(true)
    expect(result.summary?.title).toBe('Safe Test Note')
    expect(result.summary?.summary).toContain('Obsidian adapter smoke test')
    expect(result.write_enabled).toBe(false)
    expect(result.execution_enabled).toBe(false)
  })

  it('blocks traversal, hidden vault internals, and non-markdown targets', () => {
    const root = makeVault()
    const traversal = readAgentZeroObsidianNote({ root, path: '../secrets.md' })
    const hidden = readAgentZeroObsidianNote({ root, path: '.obsidian/workspace.md' })
    const nonMarkdown = readAgentZeroObsidianNote({ root, path: 'Projects/data.json' })

    expect(traversal.ok).toBe(false)
    expect(traversal.blockers).toContain('obsidian_path_blocked')
    expect(hidden.ok).toBe(false)
    expect(hidden.blockers).toContain('obsidian_path_blocked')
    expect(nonMarkdown.ok).toBe(false)
    expect(nonMarkdown.blockers).toContain('obsidian_note_must_be_markdown')
  })
})
