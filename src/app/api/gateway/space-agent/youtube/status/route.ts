import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { isYouTubeTranscriptConnectorAvailable } from '@/lib/space-agent-youtube-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const transcriptConnectorProven = isYouTubeTranscriptConnectorAvailable()
  return NextResponse.json({
    ok: true,
    mode: 'space_agent_youtube_connector_status',
    status: transcriptConnectorProven ? 'ready_for_transcript_smoke' : 'limited',
    metadata_enabled: true,
    transcript_connector_proven: transcriptConnectorProven,
    blocked_reason: transcriptConnectorProven ? null : 'youtube_transcript_connector_not_proven',
    no_secrets_exposed: true,
    no_raw_paths: true,
    no_fake_done: true,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
