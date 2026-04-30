import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { clampLineRequest, readFarmerLogTail } from '@/lib/build-wiki-logs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/bridge/brain-sync/build-wiki/logs
//
// Read-only tail of /home/tony/.openclaw/logs/opencloud-docs-farmer.log.
//
// Query params:
//   lines  1–500 (default 200)
//
// Hard guards:
//   - log path is a module constant (env override allowed but not user input)
//   - tail is capped to 256 KB read window from end-of-file
//   - lines clamped to MAX_LOG_LINES = 500
//   - every line scanned for secret patterns; matches replaced with
//     "[REDACTED <pattern_name>]" before returning
//
// This endpoint NEVER writes, edits, or deletes the log.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const lines = clampLineRequest(url.searchParams.get('lines'))

  const tail = await readFarmerLogTail(lines)
  if (!tail) {
    return NextResponse.json(
      {
        ok: false,
        error: 'farmer_log_not_found',
        log_path: '/home/tony/.openclaw/logs/opencloud-docs-farmer.log',
      },
      { status: 404 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'build_wiki_log_read_only',
      generated_at: new Date().toISOString(),
      requested_lines: lines,
      ...tail,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
