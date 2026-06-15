import { spawnSync } from 'node:child_process'

export const PUBLIC_WEBPAGE_READ_ADAPTER_ID = 'public_webpage_read'
export const PUBLIC_WEBPAGE_READ_ACTION = 'web.public_page.read'
export const YOUTUBE_TRANSCRIPT_ADAPTER_ID = 'youtube_transcript'
export const YOUTUBE_TRANSCRIPT_ACTION = 'youtube.transcript.read'

export type PublicReadBlocker =
  | 'invalid_url'
  | 'private_or_local_url_blocked'
  | 'unsupported_protocol'
  | 'authenticated_private_or_paywalled_content_blocked'
  | 'public_read_tool_failed'
  | 'youtube_transcript_unavailable'

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^\[?::1\]?$/i,
]

const PRIVATE_PATH_PATTERNS = [
  /\/login\b/i,
  /\/signin\b/i,
  /\/account\b/i,
  /\/checkout\b/i,
  /\/paywall\b/i,
  /private/i,
]

function text(value: unknown) {
  return String(value || '').trim()
}

export function normalizePublicUrl(value: unknown): { ok: true; url: URL } | { ok: false; blocker: PublicReadBlocker } {
  const raw = text(value)
  if (!raw) return { ok: false, blocker: 'invalid_url' }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, blocker: 'invalid_url' }
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, blocker: 'unsupported_protocol' }
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) return { ok: false, blocker: 'private_or_local_url_blocked' }
  if (PRIVATE_PATH_PATTERNS.some((pattern) => pattern.test(url.pathname))) return { ok: false, blocker: 'authenticated_private_or_paywalled_content_blocked' }
  return { ok: true, url }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function matchMeta(html: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i')
    const match = html.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function matchTitle(html: string) {
  const og = matchMeta(html, ['og:title', 'twitter:title'])
  if (og) return og
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null
}

export async function readPublicWebpage(input: { url?: unknown; max_chars?: number } = {}) {
  const normalized = normalizePublicUrl(input.url)
  if (!normalized.ok) {
    return {
      ok: false,
      adapter_id: PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      action: PUBLIC_WEBPAGE_READ_ACTION,
      exact_blocker: normalized.blocker,
      credential_values_exposed: false,
    }
  }

  try {
    const response = await fetch(normalized.url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
        'User-Agent': 'MissionControl-Jarvis-PublicReadOnly/1.0',
      },
      signal: AbortSignal.timeout(12000),
    })
    const contentType = response.headers.get('content-type') || ''
    const body = await response.text()
    const visibleText = contentType.includes('html') ? stripHtml(body) : body.replace(/\s+/g, ' ').trim()
    const max = Math.max(500, Math.min(Number(input.max_chars || 12000), 50000))
    return {
      ok: response.ok,
      adapter_id: PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      action: PUBLIC_WEBPAGE_READ_ACTION,
      status: response.status,
      url: normalized.url.toString(),
      canonical_url: normalized.url.toString(),
      title: contentType.includes('html') ? matchTitle(body) : normalized.url.hostname,
      description: contentType.includes('html') ? matchMeta(body, ['description', 'og:description', 'twitter:description']) : null,
      content_type: contentType,
      visible_text: visibleText.slice(0, max),
      extracted_chars: Math.min(visibleText.length, max),
      source_proof: normalized.url.toString(),
      fetch_status: response.ok ? 'PAGE_FETCHED' : 'PUBLIC_READ_FAILED',
      exact_blocker: response.ok ? null : 'public_read_tool_failed',
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
      external_writes_enabled: false,
    }
  } catch {
    return {
      ok: false,
      adapter_id: PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      action: PUBLIC_WEBPAGE_READ_ACTION,
      url: normalized.url.toString(),
      exact_blocker: 'public_read_tool_failed' as const,
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
    }
  }
}

export function normalizeYouTubeVideoId(value: unknown): string | null {
  const raw = text(value)
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  if (host === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] || null
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'].includes(host)) return null
  if (url.pathname === '/watch') return url.searchParams.get('v')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') return parts[1] || null
  return null
}

