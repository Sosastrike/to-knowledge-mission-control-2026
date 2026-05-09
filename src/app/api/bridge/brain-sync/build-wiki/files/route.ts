import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { sanitizeBridgeProviderPayload } from '@/lib/bridge-provider-sanitizer'
import {
  FileMeta,
  RAW_DIR,
  WIKI_DIR,
  isValidType,
  listLatestFiles,
  ownerSafeFileMeta,
} from '@/lib/build-wiki-files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET /api/bridge/brain-sync/build-wiki/files
//
// Read-only listing of the most recently modified .md files inside the
// OpenCloud vault subtree. Two query params:
//
//   type   raw | wiki | all   (default 'all')
//   limit  1–200              (default 25)
//
// Response shape:
//   { ok, generated_at,
//     raw:  { dir, count, items: FileMeta[] }   (omitted unless type covers it)
//     wiki: { dir, count, items: FileMeta[] }   (omitted unless type covers it) }
//
// Returns ONLY metadata. File contents come from the per-id route.
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 200

function clampLimit(value: string | null): number {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(n)))
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const url = new URL(request.url)
  const typeParam = (url.searchParams.get('type') || 'all').toLowerCase()
  const limit = clampLimit(url.searchParams.get('limit'))

  if (typeParam !== 'all' && !isValidType(typeParam)) {
    return NextResponse.json(
      { ok: false, error: 'invalid_type', expected: ['raw', 'wiki', 'all'] },
      { status: 400 },
    )
  }

  const wantsRaw = typeParam === 'all' || typeParam === 'raw'
  const wantsWiki = typeParam === 'all' || typeParam === 'wiki'

  const [rawItems, wikiItems] = await Promise.all([
    wantsRaw ? listLatestFiles('raw', limit) : Promise.resolve<FileMeta[]>([]),
    wantsWiki ? listLatestFiles('wiki', limit) : Promise.resolve<FileMeta[]>([]),
  ])

  const response: Record<string, unknown> = {
    ok: true,
    mode: 'build_wiki_files_read_only',
    generated_at: new Date().toISOString(),
    limit,
    type: typeParam,
    immutable_raw: true,
    no_writes_enabled: true,
  }

  if (wantsRaw) {
    response.raw = {
      dir: RAW_DIR,
      count: rawItems.length,
      items: rawItems.map(ownerSafeFileMeta),
    }
  }
  if (wantsWiki) {
    response.wiki = {
      dir: WIKI_DIR,
      count: wikiItems.length,
      items: wikiItems.map(ownerSafeFileMeta),
    }
  }

  return NextResponse.json(sanitizeBridgeProviderPayload(response), { headers: { 'Cache-Control': 'no-store' } })
}
