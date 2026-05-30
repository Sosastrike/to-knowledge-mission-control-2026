import { NextRequest, NextResponse } from 'next/server'

import { requireRole, requireRoleOrAgentScope } from '@/lib/auth'
import { getDatabase, db_helpers } from '@/lib/db'
import { logger } from '@/lib/logger'
import { mutationLimiter } from '@/lib/rate-limit'

type TimelineEntry = {
  event?: unknown
  proof?: unknown
  created_at?: unknown
  timestamp?: unknown
  status?: unknown
  source?: unknown
}

const HIGH_CONFIDENCE_SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]{20,}/gi,
  /sk-[A-Za-z0-9_-]{20,}/gi,
  /xox[baprs]-[A-Za-z0-9-]{20,}/gi,
  /gh[pousr]_[A-Za-z0-9_]{20,}/gi,
  /AIza[0-9A-Za-z_-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g,
  /-----BEGIN (RSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/g,
]

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function hasSecret(value: unknown): boolean {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  return HIGH_CONFIDENCE_SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(serialized || '')
  })
}

function redact(value: unknown, limit = 600): string {
  let output = String(value || '').slice(0, limit)
  for (const pattern of HIGH_CONFIDENCE_SECRET_PATTERNS) {
    pattern.lastIndex = 0
    output = output.replace(pattern, (match) => {
      if (/^Bearer\s+/i.test(match)) return 'Bearer [REDACTED_BEARER]'
      if (/^-----BEGIN/i.test(match)) return '[REDACTED_PRIVATE_KEY]'
      return '[REDACTED_SECRET]'
    })
  }
  return output
}

function normalizeTimelineEntry(entry: TimelineEntry, index: number) {
  return {
    id: `metadata:${index}`,
    source: 'metadata.timeline',
    event: redact(entry.event || entry.source || 'TASK_TIMELINE_EVENT', 120),
    proof: redact(entry.proof || '', 800),
    status: entry.status ? redact(entry.status, 80) : null,
    created_at: redact(entry.created_at || entry.timestamp || '', 80) || null,
  }
}

function normalizeCommentEvent(comment: { id: number; author: string; content: string; created_at: number }) {
  return {
    id: `comment:${comment.id}`,
    source: 'comments',
    event: 'TASK_COMMENT',
    actor: redact(comment.author, 120),
    proof: redact(comment.content, 800),
    status: null,
    created_at: comment.created_at,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const resolvedParams = await params
    const taskId = Number.parseInt(resolvedParams.id, 10)
    const workspaceId = auth.user.workspace_id ?? 1

    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const db = getDatabase()
    const task = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND workspace_id = ?')
      .get(taskId, workspaceId) as { id: number; title: string; metadata?: string; status?: string; updated_at?: number } | undefined

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const metadata = parseMetadata(task.metadata)
    const timeline = Array.isArray(metadata.timeline) ? metadata.timeline as TimelineEntry[] : []
    const comments = db
      .prepare('SELECT id, author, content, created_at FROM comments WHERE task_id = ? AND workspace_id = ? ORDER BY created_at ASC')
      .all(taskId, workspaceId) as Array<{ id: number; author: string; content: string; created_at: number }>

    return NextResponse.json({
      ok: true,
      route: `/api/tasks/${taskId}/events`,
      source: 'sqlite_tasks_comments_and_metadata_timeline',
      task_id: taskId,
      task_title: redact(task.title, 200),
      task_status: redact(task.status || '', 80),
      events: [
        ...timeline.map(normalizeTimelineEntry),
        ...comments.map(normalizeCommentEvent),
      ],
      total: timeline.length + comments.length,
      secrets_exposed: false,
      raw_env_values_exposed: false,
      credential_values_exposed: false,
    })
  } catch (error) {
    logger.error({ err: error }, 'GET /api/tasks/[id]/events error')
    return NextResponse.json({ error: 'Failed to fetch task events' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRoleOrAgentScope(request, 'operator', ['ron.task_event_write', 'sofia.task_event_write', 'spaceagent.task_event_write'])
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const resolvedParams = await params
    const taskId = Number.parseInt(resolvedParams.id, 10)
    const workspaceId = auth.user.workspace_id ?? 1

    if (Number.isNaN(taskId)) {
      return NextResponse.json({ error: 'Invalid task ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    if (hasSecret(body)) {
      return NextResponse.json({
        error: 'task_event_secret_value_rejected',
        secrets_exposed: false,
        raw_env_values_exposed: false,
        credential_values_exposed: false,
      }, { status: 400 })
    }

    const db = getDatabase()
    const task = db
      .prepare('SELECT * FROM tasks WHERE id = ? AND workspace_id = ?')
      .get(taskId, workspaceId) as { id: number; title: string; metadata?: string } | undefined

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const now = Math.floor(Date.now() / 1000)
    const metadata = parseMetadata(task.metadata)
    const timeline = Array.isArray(metadata.timeline) ? metadata.timeline as TimelineEntry[] : []
    const event = {
      event: redact(body.event || 'TASK_EVENT', 160),
      proof: redact(body.proof || body.summary || '', 1000),
      status: body.status ? redact(body.status, 80) : null,
      created_at: new Date(now * 1000).toISOString(),
      source: 'api.tasks.events',
    }

    const updatedMetadata = {
      ...metadata,
      timeline: [...timeline, event],
    }

    db.prepare(`
      INSERT INTO comments (task_id, author, content, created_at, mentions, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      taskId,
      auth.user.display_name || auth.user.username || 'system',
      [event.event, event.proof].filter(Boolean).join(': '),
      now,
      null,
      workspaceId,
    )

    db.prepare('UPDATE tasks SET metadata = ?, updated_at = ? WHERE id = ? AND workspace_id = ?')
      .run(JSON.stringify(updatedMetadata), now, taskId, workspaceId)

    db_helpers.logActivity(
      'task_event_added',
      'task',
      taskId,
      auth.user.display_name || auth.user.username || 'system',
      `Added event to task: ${task.title}`,
      { task_id: taskId, event: event.event, status: event.status },
      workspaceId,
    )

    return NextResponse.json({
      ok: true,
      route: `/api/tasks/${taskId}/events`,
      task_id: taskId,
      event,
      secrets_exposed: false,
      raw_env_values_exposed: false,
      credential_values_exposed: false,
    }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'POST /api/tasks/[id]/events error')
    return NextResponse.json({ error: 'Failed to add task event' }, { status: 500 })
  }
}
