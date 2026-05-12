import {
  classifyToolError,
  type ClassifiedToolError,
  type ToolErrorClassifierInput,
} from './tool-error-classifier'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

function httpStatusFromText(value: string | null): number | undefined {
  const match = value?.match(/\b(?:HTTP\s*)?([1-5]\d{2})\b/i)
  if (!match) return undefined
  const status = Number(match[1])
  return Number.isFinite(status) ? status : undefined
}

function classifierMessage(status: number | undefined, message: string | null, fallback: string): string | null {
  if (status === 502 || status === 503 || status === 504) return `HTTP ${status} service unreachable`
  return message || fallback
}

export function ownerFacingError(input: unknown, fallback = 'Unknown owner-facing error'): ClassifiedToolError {
  if (!input) return classifyToolError({ message: fallback })

  if (input instanceof Error) {
    const record = input as Error & {
      status?: number
      code?: string
      body?: unknown
      detail?: string
    }
    const body = isRecord(record.body) ? record.body : {}
    const message = firstString(record.message, record.code, body.message, body.error, fallback)
    const status = typeof record.status === 'number' ? record.status : httpStatusFromText(message)
    return classifyToolError({
      http_status: status,
      message: classifierMessage(status, message, fallback),
      technical_detail: firstString(record.detail, record.stack, body.detail, body.error_description, record.message, fallback),
    })
  }

  if (isRecord(input)) {
    const body = isRecord(input.body) ? input.body : {}
    const context = isRecord(input.context) ? input.context as ToolErrorClassifierInput['context'] : undefined
    const message = firstString(input.message, input.error, input.code, body.message, body.error, fallback)
    const status = typeof input.http_status === 'number'
      ? input.http_status
      : typeof input.status === 'number'
        ? input.status
        : httpStatusFromText(message)
    return classifyToolError({
      http_status: status,
      message: classifierMessage(status, message, fallback),
      technical_detail: firstString(input.technical_detail, input.detail, body.detail, body.error_description, input.message, fallback),
      hint: firstString(input.hint, input.next_action),
      context,
    })
  }

  const message = firstString(input, fallback)
  const status = httpStatusFromText(message)
  return classifyToolError({ http_status: status, message: classifierMessage(status, message, fallback) })
}

export function ownerFacingErrorText(input: unknown, fallback?: string): string {
  const classified = ownerFacingError(input, fallback)
  return `${classified.kind}: ${classified.owner_message} Next: ${classified.next_action}`
}

export function ownerSafeText(value: unknown): string {
  return ownerFacingError({ message: String(value ?? '') }).technical_detail
}
