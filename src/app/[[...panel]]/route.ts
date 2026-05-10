import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ panel?: string[] }>
}

const DESIGNER_BASE = '/designer-mission-control/Mission%20Control.html'
const MISSION_CONTROL_HOME = '/tkmc'
const PRODUCTION_GATEWAY = '/gateway'
const PRODUCTION_AGENT_HUB = '/gateway?tab=agent-hub'

function locationForPanel(panel: string[] | undefined): string {
  const firstPanel = panel?.[0] || 'mission'
  if (firstPanel === 'mission' || firstPanel === 'overview' || firstPanel === 'dashboard') return MISSION_CONTROL_HOME
  if (
    firstPanel === 'gateway' ||
    firstPanel === 'gateway-parent' ||
    firstPanel === 'agents' ||
    firstPanel === 'agent-network'
  ) return PRODUCTION_AGENT_HUB
  if (firstPanel === 'gateways') return PRODUCTION_GATEWAY
  if (firstPanel === 'gateway-config') return '/gateway?tab=policies'
  if (firstPanel === 'reports' || firstPanel === 'executive-reports' || firstPanel === 'scheduled-reports') return DESIGNER_BASE + '?page=reports'
  return MISSION_CONTROL_HOME
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
