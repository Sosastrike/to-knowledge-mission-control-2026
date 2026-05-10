import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GATEWAY_URL = '/gateway?tab=agent-hub'

function redirectToGateway(): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: GATEWAY_URL,
    },
  })
}

export async function GET() {
  return redirectToGateway()
}

export async function HEAD() {
  return redirectToGateway()
}
