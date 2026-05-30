import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type YouTubeTranscriptSegment = {
  start: number
  duration: number
  text: string
}

export type YouTubeCaptionTrack = {
  language: string
  source: 'manual_captions' | 'auto_captions'
  ext: string
  url: string
}

type CaptionRecord = {
  ext?: string
  url?: string
}

type YtDlpInfo = {
  id?: string
  title?: string
  uploader?: string
  channel?: string
  duration?: number
  webpage_url?: string
  subtitles?: Record<string, CaptionRecord[]>
  automatic_captions?: Record<string, CaptionRecord[]>
}

export function normalizeYouTubeVideoId(value: string): string | null {
  const raw = value.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const pathParts = parsed.pathname.split('/').filter(Boolean)
  const pathCandidate = ['shorts', 'embed', 'v'].includes(pathParts[0] || '') ? pathParts[1] : null
  const candidate = host === 'youtu.be'
    ? pathParts[0]
    : host.endsWith('youtube.com')
      ? parsed.searchParams.get('v') || pathCandidate
      : null
  return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null
}

function cleanCaptionText(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function roundSeconds(value: number) {
  return Number(value.toFixed(3))
}

export function parseJson3Transcript(raw: string): YouTubeTranscriptSegment[] {
  const parsed = JSON.parse(raw) as { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> }
  const events = Array.isArray(parsed.events) ? parsed.events : []
  return events
    .map((event) => {
      const text = cleanCaptionText((event.segs || []).map((segment) => segment.utf8 || '').join(''))
      if (!text) return null
      return {
        start: roundSeconds((event.tStartMs || 0) / 1000),
        duration: roundSeconds((event.dDurationMs || 0) / 1000),
        text,
      }
    })
    .filter((segment): segment is YouTubeTranscriptSegment => Boolean(segment))
}

function parseVttTime(value: string) {
  const match = value.trim().match(/(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/)
  if (!match) return 0
  const hours = Number(match[1] || 0)
  const minutes = Number(match[2] || 0)
  const seconds = Number(match[3] || 0)
  const millis = Number(match[4] || 0)
  return hours * 3600 + minutes * 60 + seconds + millis / 1000
}

export function parseVttTranscript(raw: string): YouTubeTranscriptSegment[] {
  const blocks = raw.replace(/\r/g, '').split(/\n\n+/)
  const segments: YouTubeTranscriptSegment[] = []
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex === -1) continue
    const [startRaw, endRaw] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0])
    const start = parseVttTime(startRaw)
    const end = parseVttTime(endRaw)
    const text = cleanCaptionText(lines.slice(timingIndex + 1).join(' '))
    if (!text) continue
    segments.push({ start: roundSeconds(start), duration: roundSeconds(Math.max(0, end - start)), text })
  }
  return segments
}

function trackForLanguage(
  tracks: Record<string, CaptionRecord[]> | undefined,
  language: string,
  source: YouTubeCaptionTrack['source'],
): YouTubeCaptionTrack | null {
  if (!tracks) return null
  const candidates = [
    language,
    language.toLowerCase(),
    `${language}-${language}`,
    `${language}-en`,
    ...Object.keys(tracks).filter((key) => key.toLowerCase() === language.toLowerCase() || key.toLowerCase().startsWith(`${language.toLowerCase()}-`)),
  ]
  for (const key of candidates) {
    const rows = tracks[key]
    if (!Array.isArray(rows)) continue
    const selected = rows.find((row) => row.ext === 'json3' && row.url) ||
      rows.find((row) => row.ext === 'vtt' && row.url) ||
      rows.find((row) => row.url)
    if (selected?.url) return { language: key, source, ext: selected.ext || 'unknown', url: selected.url }
  }
  return null
}

export function selectCaptionTrack(info: Pick<YtDlpInfo, 'subtitles' | 'automatic_captions'>, language = 'en'): YouTubeCaptionTrack | null {
  return trackForLanguage(info.subtitles, language, 'manual_captions') ||
    trackForLanguage(info.automatic_captions, language, 'auto_captions')
}

export const YT_DLP_PUBLIC_CAPTION_CLIENTS = [
  null,
  'youtube:player_client=tv_embedded',
  'youtube:player_client=android',
] as const

