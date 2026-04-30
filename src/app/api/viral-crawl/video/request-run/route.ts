import { NextRequest, NextResponse } from 'next/server'
import { authJson, ownerApprovalRequired } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIDEO_RUN_STUB = {
  protected_action: 'viral_crawl_video_run',
  connector: 'viral_crawl_video',
  action: 'run_video_wrapper_or_write_obsidian',
  current_state: 'OWNER_APPROVAL_REQUIRED',
  http_status_when_blocked: 423,
  no_execution_enabled: true,
  no_video_downloads_enabled: true,
  no_obsidian_writes_enabled: true,
  no_connector_writes_enabled: true,
  approval_request_created: false,
  persistence: 'not_applied',
  canonical_contract: '/api/bridge/approval-contract',
  read_only_status_endpoint: '/api/viral-crawl/video/status',
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'viral_crawl_video_request_run_protected_stub',
    generated_at: new Date().toISOString(),
    ...VIDEO_RUN_STUB,
    next_action:
      'Use /api/viral-crawl/video/status for read-only status. Execution requires owner-approved approval persistence, audit chain, and a safe runner.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'operator')
  if (auth) return auth

  return ownerApprovalRequired({
    reason: 'viral_crawl_video_execution_requires_owner_approval_and_audit_persistence',
    ...VIDEO_RUN_STUB,
    wrapper_invoked: false,
    video_download_started: false,
    obsidian_note_written: false,
    next_action:
      'Owner approval plus persistent audit chain are required before Mission Control can invoke the video wrapper.',
  })
}