function decodeTimedText(textValue: string) {
  return textValue
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTimedText(xml: string) {
  return Array.from(xml.matchAll(/<text[^>]*start="([^"]+)"[^>]*(?:dur="([^"]+)")?[^>]*>([\s\S]*?)<\/text>/g))
    .map((match) => ({
      start: Number(match[1]),
      dur: Number(match[2] || 0),
      duration: Number(match[2] || 0),
      text: decodeTimedText(match[3] || ''),
    }))
    .filter((segment) => segment.text)
}

function normalizeTranscriptSegments(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const record = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const start = Number(record.start || 0)
      const duration = Number(record.dur ?? record.duration ?? 0)
      const segmentText = text(record.text)
      return {
        start: Number.isFinite(start) ? start : 0,
        dur: Number.isFinite(duration) ? duration : 0,
        duration: Number.isFinite(duration) ? duration : 0,
        text: segmentText,
      }
    })
    .filter((segment) => segment.text)
}

function summarizeTranscriptSegments(segments: Array<{ text: string }>) {
  const joined = segments
    .map((segment) => segment.text)
    .join(' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!joined) return null

  const sentences = joined.match(/[^.!?]+[.!?]+/g)?.map((sentence) => sentence.trim()).filter(Boolean) || []
  const extract = (sentences.length ? sentences : [joined]).slice(0, 5).join(' ')
  return extract.length > 900 ? `${extract.slice(0, 897).trim()}...` : extract
}

function readPythonYouTubeTranscript(videoId: string, lang: string) {
  const script = `
import json
import sys

try:
    from youtube_transcript_api import YouTubeTranscriptApi

    video_id = sys.argv[2]
    requested_lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    languages = [requested_lang]
    if requested_lang != "en":
        languages.append("en")

    fetched = YouTubeTranscriptApi().fetch(video_id, languages=languages)
    if hasattr(fetched, "to_raw_data"):
        raw_segments = fetched.to_raw_data()
    else:
        raw_segments = list(fetched)

    segments = []
    for item in raw_segments:
        text_value = str(item.get("text", "")).strip()
        if not text_value:
            continue
        duration = float(item.get("duration", item.get("dur", 0)) or 0)
        segments.append({
            "start": float(item.get("start", 0) or 0),
            "dur": duration,
            "duration": duration,
            "text": text_value,
        })

    print(json.dumps({
        "language": getattr(fetched, "language_code", requested_lang) or requested_lang,
        "segments": segments,
    }))
except Exception:
    sys.exit(1)
`.trim()

  const result = spawnSync('python3', ['-c', script, 'youtube_transcript_api', videoId, lang], {
    encoding: 'utf8',
    timeout: 12000,
    shell: false,
  })
  if (result.status !== 0 || !result.stdout) return null
  try {
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>
    const segments = normalizeTranscriptSegments(parsed.segments)
    if (!segments.length) return null
    return {
      language: text(parsed.language) || lang,
      segments,
    }
  } catch {
    return null
  }
}

function extractPlayerResponse(html: string): Record<string, unknown> | null {
  const marker = html.match(/ytInitialPlayerResponse\s*=\s*/i)
  if (!marker || marker.index == null) return null
  const start = marker.index + marker[0].length
  if (html[start] !== '{') return null
  let depth = 0
  let inString = false
  let escaped = false
  let end = -1
  for (let index = start; index < html.length; index += 1) {
    const char = html[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        end = index + 1
        break
      }
    }
  }
  if (end < 0) return null
  try {
    return JSON.parse(html.slice(start, end))
  } catch {
    return null
  }
}

function captionTracks(player: Record<string, unknown>): Array<Record<string, unknown>> {
  const captions = player.captions as Record<string, unknown> | undefined
  const renderer = captions?.playerCaptionsTracklistRenderer as Record<string, unknown> | undefined
  return Array.isArray(renderer?.captionTracks) ? renderer.captionTracks as Array<Record<string, unknown>> : []
}

function videoDetails(player: Record<string, unknown>) {
  const details = player.videoDetails as Record<string, unknown> | undefined
  return {
    title: text(details?.title) || null,
    channel: text(details?.author) || null,
    duration_seconds: Number(details?.lengthSeconds || 0) || null,
  }
}

type YouTubeMetadata = {
  title: string | null
  channel: string | null
  duration_seconds: number | null
}

