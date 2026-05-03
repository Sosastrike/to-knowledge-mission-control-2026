import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { buildAgentZeroEcosystemContext } from '@/lib/agent-zero-ecosystem-context'
import { createAgentZeroReport, shouldCreateAgentZeroReportFromMessage } from '@/lib/agent-zero-report-delivery'
import {
  getAgentZeroApiKeyState,
  probeAgentZeroRuntime,
  sendAgentZeroReadOnlyMessage,
} from '@/lib/agent-zero-bridge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const [runtimeStatus, apiKey, context] = await Promise.all([
    probeAgentZeroRuntime(),
    Promise.resolve(getAgentZeroApiKeyState()),
    buildAgentZeroEcosystemContext(),
  ])

  return NextResponse.json({
    ok: true,
    mode: 'agent_zero_read_only_test_channel',
    generated_at: new Date().toISOString(),
    label: 'Agent Zero - read-only ecosystem test',
    runtime: runtimeStatus,
    agent_zero_api_key_configured: apiKey.present,
    context,
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    status: runtimeStatus.reachable
      ? (apiKey.present ? 'ready_for_read_only_chat' : 'blocked_missing_agent_zero_api_key')
      : 'unreachable',
    execution_enabled: false,
    writes_enabled: false,
    protected_actions_enabled: false,
    next_action: apiKey.present
      ? 'Use POST /api/bridge/agent-zero/test-chat for read-only live Agent Zero context tests.'
      : 'Owner must configure an Agent Zero external API key for Mission Control before live chat can be proxied.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let message = ''
  let body: Record<string, unknown> = {}
  try {
    const parsed = await request.json()
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    message = typeof body?.message === 'string' ? body.message.trim() : ''
  } catch {
    message = ''
    body = {}
  }

  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        error: 'message_required',
        execution_enabled: false,
        writes_enabled: false,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const context = await buildAgentZeroEcosystemContext()
  const result = await sendAgentZeroReadOnlyMessage({
    ownerMessage: message.slice(0, 4000),
    context,
  })

  const createReport = Boolean(body.create_report) || shouldCreateAgentZeroReportFromMessage(message)
  const reportDelivery = result.ok && createReport
    ? await createAgentZeroReport({
        title: typeof body.report_title === 'string' ? body.report_title : 'Agent Zero Mission Control Report',
        summary: 'Agent Zero created this report from a read-only Mission Control test chat response.',
        ownerMessage: message,
        requestedDelivery: body.requested_delivery || body.requestedDelivery,
        source: 'test_chat',
        sections: [
          { heading: 'Owner request', body: message.slice(0, 2000) },
          { heading: 'Agent Zero response', body: result.response_text || 'Agent Zero returned an empty response.' },
          { heading: 'Safety contract', body: [
            'Mission Control report delivery is local and safe-link only.',
            'No protected actions were executed.',
            'No external writes were executed.',
            'Raw local filesystem paths are not exposed in the normal reply.',
          ] },
        ],
      })
    : null

  return NextResponse.json({
    ...result,
    label: 'Agent Zero - read-only ecosystem test',
    context_sent: context,
    ecosystem_context_endpoint: '/api/bridge/agent-zero/ecosystem',
    bridge_session_endpoint: '/api/bridge/agent-zero/bridge-session',
    report_delivery: reportDelivery ? {
      report: reportDelivery.report,
      attachments: reportDelivery.attachments,
      normal_reply: reportDelivery.report.normal_reply,
      mission_control_report_link: reportDelivery.report.mission_control_url,
    } : null,
    safety: {
      execution_enabled: false,
      writes_enabled: false,
      local_report_artifact_created: Boolean(reportDelivery),
      external_delivery_writes_enabled: false,
      telegram_attachment_sent: false,
      zapier_writes_enabled: false,
      heygen_generation_enabled: false,
      smb_enabled: false,
      farmer_execution_enabled: false,
      raw_local_paths_exposed: false,
    },
    next_action: reportDelivery
      ? 'Open the Mission Control report link or download the PDF/Markdown report from Mission Control; external delivery remains disabled unless explicitly approved and wired.'
      : result.ok
        ? 'Review Agent Zero answer against the read-only context; execution remains disabled.'
        : 'Configure Agent Zero external API access or resolve the runtime blocker, then rerun the read-only test.',
  }, {
    status: result.ok ? 200 : result.status,
    headers: { 'Cache-Control': 'no-store' },
  })
}
