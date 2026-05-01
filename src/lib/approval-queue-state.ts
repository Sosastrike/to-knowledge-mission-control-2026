export type ApprovalQueueLike = {
  status?: string | null
  approval_state?: string | null
  ui_state?: string | null
  unified_state?: string | null
  run_status?: string | null
  expires_at?: string | number | null
}

export type ApprovalQueueSummary = {
  total: number
  pending: number
  active_pending: number
  approved: number
  denied: number
  expired: number
  revoked: number
  running: number
  completed: number
  failed: number
  history: number
}

function lower(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function expiryMs(value: string | number | null | undefined): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') return value * 1000
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) return numeric * 1000
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function normalizeApprovalQueueState(row: ApprovalQueueLike, now: Date = new Date()): string {
  const status = lower(row.status || row.approval_state)
  const uiState = lower(row.ui_state || row.unified_state)
  const runStatus = lower(row.run_status)
  const raw = uiState || status || 'unknown'
  const expires = expiryMs(row.expires_at)

  if ((raw === 'pending' || status === 'pending') && expires != null && expires <= now.getTime()) {
    return 'expired'
  }

  if (status === 'approved' && runStatus) {
    if (runStatus === 'completed' || runStatus === 'running' || runStatus === 'failed') return runStatus
    return runStatus
  }

  if (raw === 'approved' && runStatus) return runStatus
  return raw
}

export function isActivePendingApproval(row: ApprovalQueueLike, now: Date = new Date()): boolean {
  return normalizeApprovalQueueState(row, now) === 'pending'
}

export function splitApprovalQueue<T extends ApprovalQueueLike>(rows: T[] = [], now: Date = new Date()): {
  activeApprovals: T[]
  historyApprovals: T[]
} {
  const activeApprovals: T[] = []
  const historyApprovals: T[] = []
  for (const row of rows) {
    if (isActivePendingApproval(row, now)) activeApprovals.push(row)
    else historyApprovals.push(row)
  }
  return { activeApprovals, historyApprovals }
}

export function summarizeApprovalQueue(rows: ApprovalQueueLike[] = [], now: Date = new Date()): ApprovalQueueSummary {
  return rows.reduce<ApprovalQueueSummary>((acc, row) => {
    const normalized = normalizeApprovalQueueState(row, now)
    acc.total += 1
    if (normalized === 'pending') {
      acc.pending += 1
      acc.active_pending += 1
    } else {
      acc.history += 1
    }

    if (normalized === 'approved') acc.approved += 1
    else if (normalized === 'denied') acc.denied += 1
    else if (normalized === 'expired') acc.expired += 1
    else if (normalized === 'revoked') acc.revoked += 1
    else if (normalized === 'running') acc.running += 1
    else if (normalized === 'completed') acc.completed += 1
    else if (normalized === 'failed') acc.failed += 1
    return acc
  }, {
    total: 0,
    pending: 0,
    active_pending: 0,
    approved: 0,
    denied: 0,
    expired: 0,
    revoked: 0,
    running: 0,
    completed: 0,
    failed: 0,
    history: 0,
  })
}
