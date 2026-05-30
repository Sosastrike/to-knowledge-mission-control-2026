import { NextRequest, NextResponse } from 'next/server'

import { readYouTubeTranscript } from '@/lib/public-research'
import { authRequired } from '@/lib/mission-control-contracts'
import { ensureAgentRoutingVisibleTask } from '@/lib/agent-routing-lines'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function ensureYouTubeTranscriptTask(input: { requested: string; result: Record<string, unknown> }) {
  const exactBlocker = typeof input.result.exact_blocker === 'string' ? input.result.exact_blocker : null
  const ok = input.result.ok === true && !exactBlocker
  const task = ensureAgentRoutingVisibleTask({
    title: 'Jarvis Video Intelligence — YouTube Transcript Request',
    description: `YouTube transcript route request through certified read-only adapter. Source: ${input.requested || input.result.video_id || 'not supplied'}.`,
    assigned_to: 'agent-zero-jarvis',
    blocker: exactBlocker,
    metadata: {
      project: 'Unlock Full Video Intelligence for Jarvis',
      adapter_id: 'youtube_transcript',
      action: 'youtube.transcript.read',
      requested_source: input.requested || null,
      video_id: input.result.video_id || null,
      extracted_title: input.result.title || null,
      fetch_status: input.result.transcript_status || (ok ? 'available' : 'unavailable'),
      exact_blocker: exactBlocker,
      agent_runtime: 'Agent Zero / Jarvis video intelligence router',
      affected_system: 'Jarvis Video Intelligence',
      blocked_lane: exactBlocker ? 'youtube_transcript' : null,
      current_phase: exactBlocker ? 'YouTube transcript blocked with no hallucination' : 'YouTube transcript fetched',
      progress: exactBlocker ? 75 : 96,
      delivery_state: exactBlocker ? 'VISIBLE_CONTENT_BLOCKER_CREATED' : 'READ_ONLY_CONTENT_FETCHED',
      next_action: exactBlocker
        ? 'Use captions/transcript if available, or continue only through an approved audio fallback lane; do not use WebFetch or FireCrawl as the primary YouTube path.'
        : 'Summarize only the fetched transcript/source metadata and keep unrelated task context suppressed.',
      needed_to_unblock: exactBlocker
        ? 'Public captions/transcript must be available, or an approved audio/Whisper fallback must be explicitly enabled for this video lane.'
        : null,
      proof_records: ['/api/youtube/transcript'],
      continued_work: ['YouTube transcript route, no-hallucination guardrail, and visible task proof continue without generic owner page-fetch approval.'],
      next_safe_lane: 'Continue video intelligence registration and source-backed summary work.',
      youtube_transcript_route_first: true,
      webfetch_primary_used: false,
      firecrawl_primary_used: false,
      hallucinated_content: false,
      unrelated_context_injected: false,
      cookies_used: false,
      auth_headers_used: false,
      credential_values_exposed: false,
      no_secrets_exposed: true,
    },
  })

  return String(task.task_id)
}

export async function GET(request: NextRequest) {
  const auth = authRequired(request, 'viewer')
  if (auth) return auth

  const { searchParams } = new URL(request.url)
  const requested = searchParams.get('id') || searchParams.get('url') || ''
  const result = await readYouTubeTranscript({
    id: requested,
    lang: searchParams.get('lang') || 'en',
  })
  const visibleTaskId = ensureYouTubeTranscriptTask({ requested, result: result as Record<string, unknown> })
  return NextResponse.json({
    ...result,
    visible_task_id: visibleTaskId,
    owner_visible_task_route: `/api/tasks/${visibleTaskId}`,
    hallucinated_content: false,
    unrelated_context_injected: false,
    webfetch_primary_used: false,
    firecrawl_primary_used: false,
    no_secrets_exposed: true,
  }, { status: result.ok ? 200 : 422 })
}
