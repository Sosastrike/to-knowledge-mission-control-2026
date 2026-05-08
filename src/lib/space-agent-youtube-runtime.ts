import { spawnSync } from 'node:child_process'

let cached: boolean | null = null

export function isYouTubeTranscriptConnectorAvailable(): boolean {
  if (cached !== null) return cached
  const result = spawnSync('python3', ['-c', 'import youtube_transcript_api'], {
    stdio: 'ignore',
    timeout: 1000,
    shell: false,
    env: { ...process.env, PATH: process.env.PATH || '/usr/bin:/bin' },
  })
  cached = result.status === 0
  return cached
}

export function resetYouTubeTranscriptConnectorCacheForTests() {
  cached = null
}
