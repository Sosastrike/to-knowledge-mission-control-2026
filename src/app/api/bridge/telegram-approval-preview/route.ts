import { NextRequest, NextResponse } from 'next/server'
import { authJson } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type TelegramApprovalPreviewRequest = {
  owner_goal?: string
  action_label?: string
  risk_level?: string
  selected_route?: string
  approval_gates?: string[]
  missing_credentials?: string[]
  report_url?: string
  expires_in_minutes?: number
}

function asList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function buildPreview(input: TelegramApprovalPreviewRequest) {
  const ownerGoal = input.owner_goal?.trim() || 'review the protected Mission Control action'
  const actionLabel = input.action_label?.trim() || 'Protected action request'
  const riskLevel = input.risk_level?.trim() || 'high'
  const selectedRoute = input.selected_route?.trim() || 'Bridge Mode preflight route pending'
  const approvalGates = asList(input.approval_gates)
  const missingCredentials = asList(input.missing_credentials)
  const reportUrl = input.report_url?.trim() || null
  const expiresInMinutes = Number.isFinite(input.expires_in_minutes)
    ? Math.max(1, Math.min(1440, Number(input.expires_in_minutes)))
    : 30

  return {
    channel: 'Tony -> Telegram owner approval',
    recipient: 'owner',
    send_state: 'DISABLED',
    approval_request_created: false,
    persistence_state: 'not_connected',
    callback_state: 'BACKEND_REQUIRED',
    buttons: [
      { label: 'Approve', state: 'BACKEND_REQUIRED' },
      { label: 'Deny', state: 'BACKEND_REQUIRED' },
    ],
    message_preview: [
      `Sir, Mission Control needs approval for: ${actionLabel}.`,
      `Goal: ${ownerGoal}.`,
      `Route: ${selectedRoute}.`,
      `Risk: ${riskLevel}.`,
      approvalGates.length ? `Approval gates: ${approvalGates.join(', ')}.` : 'Approval gates: none listed in this preview.',
      missingCredentials.length ? `Missing credentials: ${missingCredentials.join(', ')}.` : 'Missing credentials: none listed in this preview.',
      reportUrl ? `Full report: ${reportUrl}` : 'Full report link: backend required.',
      `This approval would expire in ${expiresInMinutes} minutes.`,
    ].join('\n'),
  }
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'telegram_approval_preview_contract',
    no_execution_enabled: true,
    no_persistence_enabled: true,
    no_telegram_send_enabled: true,
    approval_request_created: false,
    endpoint: {
      method: 'POST',
      path: '/api/bridge/telegram-approval-preview',
      description: 'Returns a disabled Tony-to-Telegram approval message preview without sending or persisting.',
    },
    owner_channel: 'Tony -> Telegram',
    accepted_fields: [
      'owner_goal',
      'action_label',
      'risk_level',
      'selected_route',
      'approval_gates',
      'missing_credentials',
      'report_url',
      'expires_in_minutes',
    ],
    next_action: 'Wire approval/audit persistence and Telegram callback handling before any real approval message can be sent.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  let input: TelegramApprovalPreviewRequest
  try {
    input = await request.json() as TelegramApprovalPreviewRequest
  } catch {
    input = {}
  }

  return NextResponse.json({
    ok: true,
    mode: 'telegram_approval_preview_read_only',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_persistence_enabled: true,
    no_telegram_send_enabled: true,
    approval_request_created: false,
    preview: buildPreview(input),
    next_action: 'Use this preview to design the future Telegram one-click approval request after owner-approved persistence is applied.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
