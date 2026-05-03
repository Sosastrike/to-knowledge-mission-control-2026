import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { readLimiter } from '@/lib/rate-limit'
import {
  getAgentZeroMemPalaceStatus,
  queryAgentZeroMemPalaceSummary,
} from '@/lib/agent-zero-mempalace-adapter'

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

  if (action === 'status') {
    return noStore(NextResponse.json({
      ...getAgentZeroMemPalaceStatus(),
      adapter_scope: {
        list_mempalace_status: true,
        query_memory_index_status: true,
        retrieve_safe_memory_summaries: true,
        raw_private_dump_enabled: false,
        write_enabled: false,
        direct_write_route_enabled: false,
        bridge_session_write_gateway: '/api/bridge/agent-zero/execute',
        bridge_session_write_actions: [
          'mempalace.memory.remember_task_result',
          'mempalace.memory.remember_owner_preference',
          'mempalace.memory.update_safe_summary',
          'mempalace.memory.link_report_task',
        ],
        write_requires_bridge_session: true,
        owner_visible_summary_required: true,
        overwrite_without_audit_enabled: false,
        direct_filesystem_exposed: false,
      },
    }))
  }

  if (action === 'query' || action === 'summary') {
    const query = url.searchParams.get('q') || url.searchParams.get('query') || ''
    const result = queryAgentZeroMemPalaceSummary({
      query,
      action: action as 'query' | 'summary',
    })
    return noStore(NextResponse.json({
      ...result,
      note: 'This adapter returns counts and safe summaries only. It does not return raw MemPalace records, embeddings, or private memory dumps.',
    }, { status: result.ok ? 200 : 400 }))
  }

  return noStore(NextResponse.json({
    ok: false,
    mode: 'agent_zero_mempalace_read_only_adapter',
    error: 'unsupported_mempalace_adapter_action',
    allowed_actions: ['status', 'query', 'summary'],
    write_actions_available_through_bridge_session_gateway: [
      'mempalace.memory.remember_task_result',
      'mempalace.memory.remember_owner_preference',
      'mempalace.memory.update_safe_summary',
      'mempalace.memory.link_report_task',
    ],
    read_only: true,
    write_enabled: false,
    execution_enabled: false,
    direct_filesystem_exposed: false,
    raw_private_dump_enabled: false,
  }, { status: 400 }))
}
