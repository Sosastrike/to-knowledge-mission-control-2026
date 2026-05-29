import { NextRequest } from 'next/server'

import { buildRonRuntimeProof } from '@/lib/ron-runtime-proof'
import { authRequired, readOnly } from '@/lib/mission-control-contracts'
import { runRonMissionControlProxyProof } from '@/lib/ron-proxy-proof'
import { mutationLimiter } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requestBody(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const parsed = await request.json().catch(() => ({}))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  }
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    if (!form) return {}
    return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]))
  }
  return {}
}

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  return readOnly(await buildRonRuntimeProof())
}

export async function POST(request: NextRequest) {
  const auth = authRequired(request, 'operator')
  if (auth) return auth

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  const body = await requestBody(request)
  if (body.action !== 'run_mission_control_proxy_proof') {
    return Response.json({
      ok: false,
      error: 'unsupported_runtime_proof_action',
      expected_action: 'run_mission_control_proxy_proof',
      execution_enabled: false,
      writes_enabled: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
    }, { status: 400 })
  }

  const result = await runRonMissionControlProxyProof(request, {
    persist: body.persist === false || body.persist === 'false' ? false : undefined,
  })
  return Response.json(result, { status: result.ok ? 200 : 424 })
}
