#!/usr/bin/env node
// Compute SHA-256 hashes for every file under public/design/gateway/ and
// write the manifest to design-lock/gateway-manifest.json. Run this once
// at integration time. The resulting manifest must be checked in.
//
// To re-verify (after deploy / during CI), use verify-design-lock.mjs —
// it fails non-zero if any hash drifts. NEVER edit the mock files to make
// hashes pass; per D6, register the approved files as-is.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
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
  const files = walk(MOCKS_ROOT)
  const entries = files.map((abs) => {
    const data = readFileSync(abs)
    return {
      path: relative(MOCKS_ROOT, abs),
      bytes: data.length,
      sha256: sha256(data),
    }
  })
  const manifest = {
    schema: 'gateway-design-lock@1',
    generated_at: new Date().toISOString(),
    base: 'public/design/gateway/',
    file_count: entries.length,
    files: entries,
  }
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  process.stdout.write(`wrote ${entries.length} entries to design-lock/gateway-manifest.json\n`)
}

main()
