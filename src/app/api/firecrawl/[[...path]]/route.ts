import { NextRequest, NextResponse } from 'next/server'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  credentialRequired,
  hasEnv,
  ownerApprovalRequired,
  routePath,
} from '@/lib/designer-module-api'
import { getFirecrawlStatus } from '@/lib/firecrawl-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  if (!path || path === 'status') return NextResponse.json(getFirecrawlStatus())
  if (path === 'jobs') {
    return NextResponse.json({ ok: true, jobs: [], note: 'no_firecrawl_jobs_table_yet' })
  }

  const parts = path.split('/')
  if (parts[0] === 'jobs' && parts[1] && !parts[2]) {
    return NextResponse.json({ ok: false, error: 'no_jobs_table_yet', job_id: parts[1] }, { status: 404 })
  }
  if (parts[0] === 'jobs' && parts[1] && parts[2] === 'events') {
    return new Response(`: backend_required - FireCrawl job stream is unavailable\n\ndata: ${JSON.stringify({
      kind: 'backend_required',
      job_id: parts[1],
    })}\n\n`, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    })
  }
  if (parts[0] === 'jobs' && parts[1] && parts[2] === 'results') {
    return NextResponse.json({ ok: true, results: [], note: 'no_firecrawl_results_table_yet', job_id: parts[1] })
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}

export async function POST(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  const path = routePath((await params).path)
  const parts = path.split('/').filter(Boolean)

  if (path === 'jobs') {
    const body = await request.json().catch(() => ({}))
    const type = String(body?.type || '')
    const url = String(body?.url || '')
    const errors: string[] = []
    if (!['crawl', 'scrape'].includes(type)) errors.push('type must be crawl|scrape')
    if (!url) errors.push('url is required')
    if (errors.length) return NextResponse.json({ ok: false, errors }, { status: 400 })
    const status = getFirecrawlStatus()
    if (!hasEnv('FIRECRAWL_API_KEY')) {
      return credentialRequired('firecrawl', ['FIRECRAWL_API_KEY'], {
        received: { type, url },
        canonical_status: status.canonical_status,
        blocker_class: status.blocker_class,
        blocked_reason: status.blocked_reason,
        blockers: status.blockers,
        proof_packet: status.proof_packet,
      })
    }
    return backendRequired({
      canonical_status: status.canonical_status,
      blocker_class: status.blocker_class,
      blocked_reason: status.blocked_reason,
      blockers: status.blockers,
      proof_packet: status.proof_packet,
      received: {
        type,
        url,
        depth: body?.depth ?? null,
        max_pages: body?.max_pages ?? null,
        format: body?.format ?? 'markdown',
        priority: body?.priority ?? 'normal',
        agent: body?.agent ?? null,
      },
      next_action: 'Wire FireCrawl job runner and persistence before execution.',
    })
  }

  if (path === 'drafts') {
    const body = await request.json().catch(() => ({}))
    return backendRequired({
      received: {
        title: body?.title ?? null,
        type: body?.type ?? null,
        target_url_present: typeof body?.url === 'string' && body.url.length > 0,
      },
      next_action: 'Wire FireCrawl draft persistence before saving owner-visible crawl drafts.',
    })
  }

  if (parts[0] === 'jobs' && parts[1]) {
    const jobId = parts[1]
    const action = parts[2] || ''
    if (['pause', 'cancel', 'retry'].includes(action)) {
      return ownerApprovalRequired({
        job_id: jobId,
        action,
        next_action: 'Owner approval plus FireCrawl SDK action wiring required.',
      })
    }
    if (action === 'export') {
      const body = await request.json().catch(() => ({}))
      const format = String(body?.format || '')
      if (!['json', 'md', 'pdf'].includes(format)) {
        return NextResponse.json({ ok: false, error: 'format must be json|md|pdf' }, { status: 400 })
      }
      return backendRequired({ job_id: jobId, format, next_action: 'Wire FireCrawl export runner.' })
    }
    if (action === 'send-to-lightrag') {
      return backendRequired({ job_id: jobId, missing: 'LIGHTRAG_ENDPOINT', next_action: 'Wire approved LightRAG ingest endpoint.' })
    }
    if (action === 'send-to-memory') {
      return ownerApprovalRequired({ job_id: jobId, next_action: 'Memory writes require owner approval and approved ingest path.' })
    }
  }

  return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
}
