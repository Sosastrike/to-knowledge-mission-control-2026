import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

describe('owner-facing copy polish', () => {
  it('keeps designer shell copy free of developer wiring language and raw exception details', () => {
    const files = [
      'public/designer-mission-control/src/settings-pages.jsx',
      'public/designer-mission-control/src/ops-intel.jsx',
      'public/designer-mission-control/src/meetings-integrations.jsx',
      'public/designer-mission-control/src/meeting-lobby.jsx',
    ]

    for (const file of files) {
      const source = read(file)
      expect(source, file).not.toMatch(/\bnot wired\b/i)
      expect(source, file).not.toMatch(/\bbackend not wired\b/i)
      expect(source, file).not.toMatch(/\bneeds\s+(GET|POST|backend|getUserMedia)/i)
      expect(source, file).not.toMatch(/detail:\s*e\.message/)
      expect(source, file).not.toMatch(/\$\{e\.message/)
    }
  })

  it('uses owner-facing route missing language in the shared error classifier', () => {
    const source = read('src/lib/tool-error-classifier.ts')
    expect(source).not.toContain('This route is not wired yet.')
    expect(source).toContain('This route is not available in this Mission Control runtime.')
  })
})
