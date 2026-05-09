import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import {
  getAgentZeroObsidianStatus,
  type AgentZeroObsidianStatus,
  readAgentZeroObsidianNote,
  searchAgentZeroObsidianNotes,
  summarizeAgentZeroObsidianNote,
} from '@/lib/agent-zero-obsidian-adapter'
import { describeOwnerFacingStatus } from '@/lib/owner-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function noStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

function describeObsidianOwnerStatus(status: Pick<AgentZeroObsidianStatus, 'ok' | 'status' | 'blockers'>) {
  const serviceDown = status.blockers.some((blocker) =>
    /obsidian_(?:vault_missing_or_unreadable|status_probe_failed)/.test(blocker),
  )
  return describeOwnerFacingStatus({
    rawStatus: status.ok ? 'read_only' : serviceDown ? 'service_down' : 'blocked',
    blockers: status.blockers,
    connected: status.ok,
    readEnabled: status.ok,
    writeEnabled: false,
    executionEnabled: false,
    preferReadyWhenReadable: true,
  })
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
    const status = getAgentZeroObsidianStatus()
    return noStore(NextResponse.json({
      ...status,
      owner_status: describeObsidianOwnerStatus(status),
      adapter_scope: {
        list_vault_status: true,
        search_notes: true,
        read_safe_note_by_path_or_title: true,
        summarize_note: true,
        write_enabled: false,
        bridge_session_write_gateway: '/api/bridge/agent-zero/execute',
        bridge_session_write_actions: [
          'obsidian.note.create',
          'obsidian.note.update',
          'obsidian.note.append_report_summary',
          'obsidian.note.tag',
          'obsidian.note.link_task_report',
        ],
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
      owner_status: describeObsidianOwnerStatus({
        ok: result.ok,
        status: result.status,
        blockers: result.blockers,
      }),
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
      owner_status: describeObsidianOwnerStatus(result),
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
      owner_status: describeObsidianOwnerStatus(result),
    }, { status: result.ok ? 200 : 404 }))
  }

  const blockers = ['unsupported_obsidian_adapter_action']
  return noStore(NextResponse.json({
    ok: false,
    mode: 'agent_zero_obsidian_read_only_adapter',
    error: blockers[0],
    owner_status: describeObsidianOwnerStatus({
      ok: false,
      status: 'blocked',
      blockers,
    }),
    allowed_actions: ['status', 'search', 'read', 'summarize'],
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
  }, { status: 400 }))
}
