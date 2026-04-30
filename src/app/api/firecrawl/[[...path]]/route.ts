import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  authJson,
  backendRequired,
  CatchAllParams,
  credentialRequired,
  hasEnv,
  ownerApprovalRequired,
  routePath,
} from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function sdkLoaded(): boolean {
  return existsSync(join(process.cwd(), 'node_modules', '@mendable', 'firecrawl-js', 'package.json'))
}

function envFileHasName(path: string, name: string): boolean {
  try {
    const text = readFileSync(path, 'utf8')
    return text.split(/\r?\n/).some((line) => line.trim().startsWith(`${name}=`))
  } catch {
    return false
  }
}

function statusPayload() {
  const keyPresent = hasEnv('FIRECRAWL_API_KEY')
  const sdk = sdkLoaded()
  const missionControlEnvPresent =
    envFileHasName('/home/tony/mission-control/.env', 'FIRECRAWL_API_KEY') ||
    envFileHasName('/home/tony/mission-control/.env.local', 'FIRECRAWL_API_KEY')
  const claudeClawEnvPresent = envFileHasName('/home/tony/claudeclaw/.env', 'FIRECRAWL_API_KEY')
  const openClawEnvPresent = envFileHasName('/home/tony/.openclaw/.env', 'FIRECRAWL_API_KEY')
  const envMismatch = !keyPresent && (claudeClawEnvPresent || openClawEnvPresent)
  const status = !keyPresent ? 'credential_required' : !sdk ? 'backend_required' : 'live'
  return {
    ok: true,
    status,
    key_present: keyPresent,
    sdk_loaded: sdk,
    firecrawl_backend_truth: {
      mission_control_process_has_firecrawl_api_key: keyPresent,
      mission_control_env_has_firecrawl_api_key: missionControlEnvPresent,
      claudeclaw_env_has_firecrawl_api_key: claudeClawEnvPresent,
      openclaw_env_has_firecrawl_api_key: openClawEnvPresent,
      mission_control_sdk_present: sdk,
      mismatch: envMismatch || !sdk,
      conclusion: envMismatch
        ? 'Mission Control is missing FIRECRAWL_API_KEY even though ClaudeClaw/OpenClaw have it by name.'
        : !sdk
        ? 'Mission Control FireCrawl SDK is missing.'
        : 'Mission Control FireCrawl credential and SDK are present.',
      approved_fix_required: !keyPresent || !sdk,
      approved_fix_note: 'Use an owner-approved credential sync path and package install path. Do not copy secrets manually or run FireCrawl jobs from this endpoint.',
    },
    mcp: { name: 'firecrawl-mcp', status: sdk ? 'unknown' : 'not_wired' },
    api: { reachable: sdk },
    jobs: { active: 0, queued: 0, completed: 0, failed: 0 },
    last_successful_crawl: null,
    assigned_agents: ['Tony', 'Agent 0', 'Researcher', 'Builder', 'Operator', 'Marketing', 'Support'],
    cost_today_usd: null,
    next_action: keyPresent
      ? sdk
        ? 'Wire FireCrawl SDK job runner and persistence tables after owner approval.'
        : 'Install @mendable/firecrawl-js and wire the job runner after owner approval.'
      : 'Mission Control FIRECRAWL_API_KEY is missing. ClaudeClaw/OpenClaw may have the credential, but Mission Control does not. Approved credential sync path required.',
  }
}

export async function GET(request: NextRequest, { params }: { params: CatchAllParams }) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  const path = routePath((await params).path)
  if (!path || path === 'status') return NextResponse.json(statusPayload())
  if (path === 'jobs') {
    return NextResponse.json({ ok: true, jobs: [], note: 'no_firecrawl_jobs_table_yet' })
  }

  const parts = path.split('/')
  if (parts[0] === 'jobs' && parts[1] && !parts[2]) {
    return NextResponse.json({ ok: false, error: 'no_jobs_table_yet', job_id: parts[1] }, { status: 404 })
  }
  if (parts[0] === 'jobs' && parts[1] && parts[2] === 'events') {
    return new Response(`: backend_required - FireCrawl job stream is not wired\n\ndata: ${JSON.stringify({
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
    if (!hasEnv('FIRECRAWL_API_KEY')) {
      return credentialRequired('firecrawl', ['FIRECRAWL_API_KEY'], { received: { type, url } })
    }
    return backendRequired({
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
