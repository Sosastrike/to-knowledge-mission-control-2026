import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

const OWNER_VISIBLE_FILES = [
  'public/designer-mission-control/src/app.jsx',
  'public/designer-mission-control/src/backend/api-client.jsx',
  'public/designer-mission-control/src/brain-sync.jsx',
  'public/designer-mission-control/src/credentials-page.jsx',
  'public/designer-mission-control/src/settings.jsx',
  'public/designer-mission-control/src/surfaces.jsx',
  'public/designer-mission-control/src/replicas/EmailProfilesPage.jsx',
  'src/app/api/bridge/approval-requests/route.ts',
  'src/app/api/bridge/owner-gates/route.ts',
  'src/app/api/firecrawl/[[...path]]/route.ts',
  'src/lib/monitoring-failure-states.ts',
]

function readWithoutComments(file: string): string {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\splaceholder=\{[^}]*\}/g, '')
    .replace(/\splaceholder="[^"]*"/g, '')
}

describe('no fake UI final sweep', () => {
  it('keeps owner-visible UI and status payloads free of fake/wiring residue', () => {
    const banned = [
      /\bnot wired\b/i,
      /\bapi not wired\b/i,
      /\bbackend not wired\b/i,
      /\bnot implemented\b/i,
      /\bcopied placeholder\b/i,
      /\bqueue placeholder\b/i,
      /\bplaceholder is visible\b/i,
      /\bread_only_stub\b/i,
      /\bprotected-action stubs\b/i,
      /\bcoming soon\b/i,
      /\bADMIN WIRE-UP\b/i,
    ]

    for (const file of OWNER_VISIBLE_FILES) {
      const source = readWithoutComments(file)
      for (const pattern of banned) {
        expect(source, `${file} contains ${pattern}`).not.toMatch(pattern)
      }
    }
  })
})
