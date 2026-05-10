import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { evaluateHeyGenSchemaReadiness } from '@/lib/heygen-schema-readiness'
import { getZapierToolBridge } from '@/lib/zapier-tool-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function payloadFromBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const record = body as Record<string, unknown>
  const nested = record.payload
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as Record<string, unknown>
  }
  return record
}

async function readiness(payload?: Record<string, unknown> | null) {
  const zapier = await getZapierToolBridge('heygen')
  const result = evaluateHeyGenSchemaReadiness({ zapier, payload })
  return {
    ...result,
    endpoint: '/api/bridge/heygen/schema-readiness',
    method: payload === undefined ? 'GET' : 'POST',
    note: 'Read-only HeyGen schema readiness. No HeyGen or Zapier tool is invoked.',
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

  return jsonResponse(await readiness())
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return jsonResponse({ error: auth.error }, auth.status)

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  return jsonResponse(await readiness(payloadFromBody(body)))
}
