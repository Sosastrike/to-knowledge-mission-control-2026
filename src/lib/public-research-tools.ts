import { isIP } from 'node:net'

import { normalizeYouTubeVideoId } from '@/lib/youtube-transcript-tool'

export type PublicReadUrlClassification = {
  ok: boolean
  url: string | null
  hostname: string | null
  blocker: string | null
}

export type UrlIntent = {
  kind: 'none' | 'youtube' | 'public_webpage'
  url: string | null
  video_id: string | null
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')\]]+/i
const YOUTUBE_HOST_PATTERN = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i
const PRIVATE_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

function normalizeHost(hostname: string) {
  return hostname.trim().toLowerCase().replace(/\.$/, '')
}

function redactedUrl(parsed: URL) {
  const copy = new URL(parsed.toString())
  copy.username = ''
  copy.password = ''
  return copy.toString()
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  const [a, b] = parts
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isPrivateOrLocalHost(hostname: string) {
  const host = normalizeHost(hostname)
  if (PRIVATE_HOSTS.has(host)) return true
  if (host.endsWith('.local') || host.endsWith('.localhost') || host.endsWith('.ts.net')) return true
  if (isPrivateIpv4(host)) return true
  const ipType = isIP(host)
  if (ipType === 6) {
    return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')
  }
  return false
}

export function classifyPublicReadUrl(rawUrl: string): PublicReadUrlClassification {
  let parsed: URL
  try {
    parsed = new URL(rawUrl.trim())
  } catch {
    return { ok: false, url: null, hostname: null, blocker: 'public_read_invalid_url' }
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, url: parsed.toString(), hostname: parsed.hostname, blocker: 'public_read_requires_http_get' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, url: redactedUrl(parsed), hostname: parsed.hostname, blocker: 'public_read_rejects_url_credentials' }
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return { ok: false, url: parsed.toString(), hostname: parsed.hostname, blocker: 'public_read_rejects_private_or_local_target' }
  }

  return { ok: true, url: parsed.toString(), hostname: parsed.hostname, blocker: null }
}

export function extractUrlIntent(message: string): UrlIntent {
  const match = message.match(URL_PATTERN)
  if (!match) return { kind: 'none', url: null, video_id: null }
  const url = match[0].replace(/[.,;:!?]+$/, '')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'none', url: null, video_id: null }
  }
  const hostname = normalizeHost(parsed.hostname)
  if (YOUTUBE_HOST_PATTERN.test(hostname)) {
    const videoId = normalizeYouTubeVideoId(parsed.toString())
    return { kind: 'youtube', url: parsed.toString(), video_id: videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? videoId : null }
  }
  return { kind: 'public_webpage', url: parsed.toString(), video_id: null }
}

function significantTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 4 && !['https', 'http', 'www', 'com', 'this', 'that', 'with', 'from', 'task'].includes(token)),
  )
}

export function shouldInjectRecentTaskContextForUrlTurn(input: {
  ownerMessage: string
  taskContext: string
}): { inject: boolean; stale_context_suppressed: boolean; relevance_score: number } {
  const intent = extractUrlIntent(input.ownerMessage)
  if (intent.kind === 'none' || !intent.url) return { inject: true, stale_context_suppressed: false, relevance_score: 1 }

  const messageTaskId = input.ownerMessage.match(/\btask\s*#?\s*(\d+)\b/i)?.[1]
  if (messageTaskId && new RegExp(`\\btask\\s*#?\\s*${messageTaskId}\\b`, 'i').test(input.taskContext)) {
    return { inject: true, stale_context_suppressed: false, relevance_score: 1 }
  }

  const parsed = new URL(intent.url)
  const host = normalizeHost(parsed.hostname).replace(/^www\./, '')
  const context = input.taskContext.toLowerCase()
  if (host && context.includes(host)) return { inject: true, stale_context_suppressed: false, relevance_score: 0.8 }

  const ownerTokens = significantTokens(input.ownerMessage)
  const contextTokens = significantTokens(input.taskContext)
  const overlap = [...ownerTokens].filter((token) => contextTokens.has(token)).length
  const denominator = Math.max(1, Math.min(ownerTokens.size, 8))
  const score = overlap / denominator
  const inject = score >= 0.35
  return { inject, stale_context_suppressed: !inject, relevance_score: Number(score.toFixed(2)) }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTag(html: string, pattern: RegExp) {
  const match = html.match(pattern)
  return match?.[1]?.replace(/\s+/g, ' ').trim() || null
}

export async function readPublicWebpage(input: { url: string; timeoutMs?: number }) {
  const classification = classifyPublicReadUrl(input.url)
  if (!classification.ok || !classification.url) {
    return {
      ok: false,
      exact_blocker: classification.blocker || 'public_read_invalid_url',
      url: classification.url,
      title: null,
      metadata: {},
      text: '',
      text_excerpt: '',
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
    }
  }

  const response = await fetch(classification.url, {
    method: 'GET',
    headers: {
      Accept: 'text/html,text/plain,application/xhtml+xml',
      'User-Agent': 'MissionControl-JarvisPublicRead/1.0',
    },
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(input.timeoutMs ?? 8000),
  })
  const finalClassification = classifyPublicReadUrl(response.url)
  if (!finalClassification.ok) {
    return {
      ok: false,
      exact_blocker: finalClassification.blocker || 'public_read_redirected_to_blocked_target',
      url: classification.url,
      final_url: response.url,
      title: null,
      metadata: {},
      text: '',
      text_excerpt: '',
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      exact_blocker: response.status === 401 || response.status === 403 ? 'public_read_auth_or_private_content_required' : 'public_read_tool_failed',
      url: classification.url,
      final_url: response.url,
      http_status: response.status,
      title: null,
      metadata: {},
      text: '',
      text_excerpt: '',
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
    }
  }
  const contentType = response.headers.get('content-type') || ''
  if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
    return {
      ok: false,
      exact_blocker: 'public_read_unsupported_content_type',
      url: classification.url,
      final_url: response.url,
      http_status: response.status,
      content_type: contentType,
      title: null,
      metadata: {},
      text: '',
      text_excerpt: '',
      credential_values_exposed: false,
      cookies_used: false,
      auth_headers_used: false,
      writes_enabled: false,
    }
  }
  const html = (await response.text()).slice(0, 1_500_000)
  const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
    extractTag(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  const description = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
    extractTag(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  const text = stripHtml(html)
  return {
    ok: Boolean(text || title || description),
    exact_blocker: text || title || description ? null : 'public_read_no_visible_content',
    url: classification.url,
    final_url: response.url,
    http_status: response.status,
    content_type: contentType,
    title,
    metadata: { description },
    text,
    text_excerpt: text.slice(0, 5000),
    credential_values_exposed: false,
    cookies_used: false,
    auth_headers_used: false,
    writes_enabled: false,
  }
}
