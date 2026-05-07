import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildPaperclipSpaceAgentResearchTaskPayload } from '@/lib/paperclip-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  return NextResponse.json({
    ok: true,
    mode: 'paperclip_space_agent_research_tasks_route_read_only',
    generated_at: new Date().toISOString(),
    paperclip_agent: {
      id: 'space_agent',
      appears_as_paperclip_agent: true,
      role: 'browser_web_youtube_firecrawl_research_specialist',
      status: 'read_only_virtual_agent',
      supervisors: ['agent_zero', 'hermes', 'pi'],
    },
    accepted_task_types: ['web_research', 'youtube_research', 'firecrawl_task'],
    selected_route: ['agent_zero', 'gateway', 'paperclip', 'space_agent'],
    return_route: ['space_agent', 'gateway', 'agent_zero'],
    paperclip_tracking: 'blocked_until_bridge_session_and_write_adapter',
    research_packet_return: 'enabled_read_only',
    gateway_validates_evidence: true,
    agent_zero_routes_next_step: true,
    responsible_agent_final_task: 'planned_or_completed_from_valid_research_packet',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    no_secrets_exposed: true,
    raw_paths_exposed: false,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let parsed: Record<string, unknown> = {}
  try {
    const body = await request.json()
    parsed = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    parsed = {}
  }

  const evidence = Array.isArray(parsed.evidence)
    ? parsed.evidence.filter((item): item is { summary: string } => Boolean(item) && typeof item === 'object' && typeof (item as { summary?: unknown }).summary === 'string')
    : undefined
  const webSources = Array.isArray(parsed.web_sources)
    ? parsed.web_sources.filter((item): item is Record<string, string> => Boolean(item) && typeof item === 'object')
    : undefined
  const youtubeSources = Array.isArray(parsed.youtube_sources)
    ? parsed.youtube_sources.filter((item): item is Record<string, string> => Boolean(item) && typeof item === 'object')
    : undefined

  const payload = await buildPaperclipSpaceAgentResearchTaskPayload({
    requester: typeof parsed.requester === 'string' ? parsed.requester : 'agent_zero',
    taskType: typeof parsed.task_type === 'string' ? parsed.task_type : (typeof parsed.taskType === 'string' ? parsed.taskType : null),
    request: typeof parsed.request === 'string' ? parsed.request : (typeof parsed.owner_request === 'string' ? parsed.owner_request : null),
    responsibleAgent: typeof parsed.responsible_agent === 'string' ? parsed.responsible_agent : (typeof parsed.responsibleAgent === 'string' ? parsed.responsibleAgent : null),
    firecrawlConfigured: parsed.firecrawl_configured === true,
    generatedAt: new Date().toISOString(),
    bridgeSessionActive: false,
    evidence,
    webSources,
    youtubeSources,
  })

  return NextResponse.json(payload, {
    status: payload.requester === 'blocked' ? 403 : 409,
    headers: { 'Cache-Control': 'no-store' },
  })
}
