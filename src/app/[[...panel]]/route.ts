import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ panel?: string[] }>
}

const DESIGNER_BASE = '/designer-mission-control/Mission%20Control.html'

function pageForPanel(panel: string[] | undefined): string {
  const firstPanel = panel?.[0] || 'mission'
  if (firstPanel === 'gateway' || firstPanel === 'agents' || firstPanel === 'agent-network') return 'gateway'
  if (firstPanel === 'reports' || firstPanel === 'executive-reports' || firstPanel === 'scheduled-reports') return 'reports'
  return 'mission'
}

function redirectToDesigner(page: string): NextResponse {
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: `${DESIGNER_BASE}?page=${encodeURIComponent(page)}`,
    },
  })
}

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params
  return redirectToDesigner(pageForPanel(params.panel))
}

export async function HEAD(_request: Request, context: RouteContext) {
  const params = await context.params
  return redirectToDesigner(pageForPanel(params.panel))
}
