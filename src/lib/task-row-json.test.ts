import { describe, expect, it } from 'vitest'

import { TASK_SORT_TIMESTAMP_SQL, parseTaskMetadata, parseTaskTags } from './task-row-json'

describe('task row JSON normalization', () => {
  it('keeps JSON tags and metadata intact', () => {
    expect(parseTaskTags('["jarvis","hermes"]')).toEqual(['jarvis', 'hermes'])
    expect(parseTaskMetadata('{"progress":75,"blocker":null}')).toEqual({ progress: 75, blocker: null })
  })

  it('normalizes legacy comma-separated tags without crashing /api/tasks', () => {
    expect(parseTaskTags('mission-control-live,jarvis,hermes,tickets')).toEqual([
      'mission-control-live',
      'jarvis',
      'hermes',
      'tickets',
    ])
  })

  it('redacts malformed legacy metadata instead of throwing', () => {
    expect(parseTaskMetadata('mission-control-live')).toEqual({ legacy_metadata_parse_error: true })
  })

  it('exports a SQLite sort expression that normalizes legacy text dates', () => {
    expect(TASK_SORT_TIMESTAMP_SQL).toContain("strftime('%s', t.created_at)")
    expect(TASK_SORT_TIMESTAMP_SQL).toContain('CAST(t.created_at AS INTEGER)')
  })
})
