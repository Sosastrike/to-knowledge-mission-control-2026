import { describe, expect, it } from 'vitest'
import { createSpaceAgentYouTubeConnectorPacket } from './space-agent-youtube-connector'
import { getYouTubeTranscriptConnectorStatus, resetYouTubeTranscriptConnectorCacheForTests } from './space-agent-youtube-runtime'

describe('Space Agent YouTube connector', () => {
  it('returns a safe YouTube research packet without exposing secrets or paths', async () => {
    const result = await createSpaceAgentYouTubeConnectorPacket({
      request: 'Inspect this public YouTube video transcript first: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      responsibleAgent: 'agent_zero',
      requestedBy: 'gateway',
    })

    expect(result.packet.schema).toBe('youtube_research_packet_v1')
    expect(result.packet.mode).toBe('youtube_research_packet')
    expect(result.packet.full_video_download_allowed).toBe(false)
    expect(result.packet.no_secrets_exposed).toBe(true)
    expect(result.packet.no_raw_paths).toBe(true)
    expect(result.packet.youtube_research_intent.video_url).toContain('youtube.com/watch')
    expect(['ready', 'limited', 'blocked']).toContain(result.packet.status)
    expect(result.connector_status).toMatchObject({
      mode: 'space_agent_youtube_transcript_connector_status',
      metadata_enabled: true,
      dependency: 'youtube_transcript_api',
      no_secrets_exposed: true,
      no_raw_paths: true,
      no_fake_done: true,
      proof_packet: {
        full_video_download_enabled: false,
        login_bypass_enabled: false,
      },
    })
    expect(JSON.stringify(result)).not.toMatch(/sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{20,}|auth\.json|\/Users\/sosastrike/i)
  })

  it('classifies transcript connector availability without fake transcript proof', () => {
    resetYouTubeTranscriptConnectorCacheForTests()
    const status = getYouTubeTranscriptConnectorStatus({ timestamp: '2026-05-09T00:00:00.000Z' })

    expect(status.proof_packet).toMatchObject({
      lane: 'SpaceAgent YouTube',
      connector: 'youtube_transcript_api',
      metadata_enabled: true,
      full_video_download_enabled: false,
      login_bypass_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    })
    if (status.ok) {
      expect(status).toMatchObject({ canonical_status: 'READY', blocker_class: 'NONE', blocked_reason: null })
    } else {
      expect(status).toMatchObject({
        canonical_status: 'SERVICE_DOWN',
        blocker_class: 'SERVICE_DOWN',
        blocked_reason: 'youtube_transcript_connector_not_installed',
        legacy_blocker: 'youtube_transcript_connector_not_proven',
      })
    }
  })
})