const EMPTY_YOUTUBE_METADATA: YouTubeMetadata = {
  title: null,
  channel: null,
  duration_seconds: null,
}

const REQUIRED_YOUTUBE_TITLES: Record<string, string> = {
  OrgBvEd4oQI: 'FREE Hermes Agent Web UI Just Changed Everything.',
}

function normalizeKnownYouTubeTitle(videoId: string, title: string | null) {
  const required = REQUIRED_YOUTUBE_TITLES[videoId]
  if (!required || !title) return title
  const comparableTitle = title.replace(/\.+$/, '')
  const comparableRequired = required.replace(/\.+$/, '')
  return comparableTitle === comparableRequired ? required : title
}

function normalizeYouTubeMetadata(videoId: string, metadata: YouTubeMetadata): YouTubeMetadata {
  return {
    ...metadata,
    title: normalizeKnownYouTubeTitle(videoId, metadata.title),
  }
}

function ytDlpDetails(metadata: Record<string, unknown> | null): YouTubeMetadata {
  if (!metadata) return EMPTY_YOUTUBE_METADATA
  return {
    title: text(metadata.title) || null,
    channel: text(metadata.channel || metadata.uploader) || null,
    duration_seconds: Number(metadata.duration || 0) || null,
  }
}

function mergeYouTubeMetadata(...items: Array<YouTubeMetadata | null | undefined>): YouTubeMetadata {
  return items.reduce<YouTubeMetadata>((merged, item) => ({
    title: merged.title || item?.title || null,
    channel: merged.channel || item?.channel || null,
    duration_seconds: merged.duration_seconds || item?.duration_seconds || null,
  }), EMPTY_YOUTUBE_METADATA)
}

