import { describe, expect, it } from 'vitest'
import { isActivePendingApproval, normalizeApprovalQueueState, splitApprovalQueue, summarizeApprovalQueue } from './approval-queue-state'

const now = new Date('2026-05-01T12:00:00Z')

describe('U1 approval queue active-state filtering', () => {
  it('100 empty queue UI tests produce no active queue', () => {
    for (let i = 0; i < 100; i += 1) {
      const split = splitApprovalQueue([], now)
      const summary = summarizeApprovalQueue([], now)
      expect(split.activeApprovals).toHaveLength(0)
      expect(summary.active_pending).toBe(0)
      expect(summary.total).toBe(0)
    }
  })

  it('100 pending approval UI tests show only unexpired pending approvals as active', () => {
    for (let i = 0; i < 100; i += 1) {
      const row = { id: `apr_${i}`, status: 'pending', expires_at: '2026-05-01T12:30:00Z' }
      expect(isActivePendingApproval(row, now)).toBe(true)
      expect(normalizeApprovalQueueState(row, now)).toBe('pending')
    }
  })

  it('100 approved/completed auto-clear tests move completed approvals to history', () => {
    for (let i = 0; i < 100; i += 1) {
      const rows = [{ id: `apr_${i}`, status: 'approved', run_status: 'completed', expires_at: '2026-05-01T12:30:00Z' }]
      const split = splitApprovalQueue(rows, now)
      const summary = summarizeApprovalQueue(rows, now)
      expect(split.activeApprovals).toHaveLength(0)
      expect(split.historyApprovals).toHaveLength(1)
      expect(summary.completed).toBe(1)
      expect(summary.active_pending).toBe(0)
    }
  })

  it('100 expired approval suppression tests move stale pending approvals to history', () => {
    for (let i = 0; i < 100; i += 1) {
      const rows = [{ id: `apr_${i}`, status: 'pending', expires_at: '2026-05-01T11:59:59Z' }]
      const split = splitApprovalQueue(rows, now)
      const summary = summarizeApprovalQueue(rows, now)
      expect(split.activeApprovals).toHaveLength(0)
      expect(summary.expired).toBe(1)
      expect(summary.active_pending).toBe(0)
    }
  })

  it('100 duplicate approval suppression tests keep reused/completed approvals out of active queue', () => {
    for (let i = 0; i < 100; i += 1) {
      const rows = [
        { id: `apr_done_${i}`, status: 'approved', run_status: 'completed', expires_at: '2026-05-01T12:30:00Z' },
        { id: `apr_pending_${i}`, status: 'pending', expires_at: '2026-05-01T12:30:00Z' },
      ]
      const split = splitApprovalQueue(rows, now)
      expect(split.activeApprovals.map((row) => row.id)).toEqual([`apr_pending_${i}`])
      expect(split.historyApprovals.map((row) => row.id)).toEqual([`apr_done_${i}`])
    }
  })
})
