import { spawnSync } from 'node:child_process'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

export type YouTubeTranscriptProofPacket = {
  lane: 'SpaceAgent YouTube'
  timestamp: string
  runtime_commit: string | null
  route_or_service_checked: string
  result: MissionControlCanonicalStatus
  blocker: string | null
  blocker_class: MissionControlClosureBlockerClass
  audit_pointer: string | null
  safe_log_pointer: string | null
  rollback_command: string
  connector: 'youtube_transcript_api'
  metadata_enabled: true
  transcript_connector_proven: boolean
  full_video_download_enabled: false
  login_bypass_enabled: false
  secrets_exposed: false
  raw_paths_exposed: false
}

export type YouTubeTranscriptConnectorStatus = {
  ok: boolean
  mode: 'space_agent_youtube_transcript_connector_status'
  status: 'ready_for_transcript_smoke' | 'limited'
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  metadata_enabled: true
  transcript_connector_proven: boolean
  blocked_reason: string | null
  legacy_blocker: 'youtube_transcript_connector_not_proven' | null
  dependency: 'youtube_transcript_api'
  python_command: 'python3'
  no_secrets_exposed: true
  no_raw_paths: true
  no_fake_done: true
  proof_packet: YouTubeTranscriptProofPacket
}

let cached: YouTubeTranscriptConnectorStatus | null = null

export function isYouTubeTranscriptConnectorAvailable(): boolean {
  return getYouTubeTranscriptConnectorStatus().ok
}

export function getYouTubeTranscriptConnectorStatus(input: {
  timestamp?: string
  routeOrServiceChecked?: string
  runtimeCommit?: string | null
  rollbackCommand?: string
} = {}): YouTubeTranscriptConnectorStatus {
  if (cached !== null && !input.timestamp && !input.routeOrServiceChecked && !input.runtimeCommit && !input.rollbackCommand) return cached
  const result = spawnSync('python3', ['-c', 'import youtube_transcript_api'], {
    stdio: 'ignore',
    timeout: 1000,
    shell: false,
    env: { ...process.env, PATH: process.env.PATH || '/usr/bin:/bin' },
  })
  const available = result.status === 0
  const blockedReason = available ? null : 'youtube_transcript_connector_not_installed'
  const status: YouTubeTranscriptConnectorStatus = {
    ok: available,
    mode: 'space_agent_youtube_transcript_connector_status',
    status: available ? 'ready_for_transcript_smoke' : 'limited',
    canonical_status: available ? 'READY' : 'SERVICE_DOWN',
    blocker_class: available ? 'NONE' : 'SERVICE_DOWN',
    metadata_enabled: true,
    transcript_connector_proven: available,
    blocked_reason: blockedReason,
    legacy_blocker: available ? null : 'youtube_transcript_connector_not_proven',
    dependency: 'youtube_transcript_api',
    python_command: 'python3',
    no_secrets_exposed: true,
    no_raw_paths: true,
    no_fake_done: true,
    proof_packet: {
      lane: 'SpaceAgent YouTube',
      timestamp: input.timestamp || new Date().toISOString(),
      runtime_commit: input.runtimeCommit || null,
      route_or_service_checked: input.routeOrServiceChecked || '/api/gateway/space-agent/youtube/status',
      result: available ? 'READY' : 'SERVICE_DOWN',
      blocker: blockedReason,
      blocker_class: available ? 'NONE' : 'SERVICE_DOWN',
      audit_pointer: available ? '/api/gateway/space-agent/youtube/status' : null,
      safe_log_pointer: null,
      rollback_command: input.rollbackCommand || 'git revert <day-07-spaceagent-youtube-commit>',
      connector: 'youtube_transcript_api',
      metadata_enabled: true,
      transcript_connector_proven: available,
      full_video_download_enabled: false,
      login_bypass_enabled: false,
      secrets_exposed: false,
      raw_paths_exposed: false,
    },
  }
  if (!input.timestamp && !input.routeOrServiceChecked && !input.runtimeCommit && !input.rollbackCommand) cached = status
  return status
}

export function resetYouTubeTranscriptConnectorCacheForTests() {
  cached = null
}
