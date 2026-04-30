import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const AGENT_NETWORK_URL = '/designer-mission-control/Mission%20Control.html?page=agent-network'

function redirectToAgentNetwork(): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: AGENT_NETWORK_URL,
    },
  })
}

export async function GET() {
  return redirectToAgentNetwork()
}

export async function HEAD() {
  return redirectToAgentNetwork()
}
