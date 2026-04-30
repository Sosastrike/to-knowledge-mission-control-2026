import { NextRequest, NextResponse } from 'next/server'
import { authJson } from '@/lib/designer-module-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ReportPreviewRequest = {
  owner_goal?: string
  expected_outcome?: string
  task_type?: string
  preflight_decision?: string
  selected_route?: string
  fallback_route?: string
  selected_tools?: string[]
  selected_models?: string[]
  selected_skills?: string[]
  selected_integrations?: string[]
  approval_gates?: string[]
  missing_credentials?: string[]
  risks?: string[]
  next_action?: string
}

function asList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}

function bulletList(items: string[], fallback: string): string {
  if (!items.length) return `- ${fallback}`
  return items.map((item) => `- ${item}`).join('\n')
}

function plainSummary(input: ReportPreviewRequest) {
  const goal = input.owner_goal?.trim() || 'the requested Mission Control task'
  const outcome = input.expected_outcome?.trim() || 'a safe, owner-readable result'
  const decision = input.preflight_decision?.trim() || 'read-only preflight pending'
  const approvals = asList(input.approval_gates)
  const credentials = asList(input.missing_credentials)

  const blockers = [
    approvals.length ? 'owner approval is required before protected action' : '',
    credentials.length ? 'some credentials are missing' : '',
  ].filter(Boolean)

  return [
    `Sir, the goal is to handle ${goal}.`,
    `The expected result is ${outcome}.`,
    `Bridge Mode currently says: ${decision}.`,
    blockers.length
      ? `The current blocker is: ${blockers.join(' and ')}.`
      : 'There is no protected execution approved from this preview.',
    'This preview does not execute anything, create approvals, or change production data.',
  ].join(' ')
}

function detailedMarkdown(input: ReportPreviewRequest) {
  const tools = asList(input.selected_tools)
  const models = asList(input.selected_models)
  const skills = asList(input.selected_skills)
  const integrations = asList(input.selected_integrations)
  const approvals = asList(input.approval_gates)
  const credentials = asList(input.missing_credentials)
  const risks = asList(input.risks)

  return `# Mission Control Executive Report Preview

Status: preview only; no execution, no persistence, no Telegram send.

## Owner Goal

${input.owner_goal?.trim() || 'Not provided.'}

## Expected Outcome

${input.expected_outcome?.trim() || 'Not provided.'}

## Bridge Mode Preflight

- Task type: ${input.task_type || 'unknown'}
- Decision: ${input.preflight_decision || 'unknown'}
- Selected route: ${input.selected_route || 'unknown'}
- Fallback route: ${input.fallback_route || 'unknown'}

## Selected Tools

${bulletList(tools, 'No tools selected yet.')}

## Selected Models

${bulletList(models, 'No models selected yet.')}

## Selected Skills

${bulletList(skills, 'No skills selected yet.')}

## Selected Integrations

${bulletList(integrations, 'No integrations selected yet.')}

## Approval Gates

${bulletList(approvals, 'No approval gates listed in the preview.')}

## Missing Credentials

${bulletList(credentials, 'No missing credentials listed in the preview.')}

## 10-Check Validation Summary

1. Missing credentials: ${credentials.length ? 'blocked by credential names listed above' : 'none listed'}
2. Missing tools: verify through Bridge Mode capability matrix
3. Missing approvals: ${approvals.length ? 'approval required' : 'none listed'}
4. Duplicate paths: use canonical Bridge Mode path
5. Security risks: ${risks.length ? 'see risks below' : 'none listed'}
6. Cost/rate-limit risks: not evaluated in this preview
7. Rollback plan: required before protected execution
8. Production impact: protected execution remains disabled
9. Owner action required: ${approvals.length || credentials.length ? 'yes' : 'not from this preview'}
10. Autonomous readiness: blocked until approval/credential gates are cleared

## Risks

${bulletList(risks, 'No risks listed in the preview.')}

## Next Action

${input.next_action?.trim() || 'Run Bridge Mode preflight and build the full roadmap before requesting approval.'}
`
}

export async function GET(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  return NextResponse.json({
    ok: true,
    mode: 'executive_report_preview_contract',
    no_execution_enabled: true,
    no_persistence_enabled: true,
    no_telegram_send_enabled: true,
    no_pdf_written: true,
    endpoint: {
      method: 'POST',
      path: '/api/bridge/executive-report-preview',
      description: 'Returns plain-language and detailed markdown report previews without writing files or creating approvals.',
    },
    accepted_fields: [
      'owner_goal',
      'expected_outcome',
      'task_type',
      'preflight_decision',
      'selected_route',
      'fallback_route',
      'selected_tools',
      'selected_models',
      'selected_skills',
      'selected_integrations',
      'approval_gates',
      'missing_credentials',
      'risks',
      'next_action',
    ],
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  const auth = authJson(request, 'viewer')
  if (auth) return auth

  let input: ReportPreviewRequest
  try {
    input = await request.json() as ReportPreviewRequest
  } catch {
    input = {}
  }

  return NextResponse.json({
    ok: true,
    mode: 'executive_report_preview_read_only',
    generated_at: new Date().toISOString(),
    no_execution_enabled: true,
    no_persistence_enabled: true,
    no_telegram_send_enabled: true,
    no_pdf_written: true,
    plain_language_summary: plainSummary(input),
    detailed_report_markdown: detailedMarkdown(input),
    pdf_status: 'BACKEND_REQUIRED',
    telegram_approval_status: 'BACKEND_REQUIRED',
    next_action: 'Use this preview as input for the future PDF/report artifact generator and Telegram approval flow after persistence is approved.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}
