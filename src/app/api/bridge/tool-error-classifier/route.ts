import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import {
  classifyToolErrors,
  TOOL_ERROR_KINDS,
  type ToolErrorClassifierInput,
} from '@/lib/tool-error-classifier'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function toClassifierInput(value: unknown): ToolErrorClassifierInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  const context = record.context && typeof record.context === 'object' && !Array.isArray(record.context)
    ? record.context as ToolErrorClassifierInput['context']
    : undefined
  return {
    http_status: typeof record.http_status === 'number' ? record.http_status : null,
    message: typeof record.message === 'string' ? record.message : null,
    technical_detail: typeof record.technical_detail === 'string' ? record.technical_detail : null,
    hint: typeof record.hint === 'string' ? record.hint : null,
    context,
  }
}

function bodyToInputs(body: Record<string, unknown>): ToolErrorClassifierInput[] {
  if (Array.isArray(body.errors)) return body.errors.map(toClassifierInput)
  return [toClassifierInput(body)]
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return jsonResponse({ ok: false, error: auth.error }, auth.status)

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const classifications = classifyToolErrors(bodyToInputs(body))

  return jsonResponse({
    ok: true,
    mode: 'tool_error_classification',
    allowed_error_kinds: TOOL_ERROR_KINDS,
    classifications,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_external_writes: true,
    no_secret_output: true,
    next_action: 'Render the canonical owner_message and next_action instead of raw tool errors.',
  })
}
