import { readPublicWebpage } from '@/lib/public-research-tools'
import { readYouTubeTranscript } from '@/lib/youtube-transcript-tool'

export const JARVIS_PUBLIC_WEBPAGE_READ_ADAPTER_ID = 'public_webpage_read'
export const JARVIS_PUBLIC_WEBPAGE_READ_ACTION = 'web.public_page.read'
export const JARVIS_PUBLIC_WEBPAGE_READ_SESSION_SCOPE = 'public_webpage_read'
export const JARVIS_PUBLIC_WEBPAGE_READ_SCOPE = { connector: 'web', operation: 'public_read_only' } as const

export const JARVIS_YOUTUBE_TRANSCRIPT_ADAPTER_ID = 'youtube_transcript'
export const JARVIS_YOUTUBE_TRANSCRIPT_ACTION = 'youtube.transcript.read'
export const JARVIS_YOUTUBE_TRANSCRIPT_SESSION_SCOPE = 'youtube_transcript_read'
export const JARVIS_YOUTUBE_TRANSCRIPT_SCOPE = { connector: 'youtube', operation: 'transcript_read_only' } as const

type AdapterInput = {
  action: string
  scope: Record<string, unknown>
  input?: Record<string, unknown>
}

function scopeMatches(scope: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.entries(expected).every(([key, value]) => scope[key] === value)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function executeJarvisPublicWebpageRead(input: AdapterInput) {
  if (input.action !== JARVIS_PUBLIC_WEBPAGE_READ_ACTION || !scopeMatches(input.scope, JARVIS_PUBLIC_WEBPAGE_READ_SCOPE)) {
    return {
      ok: false,
      adapter_id: JARVIS_PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      action: input.action,
      exact_blocker: 'exact_scope_required_public_webpage_read',
      proof: null,
      external_state_changed: false,
      credential_values_exposed: false,
      cookies_used: false,
      writes_enabled: false,
    }
  }
  const url = asString(input.input?.url)
  if (!url) {
    return {
      ok: false,
      adapter_id: JARVIS_PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      action: input.action,
      exact_blocker: 'public_read_url_required',
      proof: null,
      external_state_changed: false,
      credential_values_exposed: false,
      cookies_used: false,
      writes_enabled: false,
    }
  }
  const proof = await readPublicWebpage({ url })
  return {
    ok: proof.ok,
    adapter_id: JARVIS_PUBLIC_WEBPAGE_READ_ADAPTER_ID,
    action: input.action,
    exact_blocker: proof.exact_blocker,
    proof,
    external_state_changed: false,
    credential_values_exposed: false,
    cookies_used: false,
    writes_enabled: false,
  }
}

export async function executeJarvisYouTubeTranscriptRead(input: AdapterInput) {
  if (input.action !== JARVIS_YOUTUBE_TRANSCRIPT_ACTION || !scopeMatches(input.scope, JARVIS_YOUTUBE_TRANSCRIPT_SCOPE)) {
    return {
      ok: false,
      adapter_id: JARVIS_YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      action: input.action,
      exact_blocker: 'exact_scope_required_youtube_transcript_read',
      proof: null,
      external_state_changed: false,
      credential_values_exposed: false,
      cookies_used: false,
      audio_downloaded: false,
      writes_enabled: false,
    }
  }
  const id = asString(input.input?.id) || asString(input.input?.url) || asString(input.input?.video_id)
  if (!id) {
    return {
      ok: false,
      adapter_id: JARVIS_YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      action: input.action,
      exact_blocker: 'youtube_video_id_required',
      proof: null,
      external_state_changed: false,
      credential_values_exposed: false,
      cookies_used: false,
      audio_downloaded: false,
      writes_enabled: false,
    }
  }
  const proof = await readYouTubeTranscript({ id, lang: asString(input.input?.lang) || 'en' })
  return {
    ok: proof.ok,
    adapter_id: JARVIS_YOUTUBE_TRANSCRIPT_ADAPTER_ID,
    action: input.action,
    exact_blocker: proof.exact_blocker,
    proof,
    external_state_changed: false,
    credential_values_exposed: false,
    cookies_used: false,
    audio_downloaded: false,
    writes_enabled: false,
  }
}
