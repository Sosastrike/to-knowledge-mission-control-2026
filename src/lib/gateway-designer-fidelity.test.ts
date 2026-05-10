import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

describe('Gateway designer fidelity contract', () => {
  it('mounts the accepted Agent Hub HTML without production-side edits', () => {
    const accepted = readSource('design/gateway/Agent Hub.html')
    const mounted = readSource('public/designer-mission-control/design/gateway/Agent Hub.html')

    expect(mounted).toBe(accepted)
  })

  it('mounts the accepted Paperclip HTML without production-side edits', () => {
    const accepted = readSource('design/gateway/paperclip-v1/Paperclip.html')
    const mounted = readSource('public/designer-mission-control/design/gateway/Paperclip.html')

    expect(mounted).toBe(accepted)
  })
})
