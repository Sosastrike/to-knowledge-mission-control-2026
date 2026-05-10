import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildCloudCodeNavigation } from '@/lib/gateway-cloudcode-integration'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const route = new URL(request.url).searchParams.get('route') || '/gateway'
  const navigation = buildCloudCodeNavigation(route)

  return NextResponse.json({
    ok: navigation.ok,
    mode: 'gateway_navigation_metadata',
    route,
    current: navigation.current,
    breadcrumbs: navigation.breadcrumbs,
    targets: navigation.targets,
    all_routes: navigation.all_routes,
    classified_error: navigation.classified_error,
    cloudcode_backend_support: {
      applied: true,
      source: 'cloudcode-backend-support-handoff',
      helpers: ['ROUTE_METADATA', 'getBreadcrumbTrail', 'classifyError'],
    },
  }, {
    status: navigation.ok ? 200 : 404,
    headers: { 'Cache-Control': 'no-store' },
  })
}
