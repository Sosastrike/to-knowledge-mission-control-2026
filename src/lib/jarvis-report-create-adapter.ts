import {
  createAgentZeroReport,
  type AgentZeroReportCreationResult,
  type AgentZeroReportSection,
} from '@/lib/agent-zero-report-delivery'

export const JARVIS_REPORT_CREATE_ADAPTER_ID = 'agent_zero_report_create'
export const JARVIS_REPORT_CREATE_ACTION = 'agent_zero.report.create'
export const JARVIS_REPORT_CREATE_SESSION_SCOPE = 'agent_zero_report_create'

type JarvisReportCreateInput = {
  action?: string
  scope?: Record<string, unknown>
  input?: Record<string, unknown>
}

type JarvisReportCreateDeps = {
  createReport?: (input: {
    title: string
    summary: string
    sections: AgentZeroReportSection[]
    source: 'api'
    requestedDelivery: Array<{ provider: 'mission_control'; requested_by_owner: false }>
  }) => Promise<AgentZeroReportCreationResult>
}

export type JarvisReportCreateResult = {
  ok: boolean
  adapter_id: typeof JARVIS_REPORT_CREATE_ADAPTER_ID
  action: string
  report_created: boolean
  report_id: string | null
  mission_control_url: string | null
  markdown_url: string | null
  pdf_url: string | null
  attachment_types: string[]
  external_delivery_requested: false
  external_delivery_performed: false
  credential_values_exposed: false
  raw_paths_exposed: false
  protected_actions_executed: false
  exact_blocker: string | null
}

function text(value: unknown, fallback: string, max = 240) {
  const raw = typeof value === 'string' ? value.trim() : ''
  return (raw || fallback).slice(0, max)
}

function normalizeSections(value: unknown): AgentZeroReportSection[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const heading = text(row.heading, 'Jarvis Report Section', 120)
      const body = Array.isArray(row.body)
        ? row.body.map((line) => text(line, '', 1200)).filter(Boolean)
        : text(row.body, '', 2400)
      return body && (Array.isArray(body) ? body.length : true) ? { heading, body } : null
    })
    .filter((item): item is AgentZeroReportSection => Boolean(item))
    .slice(0, 12)
}

function exactScope(action: string, scope: Record<string, unknown>) {
  return (
    action === JARVIS_REPORT_CREATE_ACTION &&
    scope.system === 'mission_control' &&
    scope.operation === 'create_report' &&
    scope.target === 'internal_report'
  )
}

export async function executeJarvisReportCreate(
  input: JarvisReportCreateInput,
  deps: JarvisReportCreateDeps = {},
): Promise<JarvisReportCreateResult> {
  const action = typeof input.action === 'string' ? input.action.trim() : ''
  const scope = input.scope && typeof input.scope === 'object' && !Array.isArray(input.scope) ? input.scope : {}
  if (!exactScope(action, scope)) {
    return {
      ok: false,
      adapter_id: JARVIS_REPORT_CREATE_ADAPTER_ID,
      action: action || 'unknown',
      report_created: false,
      report_id: null,
      mission_control_url: null,
      markdown_url: null,
      pdf_url: null,
      attachment_types: [],
      external_delivery_requested: false,
      external_delivery_performed: false,
      credential_values_exposed: false,
      raw_paths_exposed: false,
      protected_actions_executed: false,
      exact_blocker: 'exact_scope_required_agent_zero_internal_report_create',
    }
  }

  try {
    const body = input.input && typeof input.input === 'object' && !Array.isArray(input.input) ? input.input : {}
    const createReport = deps.createReport || createAgentZeroReport
    const report = await createReport({
      title: text(body.title, 'Jarvis Mission Control Execution Report'),
      summary: text(body.summary, 'Jarvis created this internal Mission Control report through an exact-scope adapter.', 1200),
      sections: normalizeSections(body.sections),
      source: 'api',
      requestedDelivery: [{ provider: 'mission_control', requested_by_owner: false }],
    })

    return {
      ok: true,
      adapter_id: JARVIS_REPORT_CREATE_ADAPTER_ID,
      action: JARVIS_REPORT_CREATE_ACTION,
      report_created: true,
      report_id: report.report.id,
      mission_control_url: report.report.mission_control_url,
      markdown_url: report.report.markdown_url,
      pdf_url: report.report.pdf_url,
      attachment_types: report.attachments.map((attachment) => attachment.type),
      external_delivery_requested: false,
      external_delivery_performed: false,
      credential_values_exposed: false,
      raw_paths_exposed: false,
      protected_actions_executed: false,
      exact_blocker: null,
    }
  } catch {
    return {
      ok: false,
      adapter_id: JARVIS_REPORT_CREATE_ADAPTER_ID,
      action: JARVIS_REPORT_CREATE_ACTION,
      report_created: false,
      report_id: null,
      mission_control_url: null,
      markdown_url: null,
      pdf_url: null,
      attachment_types: [],
      external_delivery_requested: false,
      external_delivery_performed: false,
      credential_values_exposed: false,
      raw_paths_exposed: false,
      protected_actions_executed: false,
      exact_blocker: 'agent_zero_internal_report_create_failed',
    }
  }
}
