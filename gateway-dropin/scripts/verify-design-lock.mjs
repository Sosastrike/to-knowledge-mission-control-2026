#!/usr/bin/env node
// Verify that every file under public/design/gateway/ still matches the
// hash recorded in design-lock/gateway-manifest.json. Exit non-zero if a
// hash drifts, a file is missing, or a new file appears unregistered.
// CI gate. Owner-unlock workflow (per the Design Lock Rule) must rerun
// compute-design-lock.mjs and review the diff before re-recording.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..')
const MOCKS_ROOT = join(REPO_ROOT, 'public', 'design', 'gateway')
const MANIFEST_PATH = join(REPO_ROOT, 'design-lock', 'gateway-manifest.json')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir).sort()) {
    if (entry === '.DS_Store') continue
    const abs = join(dir, entry)
    const st = statSync(abs)
    if (st.isDirectory()) out.push(...walk(abs))
    else out.push(abs)
  }
  return out
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function main() {
  if (!existsSync(MANIFEST_PATH)) {
    process.stderr.write('design-lock/gateway-manifest.json missing — run compute-design-lock.mjs once first\n')
    process.exit(2)
  }
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const expected = new Map(manifest.files.map((e) => [e.path, e.sha256]))

  const seen = new Set()
  const drifts = []
  for (const abs of walk(MOCKS_ROOT)) {
    const rel = relative(MOCKS_ROOT, abs)
    seen.add(rel)
    const want = expected.get(rel)
    const got = sha256(readFileSync(abs))
    if (!want) {
      drifts.push({ kind: 'unregistered', path: rel, got })
    } else if (want !== got) {
      drifts.push({ kind: 'drift', path: rel, want, got })
    }
  }
  for (const [rel, want] of expected) {
    if (!seen.has(rel)) drifts.push({ kind: 'missing', path: rel, want })
  }

  if (drifts.length === 0) {
    process.stdout.write(`design-lock OK: ${manifest.file_count} files match manifest\n`)
    process.exit(0)
  }
  process.stderr.write(`design-lock FAILED: ${drifts.length} discrepancies\n`)
  for (const d of drifts) {
    process.stderr.write(JSON.stringify(d) + '\n')
  }
  process.exit(1)
}

main()
