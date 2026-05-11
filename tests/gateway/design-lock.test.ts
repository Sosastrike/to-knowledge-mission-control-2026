// Locks the manifest against the on-disk mocks. If a designer changes a
// file without re-running compute-design-lock.mjs, this test fails. Per
// D6, the fix is to register the new file (with owner approval), not to
// tweak the mock so the existing hash matches.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..')
const MOCKS_ROOT = join(REPO_ROOT, 'public', 'design', 'gateway')
const MANIFEST_PATH = join(REPO_ROOT, 'design-lock', 'gateway-manifest.json')

interface ManifestEntry { path: string; bytes: number; sha256: string }
interface Manifest { schema: string; generated_at: string; base: string; file_count: number; files: ManifestEntry[] }

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir).sort()) {
    if (entry === '.DS_Store') continue
    const abs = join(dir, entry)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs))
    else out.push(abs)
  }
  return out
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

describe('design-lock manifest', () => {
  it('exists and parses', () => {
    expect(existsSync(MANIFEST_PATH)).toBe(true)
    const m: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    expect(m.schema).toBe('gateway-design-lock@1')
    expect(m.base).toBe('public/design/gateway/')
  })

  it('matches the 31 files spec exactly', () => {
    const m: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    expect(m.file_count).toBe(31)
    expect(m.files.length).toBe(31)
  })

  it('every recorded hash matches the on-disk file', () => {
    const m: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    for (const entry of m.files) {
      const abs = join(MOCKS_ROOT, entry.path)
      expect(existsSync(abs), `manifest references missing file: ${entry.path}`).toBe(true)
      const got = sha256(readFileSync(abs))
      expect(got, `hash drift for ${entry.path}`).toBe(entry.sha256)
    }
  })

  it('every on-disk file is registered (no rogue additions)', () => {
    const m: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
    const registered = new Set(m.files.map((f) => f.path))
    for (const abs of walk(MOCKS_ROOT)) {
      const rel = relative(MOCKS_ROOT, abs)
      expect(registered.has(rel), `unregistered file present: ${rel}`).toBe(true)
    }
  })
})
