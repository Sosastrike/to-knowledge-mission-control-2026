import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getYouTubeTranscriptConnectorStatus } from '@/lib/space-agent-youtube-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const connectorStatus = getYouTubeTranscriptConnectorStatus()
  return NextResponse.json({
    ok: true,
    mode: 'space_agent_youtube_connector_status',
    status: connectorStatus.status,
    canonical_status: connectorStatus.canonical_status,
    blocker_class: connectorStatus.blocker_class,
    metadata_enabled: connectorStatus.metadata_enabled,
    transcript_connector_proven: connectorStatus.transcript_connector_proven,
    blocked_reason: connectorStatus.blocked_reason,
    legacy_blocker: connectorStatus.legacy_blocker,
    dependency: connectorStatus.dependency,
    python_command: connectorStatus.python_command,
    connector_status: connectorStatus,
    proof_packet: connectorStatus.proof_packet,
    no_secrets_exposed: true,
    no_raw_paths: true,
    no_fake_done: true,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
