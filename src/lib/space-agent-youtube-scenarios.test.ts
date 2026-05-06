import { describe, expect, it } from 'vitest'

import { createYouTubeResearchPacket } from './space-agent-research'

const generatedAt = '2026-05-06T00:00:00.000Z'

function expectReadOnlyYouTubePacket(packet: ReturnType<typeof createYouTubeResearchPacket>) {
  expect(packet.research_stage_owner).toBe('space_agent')
  expect(packet.route.hops).toEqual(['owner', 'gateway', 'pi', 'gateway', 'agent_zero', 'gateway', 'space_agent'])
  expect(packet.return_route.hops).toEqual(['space_agent', 'gateway', 'agent_zero'])
  expect(packet.official_paths_first).toBe(true)
  expect(packet.allowed_paths).toEqual(['official', 'transcript', 'metadata'])
  expect(packet.full_video_download_allowed).toBe(false)
  expect(packet.full_video_download_blocked_by_default).toBe(true)
  expect(packet.no_secrets_exposed).toBe(true)
  expect(packet.no_raw_paths).toBe(true)
}

describe('Space Agent YouTube scenario planning', () => {
  it('detects YouTube URLs and extracts metadata fields from supplied safe sources', () => {
    const packet = createYouTubeResearchPacket({
      request: 'Inspect this YouTube URL and metadata first: https://www.youtube.com/watch?v=phase221',
      requestedBy: 'owner',
      generatedAt,
      youtubeSources: [{
        video_url: 'https://www.youtube.com/watch?v=phase221',
        title: 'Gateway Space Agent Research Demo',
        channel: 'Knowledge vs AI',
        transcript_status: 'unknown',
      }],
      description: 'A public overview of Gateway-routed research packets.',
    })

    expect(packet.youtube_research_intent.video_url).toBe('https://www.youtube.com/watch?v=phase221')
    expect(packet.youtube_research_intent.video_id).toBe('phase221')
    expect(packet.metadata).toMatchObject({
      title: 'Gateway Space Agent Research Demo',
      channel: 'Knowledge vs AI',
      description: 'A public overview of Gateway-routed research packets.',
      url: 'https://www.youtube.com/watch?v=phase221',
      metadata_status: 'available',
      video_id: 'phase221',
    })
    expect(packet.citations).toContain('https://www.youtube.com/watch?v=phase221')
    expectReadOnlyYouTubePacket(packet)
  })

  it('marks transcripts available or unavailable without pretending live video access', () => {
    const available = createYouTubeResearchPacket({
      request: 'Inspect YouTube transcript for https://youtu.be/transcript123',
      generatedAt,
      videoUrl: 'https://youtu.be/transcript123',
      title: 'Transcript Available Demo',
      transcriptSegments: [
        { segment_id: 'intro', start_seconds: 0, end_seconds: 9, text: 'Gateway routes YouTube transcript research to Space Agent.' },
      ],
    })
    const unavailable = createYouTubeResearchPacket({
      request: 'Inspect YouTube metadata only for https://youtu.be/missing456',
      generatedAt,
      videoUrl: 'https://youtu.be/missing456',
      title: 'Transcript Missing Demo',
      channel: 'Knowledge vs AI',
    })

    expect(available.status).toBe('ready')
    expect(available.transcript_status).toBe('available')
    expect(available.captions_available).toBe(true)
    expect(available.transcript_segments[0]).toMatchObject({
      segment_id: 'intro',
      start_seconds: 0,
      end_seconds: 9,
      source: 'official_transcript',
      no_secrets_exposed: true,
    })
    expect(available.key_claims[0]).toMatchObject({
      claim: 'Gateway routes YouTube transcript research to Space Agent.',
      source_segment_ids: ['intro'],
      needs_verification: true,
    })
    expectReadOnlyYouTubePacket(available)

    expect(unavailable.status).toBe('limited')
    expect(unavailable.transcript_status).toBe('missing')
    expect(unavailable.captions_available).toBe(false)
    expect(unavailable.blocked_reason).toBe('youtube_transcript_unavailable')
    expect(unavailable.key_claims).toEqual([])
    expect(unavailable.limitations).toContain('Transcript or captions unavailable; key claims are limited to supplied metadata and cannot be treated as transcript-backed.')
    expectReadOnlyYouTubePacket(unavailable)
  })

  it('summarizes long videos into bounded transcript-backed claims with timestamps', () => {
    const transcriptSegments = Array.from({ length: 20 }, (_, index) => ({
      segment_id: `segment-${index + 1}`,
      start_seconds: index * 60,
      end_seconds: index * 60 + 45,
      text: `Claim ${index + 1}: Space Agent keeps YouTube research read-only and returns evidence through Gateway.`,
    }))

    const packet = createYouTubeResearchPacket({
      request: 'Summarize this long YouTube video from transcript evidence: https://www.youtube.com/watch?v=longvideo',
      generatedAt,
      videoUrl: 'https://www.youtube.com/watch?v=longvideo',
      title: 'Long Gateway Research Session',
      channel: 'Knowledge vs AI',
      transcriptSegments,
      chapters: [
        { title: 'Opening context', start_seconds: 0, end_seconds: 300 },
        { title: 'Research workflow', start_seconds: 301, end_seconds: 900 },
      ],
    })

    expect(packet.status).toBe('ready')
    expect(packet.transcript_segments).toHaveLength(20)
    expect(packet.key_claims).toHaveLength(12)
    expect(packet.key_claims[0]).toMatchObject({
      claim: 'Claim 1: Space Agent keeps YouTube research read-only and returns evidence through Gateway.',
      source_segment_ids: ['segment_1'],
    })
    expect(packet.transcript_segments[11]).toMatchObject({
      segment_id: 'segment_12',
      start_seconds: 660,
      end_seconds: 705,
    })
    expect(packet.chapters).toEqual([
      expect.objectContaining({ title: 'Opening context', start_seconds: 0, end_seconds: 300 }),
      expect.objectContaining({ title: 'Research workflow', start_seconds: 301, end_seconds: 900 }),
    ])
    expectReadOnlyYouTubePacket(packet)
  })

  it('blocks full video download by default and removes unapproved frame references', () => {
    const packet = createYouTubeResearchPacket({
      request: 'Download the full YouTube video from https://youtu.be/download999',
      generatedAt,
      videoUrl: 'https://youtu.be/download999',
      title: 'Download Block Demo',
      transcriptSegments: [{ text: 'Transcript text is allowed, but full video download is not.' }],
      frameCaptures: [{ timestamp_seconds: 120, reference: 'local-frame-reference' }],
    })

    expect(packet.status).toBe('blocked')
    expect(packet.blocked_reason).toBe('copyrighted_video_download_blocked_by_default')
    expect(packet.full_video_download_allowed).toBe(false)
    expect(packet.full_video_download_blocked_by_default).toBe(true)
    expect(packet.limitations).toContain('Full video download is blocked by default unless explicitly authorized and legal.')
    expect(packet.frame_captures[0]).toMatchObject({
      timestamp_seconds: 120,
      status: 'blocked',
      reference: null,
      blocked_reason: 'youtube_frame_capture_tooling_not_approved',
      no_raw_paths: true,
    })
    expectReadOnlyYouTubePacket(packet)
  })
})
