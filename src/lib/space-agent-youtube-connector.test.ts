import { describe, expect, it } from 'vitest'
import { createSpaceAgentYouTubeConnectorPacket } from './space-agent-youtube-connector'

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
  })
})
