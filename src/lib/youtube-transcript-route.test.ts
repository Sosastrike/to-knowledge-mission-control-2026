import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const requireRoleMock = vi.hoisted(() => vi.fn())
const readYouTubeTranscriptMock = vi.hoisted(() => vi.fn())
const ensureTaskMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({
  requireRole: requireRoleMock,
}))

vi.mock('@/lib/public-research', () => ({
  readYouTubeTranscript: readYouTubeTranscriptMock,
}))

vi.mock('@/lib/agent-routing-lines', () => ({
  ensureAgentRoutingVisibleTask: ensureTaskMock,
}))

describe('/api/youtube/transcript route', () => {
  beforeEach(() => {
    requireRoleMock.mockReset()
    readYouTubeTranscriptMock.mockReset()
    ensureTaskMock.mockReset()
    ensureTaskMock.mockReturnValue({ task_id: 10 })
  })

  it('returns 401 unauthenticated', async () => {
    requireRoleMock.mockReturnValue({ error: 'Authentication required', status: 401 })
    const route = await import('@/app/api/youtube/transcript/route')
    const response = await route.GET(new NextRequest('http://localhost/api/youtube/transcript?id=L1Aqy6jGJec'))
    expect(response.status).toBe(401)
    expect(readYouTubeTranscriptMock).not.toHaveBeenCalled()
    expect(ensureTaskMock).not.toHaveBeenCalled()
  })

  it('returns transcript payload for authenticated public video request', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    readYouTubeTranscriptMock.mockResolvedValue({
      ok: true,
      video_id: 'L1Aqy6jGJec',
      title: 'ELRS binding',
      channel: 'Example',
      duration_seconds: 120,
      segments: [{ start: 0, dur: 4, duration: 4, text: 'Bind your ELRS receiver.' }],
      exact_blocker: null,
      credential_values_exposed: false,
    })
    const route = await import('@/app/api/youtube/transcript/route')
    const response = await route.GET(new NextRequest('http://localhost/api/youtube/transcript?id=https://youtu.be/L1Aqy6jGJec&lang=en'))
    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload).toMatchObject({
      ok: true,
      video_id: 'L1Aqy6jGJec',
      title: 'ELRS binding',
      credential_values_exposed: false,
      visible_task_id: expect.any(String),
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      hallucinated_content: false,
      webfetch_primary_used: false,
      firecrawl_primary_used: false,
      no_secrets_exposed: true,
    })
    expect(ensureTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Jarvis Video Intelligence — YouTube Transcript Request',
      assigned_to: 'agent-zero-jarvis',
      blocker: null,
    }))
    expect(readYouTubeTranscriptMock).toHaveBeenCalledWith({ id: 'https://youtu.be/L1Aqy6jGJec', lang: 'en' })
  })

  it('returns blocker status for inaccessible videos without invented content', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    readYouTubeTranscriptMock.mockResolvedValue({
      ok: false,
      video_id: 'private12345',
      segments: [],
      exact_blocker: 'youtube_transcript_unavailable',
      credential_values_exposed: false,
    })
    const route = await import('@/app/api/youtube/transcript/route')
    const response = await route.GET(new NextRequest('http://localhost/api/youtube/transcript?id=private12345'))
    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload).toMatchObject({
      ok: false,
      exact_blocker: 'youtube_transcript_unavailable',
      credential_values_exposed: false,
      visible_task_id: expect.any(String),
      owner_visible_task_route: expect.stringMatching(/^\/api\/tasks\/\d+$/),
      hallucinated_content: false,
      webfetch_primary_used: false,
      firecrawl_primary_used: false,
    })
    expect(ensureTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      blocker: 'youtube_transcript_unavailable',
      metadata: expect.objectContaining({
        youtube_transcript_route_first: true,
        webfetch_primary_used: false,
        firecrawl_primary_used: false,
        hallucinated_content: false,
      }),
    }))
  })

  it('handles the required Hermes WebUI YouTube URL through the transcript route first', async () => {
    requireRoleMock.mockReturnValue({ user: { role: 'viewer' } })
    readYouTubeTranscriptMock.mockResolvedValue({
      ok: false,
      video_id: 'OrgBvEd4oQI',
      title: 'FREE Hermes Agent Web UI Just Changed Everything.',
      segments: [],
      transcript_status: 'unavailable',
      exact_blocker: 'youtube_transcript_unavailable',
      credential_values_exposed: false,
      cookies_used: false,
      private_video_bypass_used: false,
    })

    const route = await import('@/app/api/youtube/transcript/route')
    const response = await route.GET(new NextRequest('http://localhost/api/youtube/transcript?url=https://youtu.be/OrgBvEd4oQI?si=tlRP3NLWYHwZj0V2'))

    expect(response.status).toBe(422)
    const payload = await response.json()
    expect(payload).toMatchObject({
      ok: false,
      video_id: 'OrgBvEd4oQI',
      title: 'FREE Hermes Agent Web UI Just Changed Everything.',
      transcript_status: 'unavailable',
      exact_blocker: 'youtube_transcript_unavailable',
      hallucinated_content: false,
      webfetch_primary_used: false,
      firecrawl_primary_used: false,
      visible_task_id: expect.any(String),
    })
    expect(readYouTubeTranscriptMock).toHaveBeenCalledWith({
      id: 'https://youtu.be/OrgBvEd4oQI?si=tlRP3NLWYHwZj0V2',
      lang: 'en',
    })
    expect(ensureTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      blocker: 'youtube_transcript_unavailable',
      metadata: expect.objectContaining({
        youtube_transcript_route_first: true,
        webfetch_primary_used: false,
        firecrawl_primary_used: false,
        hallucinated_content: false,
        requested_source: 'https://youtu.be/OrgBvEd4oQI?si=tlRP3NLWYHwZj0V2',
      }),
    }))
  })
})
