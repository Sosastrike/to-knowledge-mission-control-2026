import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildKnowledgeReport } from '@/lib/knowledge-report'
import { GET as getBrainSyncStatus } from '../status/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const brainStatusResponse = await getBrainSyncStatus(request)
  if (brainStatusResponse.status >= 400) return brainStatusResponse

  const brainStatus = await brainStatusResponse.json()
  const report = buildKnowledgeReport(brainStatus)
  const format = new URL(request.url).searchParams.get('format')

  if (format === 'markdown') {
    return new NextResponse(report.markdown, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    })
  }

  return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
}
