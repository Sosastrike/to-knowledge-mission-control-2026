import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Mission Control root account control', () => {
  it('mounts the authenticated account control from the root layout', () => {
    const layoutSource = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')

    expect(layoutSource).toContain('MissionControlSessionMenu')
    expect(layoutSource).toContain('mc-global-session-control')
    expect(layoutSource).toContain('hideWhenSignedOut')
  })
})
