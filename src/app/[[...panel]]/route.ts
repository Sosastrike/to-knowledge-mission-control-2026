import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ panel?: string[] }>
}

const DESIGNER_BASE = '/designer-mission-control/Mission%20Control.html'
const PRODUCTION_AGENT_HUB = '/gateway/agent-hub'

function locationForPanel(panel: string[] | undefined): string {
  const firstPanel = panel?.[0] || 'mission'
  if (
    firstPanel === 'gateway' ||
    firstPanel === 'gateway-parent' ||
    firstPanel === 'agents' ||
    firstPanel === 'agent-network'
  ) return PRODUCTION_AGENT_HUB
  if (firstPanel === 'gateways') return '/gateway'
  if (firstPanel === 'gateway-config') return '/gateway/policies'
  if (firstPanel === 'reports' || firstPanel === 'executive-reports' || firstPanel === 'scheduled-reports') return DESIGNER_BASE + '?page=reports'
  return DESIGNER_BASE + '?page=mission'
}

function redirectToLocation(location: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: location,
    },
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params
  return redirectToLocation(locationForPanel(params.panel))
}

export async function HEAD(_request: Request, context: RouteContext) {
  const params = await context.params
  return redirectToLocation(locationForPanel(params.panel))
}
