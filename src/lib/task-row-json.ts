export function parseTaskTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean)
  }

  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch {
    // Legacy rows sometimes stored comma-separated tags instead of JSON.
  }

  return trimmed.split(',').map((item) => item.trim()).filter(Boolean)
}

export function parseTaskMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  if (typeof value !== 'string') return {}
  const trimmed = value.trim()
  if (!trimmed) return {}

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // Do not let one malformed legacy metadata cell take down /api/tasks.
  }

  return { legacy_metadata_parse_error: true }
}

export const TASK_SORT_TIMESTAMP_SQL = `
  CASE
    WHEN typeof(t.created_at) = 'integer' THEN t.created_at
    WHEN typeof(t.created_at) = 'real' THEN CAST(t.created_at AS INTEGER)
    WHEN typeof(t.created_at) = 'text' AND t.created_at GLOB '[0-9][0-9][0-9][0-9]-*' THEN CAST(strftime('%s', t.created_at) AS INTEGER)
    WHEN typeof(t.created_at) = 'text' THEN CAST(t.created_at AS INTEGER)
    ELSE 0
  END
`
