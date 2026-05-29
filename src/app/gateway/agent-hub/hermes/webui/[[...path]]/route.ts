import { NextRequest, NextResponse } from 'next/server'

import {
  buildHermesWebUiProxyRequestHeaders,
  buildHermesWebUiProxyResponseHeaders,
  buildHermesWebUiProxyTarget,
  hermesWebUiUnavailableHtml,
  repairHermesWebUiChatStartBody,
} from '@/lib/hermes-webui-proxy'
import { authRequired } from '@/lib/mission-control-contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = {
  params: Promise<{ path?: string[] }>
}

async function proxyHermesWebUi(request: NextRequest, context: Params) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const { path = [] } = await context.params
  const target = buildHermesWebUiProxyTarget(path, request.nextUrl.search)
  if (!target.ok || !target.target) {
    return NextResponse.json({
      ok: false,
      state: 'BLOCKED',
      blocker: target.blocker,
      execution_enabled: false,
      writes_enabled: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      public_exposure_created: false,
    }, { status: 503 })
  }

  const method = request.method.toUpperCase()
  const headers = buildHermesWebUiProxyRequestHeaders(request)
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers,
    redirect: 'manual',
    cache: 'no-store',
  }

  if (!['GET', 'HEAD'].includes(method)) {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.toLowerCase().includes('application/json')) {
      const parsedBody = await request.clone().json().catch(() => null)
      const repairedBody = repairHermesWebUiChatStartBody(
        method,
        target.target.pathname,
        parsedBody,
        request.headers.get('referer'),
      )

      if (repairedBody.repaired) {
        headers.set('content-type', 'application/json')
        init.body = JSON.stringify(repairedBody.body)
      } else {
        init.body = request.body
        init.duplex = 'half'
      }
    } else {
      init.body = request.body
      init.duplex = 'half'
    }
  }

  try {
    const upstream = await fetch(target.target, init)
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildHermesWebUiProxyResponseHeaders(upstream.headers),
    })
  } catch {
    const acceptsHtml = (request.headers.get('accept') || '').includes('text/html')
    if (acceptsHtml || path.length === 0) {
      return new Response(hermesWebUiUnavailableHtml('hermes_webui_loopback_service_unreachable'), {
        status: 503,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
          'x-mission-control-hermes-webui-proxy': 'true',
        },
      })
    }

    return NextResponse.json({
      ok: false,
      state: 'SERVICE_DOWN',
      blocker: 'hermes_webui_loopback_service_unreachable',
      execution_enabled: false,
      writes_enabled: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
      public_exposure_created: false,
    }, { status: 503 })
  }
}

export async function GET(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}

export async function HEAD(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}

export async function POST(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}

export async function PUT(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}

export async function PATCH(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}

export async function DELETE(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}

export async function OPTIONS(request: NextRequest, context: Params) {
  return proxyHermesWebUi(request, context)
}
