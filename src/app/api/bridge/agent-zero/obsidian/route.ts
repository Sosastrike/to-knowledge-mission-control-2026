import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import {
  getAgentZeroObsidianStatus,
  readAgentZeroObsidianNote,
  searchAgentZeroObsidianNotes,
  summarizeAgentZeroObsidianNote,
} from '@/lib/agent-zero-obsidian-adapter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const limited = readLimiter(request)
  if (limited) return limited

  const url = new URL(request.url)
  const action = (url.searchParams.get('action') || 'status').toLowerCase()
  const limit = Number(url.searchParams.get('limit') || '5')

  if (action === 'status') {
    return noStore(NextResponse.json({
      ...getAgentZeroObsidianStatus(),
      adapter_scope: {
        list_vault_status: true,
        search_notes: true,
        read_safe_note_by_path_or_title: true,
        summarize_note: true,
        write_enabled: false,
        direct_filesystem_exposed: false,
      },
    }))
  }

  if (action === 'search') {
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const result = searchAgentZeroObsidianNotes({
      query,
      limit: Number.isFinite(limit) ? limit : 5,
    })
    return noStore(NextResponse.json({
      ok: result.ok,
      mode: 'agent_zero_obsidian_read_only_adapter',
      action: 'search',
      status: result.status,
      query: result.query,
      results: result.results,
      read_only: true,
      write_enabled: false,
      execution_enabled: false,
      direct_filesystem_exposed: false,
      blockers: result.blockers,
    }, { status: result.ok ? 200 : 400 }))
  }

  if (action === 'read') {
    const result = readAgentZeroObsidianNote({
      path: url.searchParams.get('path'),
      title: url.searchParams.get('title'),
    })
    return noStore(NextResponse.json({
      ...result,
      action: 'read',
    }, { status: result.ok ? 200 : 404 }))
  }

  if (action === 'summarize') {
    const result = summarizeAgentZeroObsidianNote({
      path: url.searchParams.get('path'),
      title: url.searchParams.get('title'),
    })
    return noStore(NextResponse.json({
      ...result,
      action: 'summarize',
    }, { status: result.ok ? 200 : 404 }))
  }

  return noStore(NextResponse.json({
    ok: false,
    mode: 'agent_zero_obsidian_read_only_adapter',
    error: 'unsupported_obsidian_adapter_action',
    allowed_actions: ['status', 'search', 'read', 'summarize'],
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
  }, { status: 400 }))
}