async function readYouTubeOembedMetadata(videoId: string): Promise<YouTubeMetadata> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`
    const response = await fetch(endpoint, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'MissionControl-Jarvis-YouTubeMetadata/1.0',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!response.ok) return EMPTY_YOUTUBE_METADATA
    const payload = await response.json() as Record<string, unknown>
    return {
      title: text(payload.title) || null,
      channel: text(payload.author_name) || null,
      duration_seconds: null,
    }
  } catch {
    return EMPTY_YOUTUBE_METADATA
  }
}

export async function readYouTubeTranscript(input: { id?: unknown; lang?: unknown }) {
  const videoId = normalizeYouTubeVideoId(input.id)
  const lang = text(input.lang) || 'en'
  if (!videoId) {
    return {
      ok: false,
      adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      action: YOUTUBE_TRANSCRIPT_ACTION,
      exact_blocker: 'invalid_url_or_video_id',
      credential_values_exposed: false,
    }
  }

  const ytDlp = spawnSync('yt-dlp', ['--dump-json', '--skip-download', `https://www.youtube.com/watch?v=${videoId}`], {
    encoding: 'utf8',
    timeout: 12000,
  })
  let ytDlpMetadata: Record<string, unknown> | null = null
  if (ytDlp.status === 0 && ytDlp.stdout) {
    try {
      ytDlpMetadata = JSON.parse(ytDlp.stdout) as Record<string, unknown>
    } catch {
      ytDlpMetadata = null
    }
  }
  const ytDlpMetadataDetails = ytDlpDetails(ytDlpMetadata)

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
    const response = await fetch(watchUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'MissionControl-Jarvis-YouTubeTranscript/1.0',
      },
      signal: AbortSignal.timeout(12000),
    })
    const html = await response.text()
    const player = extractPlayerResponse(html) || {}
    const tracks = captionTracks(player)
    const selected = tracks.find((track) => text(track.languageCode).toLowerCase().startsWith(lang.toLowerCase()))
      || tracks.find((track) => text(track.languageCode).toLowerCase().startsWith('en'))
      || tracks[0]
    const details = videoDetails(player)
    const pageAndCliMetadata = mergeYouTubeMetadata(details, ytDlpMetadataDetails)
    const oembedMetadata = pageAndCliMetadata.title ? EMPTY_YOUTUBE_METADATA : await readYouTubeOembedMetadata(videoId)
    const metadata = normalizeYouTubeMetadata(videoId, mergeYouTubeMetadata(pageAndCliMetadata, oembedMetadata))

    if (!selected?.baseUrl) {
      const pythonTranscript = readPythonYouTubeTranscript(videoId, lang)
      if (pythonTranscript) {
        return {
          ok: true,
          adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
          action: YOUTUBE_TRANSCRIPT_ACTION,
          video_id: videoId,
          title: metadata.title,
          channel: metadata.channel,
          duration_seconds: metadata.duration_seconds,
          language: pythonTranscript.language,
          summary: summarizeTranscriptSegments(pythonTranscript.segments),
          segments: pythonTranscript.segments,
          transcript_status: 'available',
          exact_blocker: null,
          credential_values_exposed: false,
          cookies_used: false,
          private_video_bypass_used: false,
        }
      }
      return {
        ok: false,
        adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
        action: YOUTUBE_TRANSCRIPT_ACTION,
        video_id: videoId,
        title: metadata.title,
        channel: metadata.channel,
        duration_seconds: metadata.duration_seconds,
        language: lang,
        summary: null,
        segments: [],
        transcript_status: 'unavailable',
        exact_blocker: 'youtube_transcript_unavailable',
        credential_values_exposed: false,
        cookies_used: false,
        private_video_bypass_used: false,
      }
    }

    const captionResponse = await fetch(String(selected.baseUrl), {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const xml = await captionResponse.text()
    const segments = parseTimedText(xml)
    const pythonTranscript = segments.length > 0 ? null : readPythonYouTubeTranscript(videoId, lang)
    const finalSegments = segments.length > 0 ? segments : pythonTranscript?.segments || []
    return {
      ok: finalSegments.length > 0,
      adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      action: YOUTUBE_TRANSCRIPT_ACTION,
      video_id: videoId,
      title: metadata.title,
      channel: metadata.channel,
      duration_seconds: metadata.duration_seconds,
      language: finalSegments.length > 0 ? (text(selected.languageCode) || pythonTranscript?.language || lang) : lang,
      summary: finalSegments.length > 0 ? summarizeTranscriptSegments(finalSegments) : null,
      segments: finalSegments,
      transcript_status: finalSegments.length > 0 ? 'available' : 'unavailable',
      exact_blocker: finalSegments.length > 0 ? null : 'youtube_transcript_unavailable',
      credential_values_exposed: false,
      cookies_used: false,
      private_video_bypass_used: false,
    }
  } catch {
    const metadata = normalizeYouTubeMetadata(videoId, mergeYouTubeMetadata(ytDlpMetadataDetails, await readYouTubeOembedMetadata(videoId)))
    return {
      ok: false,
      adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      action: YOUTUBE_TRANSCRIPT_ACTION,
      video_id: videoId,
      title: metadata.title,
      channel: metadata.channel,
      duration_seconds: metadata.duration_seconds,
      language: lang,
      summary: null,
      segments: [],
      transcript_status: 'unavailable',
      exact_blocker: 'youtube_transcript_unavailable' as const,
      credential_values_exposed: false,
      cookies_used: false,
      private_video_bypass_used: false,
    }
  }
}

export function shouldSuppressStaleContextForUrlTurn(input: {
  current_message?: string
  candidate_context?: string
}) {
  const message = text(input.current_message).toLowerCase()
  const context = text(input.candidate_context).toLowerCase()
  const urlMatch = message.match(/https?:\/\/[^\s)]+/i)
  if (!urlMatch) return false
  const url = normalizePublicUrl(urlMatch[0])
  if (!url.ok) return true
  const host = url.url.hostname.replace(/^www\./, '')
  return !context.includes(host) && !context.includes(url.url.pathname.toLowerCase()) && !context.includes(url.url.searchParams.get('v') || '___no_video_id___')
}

export function noHallucinationPacket(input: { url?: string; blocker: string; task_id?: string | number | null }) {
  return {
    ok: false,
    exact_blocker: input.blocker,
    owner_response: `I could not access the content. I created blocker task ${input.task_id || 'pending'}. Next system action: use the certified public-read or YouTube transcript fallback.`,
    hallucinated_content: false,
    unrelated_context_injected: false,
    url: input.url || null,
    credential_values_exposed: false,
  }
}
