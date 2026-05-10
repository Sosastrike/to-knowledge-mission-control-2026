import { describe, expect, it } from 'vitest'
import {
  classifyToolError,
  classifyToolErrors,
  TOOL_ERROR_KINDS,
} from './tool-error-classifier'

describe('tool error classifier', () => {
  it.each([
    [{ http_status: 401 }, 'AUTH_REQUIRED'],
    [{ http_status: 403 }, 'OWNER_GATED'],
    [{ http_status: 404 }, 'ROUTE_MISSING'],
    [{ http_status: 423 }, 'OWNER_GATED'],
    [{ http_status: 503 }, 'SERVICE_DOWN'],
    [{ message: 'missing FIRECRAWL_API_KEY' }, 'CREDENTIAL_GATED'],
    [{ message: 'connect ECONNREFUSED on upstream' }, 'SERVICE_DOWN'],
    [{ message: 'adapter not implemented yet' }, 'BACKEND_MISSING'],
    [{ context: { execution_enabled: false } }, 'EXECUTION_DISABLED'],
    [{ context: { writes_enabled: false }, message: 'writes disabled in read-only mode' }, 'WRITE_DISABLED'],
    [{ context: { external_writes_enabled: false }, message: 'external write disabled' }, 'EXTERNAL_WRITE_DISABLED'],
  ] as const)('classifies %j as %s', (input, kind) => {
    const result = classifyToolError(input)

    expect(result.kind).toBe(kind)
    expect(TOOL_ERROR_KINDS).toContain(result.kind)
    expect(result.owner_message.length).toBeGreaterThan(0)
    expect(result.next_action.length).toBeGreaterThan(0)
  })

  it('redacts secrets, auth files, private hosts, and raw local paths', () => {
    const result = classifyToolError({
      message: 'failed reading /Users/sosastrike/.env with API_KEY=secret-value and Bearer abcdefghijklmnop at http://127.0.0.1:9999/auth.json',
      technical_detail: 'sk-redactplaceholder in /home/tony/private',
    })
    const serialized = JSON.stringify(result)

    expect(serialized).not.toContain('secret-value')
    expect(serialized).not.toContain('abcdefghijklmnop')
    expect(serialized).not.toContain('sk-redactplaceholder')
    expect(serialized).not.toContain('/Users/sosastrike')
    expect(serialized).not.toContain('/home/tony')
    expect(serialized).not.toContain('127.0.0.1')
    expect(serialized).not.toContain('auth.json')
  })

  it('dedupes repeated errors by canonical kind and owner message', () => {
    const results = classifyToolErrors([
      { http_status: 404 },
      { message: 'route missing' },
      { http_status: 401 },
    ])

    expect(results.map((result) => result.kind)).toEqual(['ROUTE_MISSING', 'AUTH_REQUIRED'])
  })
})