export function classifyYouTubeTranscriptError(message: string) {
  const lower = message.toLowerCase()
  if (/sign in to confirm.*bot|confirm.*not a bot|not a bot|bot challenge/.test(lower)) {
    return 'youtube_public_bot_challenge_no_cookie_bypass'
  }
  if (/private|unavailable|login|sign in|members-only|premiere/.test(lower)) {
    return 'youtube_private_or_login_required'
  }
  return 'youtube_transcript_unavailable'
}

export function buildYtDlpInfoArgs(videoId: string, extractorArgs: string | null = null, nodeRuntime = process.execPath): string[] {
  const args = [
    '--dump-json',
    '--skip-download',
    '--no-playlist',
    '--no-warnings',
  ]
  if (nodeRuntime) args.push('--js-runtimes', `node:${nodeRuntime}`)
  if (extractorArgs) args.push('--extractor-args', extractorArgs)
  args.push(`https://www.youtube.com/watch?v=${videoId}`)
  return args
}

async function loadYtDlpInfo(videoId: string): Promise<YtDlpInfo> {
  let lastError: unknown = null
  for (const client of YT_DLP_PUBLIC_CAPTION_CLIENTS) {
    try {
      const { stdout } = await execFileAsync('yt-dlp', buildYtDlpInfoArgs(videoId, client), {
        timeout: 20000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, YTDLP_NO_UPDATE: '1' },
      })
      return JSON.parse(stdout) as YtDlpInfo
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('youtube_transcript_info_unavailable')
}

async function fetchCaption(track: YouTubeCaptionTrack) {
  const response = await fetch(track.url, {
    method: 'GET',
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
    headers: { Accept: 'application/json,text/vtt,text/plain' },
  })
  if (!response.ok) throw new Error(`caption_http_${response.status}`)
  return response.text()
}

export async function readYouTubeTranscript(input: { id: string; lang?: string }) {
  const videoId = normalizeYouTubeVideoId(input.id)
  if (!videoId) {
    return {
      ok: false,
      exact_blocker: 'youtube_video_id_required',
      video_id: null,
      metadata: null,
      language: input.lang || 'en',
      transcript_source: null,
      segments: [] as YouTubeTranscriptSegment[],
      transcript_text: '',
      credential_values_exposed: false,
      cookies_used: false,
      audio_downloaded: false,
    }
  }

  try {
    const info = await loadYtDlpInfo(videoId)
    const track = selectCaptionTrack(info, input.lang || 'en')
    if (!track) {
      return {
        ok: false,
        exact_blocker: 'youtube_transcript_unavailable',
        video_id: videoId,
        metadata: {
          title: info.title || null,
          channel: info.channel || info.uploader || null,
          duration_seconds: typeof info.duration === 'number' ? info.duration : null,
          webpage_url: info.webpage_url || `https://www.youtube.com/watch?v=${videoId}`,
        },
        language: input.lang || 'en',
        transcript_source: null,
        segments: [] as YouTubeTranscriptSegment[],
        transcript_text: '',
        credential_values_exposed: false,
        cookies_used: false,
        audio_downloaded: false,
      }
    }
    const raw = await fetchCaption(track)
    const segments = track.ext === 'json3' ? parseJson3Transcript(raw) : parseVttTranscript(raw)
    return {
      ok: segments.length > 0,
      exact_blocker: segments.length > 0 ? null : 'youtube_transcript_unavailable',
      video_id: videoId,
      metadata: {
        title: info.title || null,
        channel: info.channel || info.uploader || null,
        duration_seconds: typeof info.duration === 'number' ? info.duration : null,
        webpage_url: info.webpage_url || `https://www.youtube.com/watch?v=${videoId}`,
      },
      language: track.language,
      transcript_source: track.source,
      segments,
      transcript_text: segments.map((segment) => segment.text).join(' '),
      credential_values_exposed: false,
      cookies_used: false,
      audio_downloaded: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    return {
      ok: false,
      exact_blocker: classifyYouTubeTranscriptError(message),
      video_id: videoId,
      metadata: null,
      language: input.lang || 'en',
      transcript_source: null,
      segments: [] as YouTubeTranscriptSegment[],
      transcript_text: '',
      credential_values_exposed: false,
      cookies_used: false,
      audio_downloaded: false,
    }
  }
}
