import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  getAgentZeroObsidianStatus,
  appendAgentZeroObsidianReportSummary,
  createAgentZeroObsidianNote,
  linkAgentZeroObsidianNoteToTaskReport,
  readAgentZeroObsidianNote,
  searchAgentZeroObsidianNotes,
  summarizeAgentZeroObsidianNote,
  tagAgentZeroObsidianNote,
  updateAgentZeroObsidianNote,
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

  it('creates and updates notes through safe relative markdown paths only', () => {
    const root = makeVault()
    const created = createAgentZeroObsidianNote({
      root,
      path: 'Agent Zero/New Capability Note.md',
      title: 'New Capability Note',
      content: 'Agent Zero can write only through the Bridge adapter. token=do-not-leak',
      tags: ['agent-zero', 'Bridge Session'],
    })

    expect(created.ok).toBe(true)
    expect(created.note?.relative_path).toBe('Agent Zero/New Capability Note.md')
    expect(created.note?.relative_path).not.toContain(root)
    expect(created.direct_filesystem_exposed).toBe(false)
    expect(created.raw_content_returned).toBe(false)
    expect(JSON.stringify(created)).not.toContain('/tmp/')

    const read = readAgentZeroObsidianNote({ root, path: 'Agent Zero/New Capability Note.md' })
    expect(read.note?.content_preview).toContain('<redacted>')

    const updated = updateAgentZeroObsidianNote({
      root,
      path: 'Agent Zero/New Capability Note.md',
      title: 'Updated Capability Note',
      content: 'Updated safely through the adapter.',
    })
    expect(updated.ok).toBe(true)
    expect(readFileSync(path.join(root, 'Agent Zero', 'New Capability Note.md'), 'utf8')).toContain('Updated safely through the adapter.')
  })

  it('appends report summaries, tags notes, and links notes to task/report metadata without dumping private content', () => {
    const root = makeVault()
    const appended = appendAgentZeroObsidianReportSummary({
      root,
      path: 'Projects/Safe Test Note.md',
      reportId: 'azr_test_123',
      summary: 'The release report summary is ready. /home/tony/private/path.md',
    })
    expect(appended.ok).toBe(true)
    expect(JSON.stringify(appended)).not.toContain('/home/tony')

    const tagged = tagAgentZeroObsidianNote({
      root,
      path: 'Projects/Safe Test Note.md',
      tags: ['agent-zero', '#release-proof', '../bad'],
    })
    expect(tagged.ok).toBe(true)
    expect(tagged.note?.tags).toContain('agent-zero')
    expect(tagged.note?.tags).toContain('release-proof')
    expect(tagged.note?.tags).not.toContain('../bad')

    const linked = linkAgentZeroObsidianNoteToTaskReport({
      root,
      path: 'Projects/Safe Test Note.md',
      taskId: 'task-123',
      reportId: 'azr_test_123',
      linkTitle: 'Release Report',
    })
    expect(linked.ok).toBe(true)
    expect(linked.private_dump_returned).toBe(false)

    const content = readFileSync(path.join(root, 'Projects', 'Safe Test Note.md'), 'utf8')
    expect(content).toContain('Agent Zero Report Summary')
    expect(content).toContain('<server-local-path>')
    expect(content).toContain('[[Release Report]]')
  })

  it('blocks unsafe write paths and create-overwrite attempts', () => {
    const root = makeVault()
    const traversal = createAgentZeroObsidianNote({ root, path: '../bad.md', content: 'bad' })
    const hidden = createAgentZeroObsidianNote({ root, path: '.obsidian/bad.md', content: 'bad' })
    const overwrite = createAgentZeroObsidianNote({ root, path: 'Projects/Safe Test Note.md', content: 'bad' })

    expect(traversal.ok).toBe(false)
    expect(traversal.blockers).toContain('obsidian_path_blocked')
    expect(hidden.ok).toBe(false)
    expect(hidden.blockers).toContain('obsidian_path_blocked')
    expect(overwrite.ok).toBe(false)
    expect(overwrite.blockers).toContain('obsidian_note_already_exists')
  })
})
