import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { isValidFilename, isValidType, readFileSafe } from '@/lib/build-wiki-files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = Promise<{ type: string; name: string }>

// ---------------------------------------------------------------------------
// GET /api/bridge/brain-sync/build-wiki/files/[type]/[name]
//
// Returns the full metadata of one file inside the OpenCloud vault subtree
// plus its UTF-8 content (capped at MAX_VIEW_BYTES, bytes-only — no eval, no
// markdown render, no link traversal).
//
// Hard guards:
//   - type must be 'raw' or 'wiki' (any other value → 400)
//   - name must match the filename allowlist (.md, no '..', no separators,
//     no leading dot/dash → 400)
//   - the realpath of {dir}/{name} must equal the canonical type dir's
//     realpath as parent (no symlink escape → 404)
//   - secret-pattern hits in the body cause `content` to be replaced with
//     null and `secrets_present` to be true; metadata still returned
//
// This endpoint NEVER writes, edits, or deletes anything; it only reads.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }
  const { type, name } = await params

  if (!isValidType(type)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_type', type, expected: ['raw', 'wiki'] },
      { status: 400 },
    )
  }
  if (!isValidFilename(name)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_filename', name },
      { status: 400 },
    )
  }

  const file = await readFileSafe(type, name)
  if (!file) {
    return NextResponse.json(
      { ok: false, error: 'file_not_found_or_out_of_scope', type, name },
      { status: 404 },
    )
  }

  return NextResponse.json(
    {
      ok: true,
      mode: 'build_wiki_file_read_only',
      generated_at: new Date().toISOString(),
      file,
      no_writes_enabled: true,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
