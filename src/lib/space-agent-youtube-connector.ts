import { spawnSync } from 'node:child_process'
import {
  createYouTubeResearchPacket,
  type SpaceAgentResponsibleAgent,
  type YouTubeResearchPacket,
  type YouTubeTranscriptSegment,
} from './space-agent-research'
import { isYouTubeTranscriptConnectorAvailable } from './space-agent-youtube-runtime'

const YOUTUBE_URL_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[^\s&#]+|youtu\.be\/[^\s&#]+)/i

function firstYouTubeUrl(value: string): string | null {
  const hit = value.match(YOUTUBE_URL_RE)
  if (!hit) return null
  try {
    const url = new URL(hit[0])
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.toString()
  } catch {
    return null
  }
}

function videoIdFromUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace(/\//g, '') || null
    const id = parsed.searchParams.get('v')
    return id || null
  } catch {
    return null
  }
}

async function fetchYouTubeMetadata(url: string): Promise<{
  title: string | null
  channel: string | null
  publishDate: string | null
  description: string | null
}> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), cache: 'no-store' })
    if (!response.ok) {
      return { title: null, channel: null, publishDate: null, description: null }
    }
    const body = await response.json().catch(() => ({} as Record<string, unknown>))
    return {
      title: typeof body.title === 'string' ? body.title.slice(0, 500) : null,
      channel: typeof body.author_name === 'string' ? body.author_name.slice(0, 300) : null,
      publishDate: null,
      description: null,
    }
  } catch {
    return { title: null, channel: null, publishDate: null, description: null }
  }
}

function loadTranscriptSegments(videoId: string | null): {
  segments: Array<Partial<YouTubeTranscriptSegment> & { text: string }>
  blockedReason: string | null
} {
  if (!videoId) return { segments: [], blockedReason: 'youtube_video_id_not_detected' }
  if (!isYouTubeTranscriptConnectorAvailable()) return { segments: [], blockedReason: 'youtube_transcript_connector_not_proven' }

  const python = `
import json
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound
vid = ${JSON.stringify(videoId)}
try:
    transcript = YouTubeTranscriptApi.get_transcript(vid)
    rows = []
    for item in transcript[:30]:
        text = str(item.get('text','')).strip()
        if not text:
            continue
        start = item.get('start')
        duration = item.get('duration')
        end = None
        if isinstance(start,(int,float)) and isinstance(duration,(int,float)):
            end = float(start) + float(duration)
        rows.append({
            'text': text[:400],
            'start_seconds': float(start) if isinstance(start,(int,float)) else None,
            'end_seconds': float(end) if isinstance(end,(int,float)) else None
        })
    print(json.dumps({'ok': True, 'segments': rows}))
except (TranscriptsDisabled, NoTranscriptFound):
    print(json.dumps({'ok': False, 'reason': 'youtube_transcript_unavailable'}))
except Exception:
    print(json.dumps({'ok': False, 'reason': 'youtube_transcript_lookup_failed'}))
`
  const result = spawnSync('python3', ['-c', python], {
    encoding: 'utf8',
    timeout: 10000,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, PATH: process.env.PATH || '/usr/bin:/bin' },
  })
  if (result.status !== 0) return { segments: [], blockedReason: 'youtube_transcript_lookup_failed' }
  const parsed = JSON.parse(result.stdout || '{}') as { ok?: boolean; segments?: Array<{ text: string; start_seconds?: number | null; end_seconds?: number | null }>; reason?: string }
  if (!parsed.ok) return { segments: [], blockedReason: parsed.reason || 'youtube_transcript_lookup_failed' }
  const segments = Array.isArray(parsed.segments)
    ? parsed.segments
      .filter((row) => typeof row?.text === 'string' && row.text.trim())
      .map((row, index) => ({
        segment_id: `youtube_transcript_segment_${index + 1}`,
        text: row.text.trim(),
        start_seconds: typeof row.start_seconds === 'number' ? row.start_seconds : null,
        end_seconds: typeof row.end_seconds === 'number' ? row.end_seconds : null,
      }))
    : []
  return { segments, blockedReason: null }
}

export async function createSpaceAgentYouTubeConnectorPacket(input: {
  request: string
  responsibleAgent?: SpaceAgentResponsibleAgent
  requestedBy?: 'owner' | 'agent_zero' | 'hermes' | 'pi' | 'gateway'
}): Promise<{
  ok: boolean
  packet: YouTubeResearchPacket
  blocked_reason: string | null
}> {
  const request = input.request || ''
  const url = firstYouTubeUrl(request)
  const videoId = videoIdFromUrl(url)
  const metadata = url ? await fetchYouTubeMetadata(url) : { title: null, channel: null, publishDate: null, description: null }
  const transcript = loadTranscriptSegments(videoId)
  const packet = createYouTubeResearchPacket({
    request,
    requestedBy: input.requestedBy || 'gateway',
    responsibleAgent: input.responsibleAgent || 'agent_zero',
    generatedAt: new Date().toISOString(),
    videoUrl: url || undefined,
    title: metadata.title,
    channel: metadata.channel,
    publishDate: metadata.publishDate,
    description: metadata.description,
    transcriptSegments: transcript.segments,
    captionsAvailable: transcript.segments.length > 0,
    youtubeSources: [
      {
        source_id: 'youtube_source_1',
        video_url: url,
        video_id: videoId,
        title: metadata.title,
        channel: metadata.channel,
        metadata_status: metadata.title ? 'available' : 'unknown',
        transcript_status: transcript.segments.length > 0 ? 'available' : 'missing',
        blocked_reason: transcript.blockedReason,
      },
    ],
  })
  const blockedReason = transcript.blockedReason || packet.blocked_reason || null
  return {
    ok: packet.status === 'ready' || packet.status === 'limited',
    packet,
    blocked_reason: blockedReason,
  }
}
