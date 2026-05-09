import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { dispatchApprovedBuildWikiRunNow } from '@/lib/build-wiki-run-now-dispatch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

// POST /api/bridge/brain-sync/build-wiki/run-now/[id]/dispatch
//
// This endpoint is intentionally thin: all hard guards and the exact
// `systemctl --user start opencloud-docs-farmer.service` dispatch live in
// dispatchApprovedBuildWikiRunNow(). Keeping the dispatcher in lib lets the
// owner approval route invoke the same scoped execution path immediately after
// an exact buildwiki.run_now approval is granted.
export async function POST(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  const result = await dispatchApprovedBuildWikiRunNow({
    approvalId: id,
    requester: {
      userId: Number.isInteger(auth.user.id) ? auth.user.id : null,
      username: auth.user.username || auth.user.display_name || 'mission-control',
    },
  })

  return NextResponse.json(result, { status: result.http_status })
}
