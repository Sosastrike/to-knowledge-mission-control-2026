import Database from 'better-sqlite3'
import {
  createAgentZeroReport,
  redactUnsafeOwnerText,
  type AgentZeroReportCreationResult,
} from './agent-zero-report-delivery'
import {
  lookupAgentZeroGoogleDriveFolder,
  uploadAgentZeroGoogleDriveTestFile,
  uploadAgentZeroReportToGoogleDrive,
  verifyAgentZeroGoogleDriveLink,
} from './agent-zero-google-drive-delivery'
import {
  lookupAgentZeroOneDriveFolder,
  uploadAgentZeroOneDriveTestFile,
  uploadAgentZeroReportToOneDrive,
  verifyAgentZeroOneDriveLink,
} from './agent-zero-onedrive-delivery'
import {
  linkAgentZeroMemoryToReportTask,
  rememberAgentZeroOwnerPreference,
  rememberAgentZeroTaskResult,
  updateAgentZeroSafeMemorySummary,
} from './agent-zero-mempalace-adapter'
import {
  appendAgentZeroObsidianReportSummary,
  createAgentZeroObsidianNote,
  linkAgentZeroObsidianNoteToTaskReport,
  tagAgentZeroObsidianNote,
  updateAgentZeroObsidianNote,
} from './agent-zero-obsidian-adapter'
import {
  readLatestAgentZeroBridgeSession,
  recordAgentZeroBridgeSessionAudit,
  type AgentZeroBridgeSessionObject,
  type AgentZeroBridgeSessionRequester,
} from './agent-zero-bridge-session'

export const AGENT_ZERO_EXECUTION_GATEWAY_ROUTE = '/api/bridge/agent-zero/execute'

export type AgentZeroExecutionCategory =
  | 'report_creation'
  | 'mission_control_attachment'
  | 'obsidian_adapter'
  | 'mempalace_adapter'
  | 'buildwiki_run_now'
  | 'google_drive_delivery'
  | 'onedrive_delivery'
  | 'mcp_tool'

export type AgentZeroExecutionStatus = 'completed' | 'blocked' | 'failed'

export type AgentZeroExecutionAdapterSummary = {
  action: string
  category: AgentZeroExecutionCategory
  label: string
  description: string
  status: 'available' | 'blocked'
  execution_enabled: boolean
  writes_enabled: boolean
  bridge_session_required: true
  allowed_scope_keys: string[]
  blocked_reason: string | null
  safety: {
    raw_shell_enabled: false
    arbitrary_filesystem_enabled: false
    root_enabled: false
    docker_socket_enabled: false
    direct_secret_reads_enabled: false
  }
}

type AdapterHandlerResult = {
  ok: boolean
  status: AgentZeroExecutionStatus
  normal_reply: string
  blocked_reason: string | null
  result: Record<string, unknown>
}

type AdapterDefinition = AgentZeroExecutionAdapterSummary & {
  handler: (input: AgentZeroExecutionGatewayInput, session: AgentZeroBridgeSessionObject) => Promise<AdapterHandlerResult>
}

export type AgentZeroExecutionGatewayInput = {
  db?: Database.Database
  requester: AgentZeroBridgeSessionRequester
  bridgeSessionId?: string | null
  action: string
  input?: Record<string, unknown>
  reportRoot?: string
  obsidianRoot?: string
  mempalacePaths?: {
    graphDbPath?: string
    dataDir?: string
    chromaDbPath?: string
    summaryDbPath?: string
    configPath?: string
  }
  now?: Date
}

export type AgentZeroExecutionGatewayResult = {
  ok: boolean
  http_status: number
  mode: 'agent_zero_bridge_execution_gateway'
  action: string
  adapter_registered: boolean
  adapter: AgentZeroExecutionAdapterSummary | null
  bridge_session_required: true
  bridge_session: Pick<AgentZeroBridgeSessionObject, 'session_id' | 'status' | 'expires_at' | 'execution_enabled' | 'blocked_reason'>
  execution_enabled: boolean
  accepted_for_execution: boolean
  writes_enabled: boolean
  status: AgentZeroExecutionStatus
  result_checked: true
  no_fake_done: true
  raw_local_paths_exposed: false
  raw_shell_enabled: false
  arbitrary_filesystem_enabled: false
  root_enabled: false
  docker_socket_enabled: false
  direct_secret_reads_enabled: false
  audit: {
    started: boolean
    finished: boolean
    start_event_id: string | null
    finish_event_id: string | null
    blocked_reason: string | null
  }
  result: Record<string, unknown> | null
  normal_reply: string
  blocked_reason: string | null
  error: string | null
}

const SAFETY = {
  raw_shell_enabled: false,
  arbitrary_filesystem_enabled: false,
  root_enabled: false,
  docker_socket_enabled: false,
  direct_secret_reads_enabled: false,
} as const

const FORBIDDEN_ACTION_RE = /\b(shell|exec|command|filesystem|file\.read|secret|docker|root|sudo|env|credential)\b/i

function stringInput(input: Record<string, unknown> | undefined, key: string, fallback = ''): string {
  const value = input?.[key]
  return typeof value === 'string' ? redactUnsafeOwnerText(value).slice(0, 4000) : fallback
}

function objectInput(input: Record<string, unknown> | undefined, key: string): Record<string, unknown> | undefined {
  const value = input?.[key]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function arrayInput(input: Record<string, unknown> | undefined, key: string): unknown[] | undefined {
  const value = input?.[key]
  return Array.isArray(value) ? value : undefined
}

function safeJson(value: unknown): unknown {
  if (typeof value === 'string') return redactUnsafeOwnerText(value)
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(safeJson)
  const output: Record<string, unknown> = {}
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const lowered = key.toLowerCase()
    if (
      lowered === 'internal' ||
      lowered.endsWith('_path') ||
      lowered.endsWith('_dir') ||
      lowered.includes('secret') ||
      lowered.includes('password') ||
      lowered.includes('api_key') ||
      lowered.includes('private_key') ||
      lowered.includes('access_key') ||
      (lowered.includes('token') && lowered !== 'no_tokens_exposed')
    ) continue
    output[key] = safeJson(raw)
  }
  return output
}

function reportExternalDeliveryBlocked(report: AgentZeroReportCreationResult): boolean {
  return report.report.delivery_channels.some((channel) =>
    channel.requested && channel.external_write && channel.status === 'blocked')
}

function publicReportResult(report: AgentZeroReportCreationResult): Record<string, unknown> {
  return {
    report: report.report,
    attachments: report.attachments,
    mission_control_report_link: report.report.mission_control_url,
    raw_local_paths_exposed: false,
  }
}

function blockedResult(normalReply: string, blockedReason: string, extra: Record<string, unknown> = {}): AdapterHandlerResult {
  return {
    ok: false,
    status: 'blocked',
    normal_reply: redactUnsafeOwnerText(normalReply),
    blocked_reason: blockedReason,
    result: {
      ...extra,
      accepted_for_execution: false,
      no_fake_done: true,
      raw_local_paths_exposed: false,
    },
  }
}

function adapterSummaries(): AgentZeroExecutionAdapterSummary[] {
  return ADAPTERS.map(({ handler: _handler, ...summary }) => summary)
}

const ADAPTERS: AdapterDefinition[] = [
  {
    action: 'agent_zero.report.create',
    category: 'report_creation',
    label: 'Create Agent Zero report',
    description: 'Creates a Markdown/PDF report and exposes Mission Control download links without raw local paths.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    allowed_scope_keys: ['agent_zero.reports.create', 'agent_zero.report.create'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const report = await createAgentZeroReport({
        title: stringInput(request.input, 'title', 'Agent Zero Execution Report'),
        summary: stringInput(request.input, 'summary', 'Agent Zero created this report through the Bridge execution gateway.'),
        ownerMessage: stringInput(request.input, 'owner_message'),
        requestedDelivery: request.input?.requested_delivery || request.input?.requestedDelivery,
        source: 'api',
        sections: arrayInput(request.input, 'sections') || [
          { heading: 'Execution gateway', body: 'Agent Zero created this report through a scoped Bridge Session adapter.' },
        ],
        root: request.reportRoot,
      })
      const deliveryBlocked = reportExternalDeliveryBlocked(report)
      return {
        ok: !deliveryBlocked,
        status: deliveryBlocked ? 'blocked' : 'completed',
        normal_reply: report.report.normal_reply,
        blocked_reason: deliveryBlocked ? 'requested_external_delivery_blocked' : null,
        result: {
          ...publicReportResult(report),
          report_created: true,
          delivery_status: deliveryBlocked ? 'blocked' : 'available',
        },
      }
    },
  },
  {
    action: 'mission_control.report.attach',
    category: 'mission_control_attachment',
    label: 'Expose report through Mission Control',
    description: 'Returns Mission Control report links only; Telegram file sending is not enabled by this adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    allowed_scope_keys: ['agent_zero.reports.create', 'mission_control.report.attach'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const report = await createAgentZeroReport({
        title: stringInput(request.input, 'title', 'Agent Zero Mission Control Attachment'),
        summary: stringInput(request.input, 'summary', 'Agent Zero created a Mission Control report link.'),
        ownerMessage: stringInput(request.input, 'owner_message'),
        requestedDelivery: { provider: 'mission_control' },
        source: 'api',
        sections: arrayInput(request.input, 'sections') || [
          { heading: 'Attachment', body: 'This report is available through Mission Control links only.' },
        ],
        root: request.reportRoot,
      })
      return {
        ok: true,
        status: 'completed',
        normal_reply: 'Done. The report is ready in Mission Control.',
        blocked_reason: null,
        result: publicReportResult(report),
      }
    },
  },
  {
    action: 'google_drive.folder_lookup',
    category: 'google_drive_delivery',
    label: 'Google Drive folder lookup',
    description: 'Registered delivery adapter. Currently reports blocked unless a connector invocation adapter is configured.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    allowed_scope_keys: ['google_drive_if_connector_configured'],
    blocked_reason: 'google_drive_folder_lookup_connector_not_configured',
    safety: SAFETY,
    handler: async (request) => {
      const result = await lookupAgentZeroGoogleDriveFolder({ folder: stringInput(request.input, 'folder') || null })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'google_drive.upload_test_file',
    category: 'google_drive_delivery',
    label: 'Google Drive upload test file',
    description: 'External write adapter placeholder. It blocks honestly until upload connector invocation exists.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['google_drive_if_connector_configured'],
    blocked_reason: 'google_drive_upload_connector_not_configured',
    safety: SAFETY,
    handler: async (request, session) => {
      const result = await uploadAgentZeroGoogleDriveTestFile({ folder: stringInput(request.input, 'folder') || null, bridgeSessionId: session.session_id })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'google_drive.upload_report_pdf',
    category: 'google_drive_delivery',
    label: 'Google Drive upload report',
    description: 'External report upload adapter placeholder. It blocks honestly until upload connector invocation exists.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['google_drive_if_connector_configured'],
    blocked_reason: 'google_drive_upload_connector_not_configured',
    safety: SAFETY,
    handler: async (request, session) => {
      const result = await uploadAgentZeroReportToGoogleDrive({
        reportId: stringInput(request.input, 'report_id') || null,
        folder: stringInput(request.input, 'folder') || null,
        bridgeSessionId: session.session_id,
      })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'google_drive.verify_link',
    category: 'google_drive_delivery',
    label: 'Google Drive verify link',
    description: 'Registered verification adapter. It blocks until link verification is configured.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    allowed_scope_keys: ['google_drive_if_connector_configured'],
    blocked_reason: 'google_drive_link_verification_adapter_not_configured',
    safety: SAFETY,
    handler: async (request) => {
      const result = await verifyAgentZeroGoogleDriveLink({ link: stringInput(request.input, 'link') || null })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'onedrive.folder_lookup',
    category: 'onedrive_delivery',
    label: 'OneDrive folder lookup',
    description: 'Registered delivery adapter. Currently reports blocked unless a connector invocation adapter is configured.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    allowed_scope_keys: ['onedrive_if_connector_configured'],
    blocked_reason: 'onedrive_folder_lookup_connector_not_configured',
    safety: SAFETY,
    handler: async (request) => {
      const result = await lookupAgentZeroOneDriveFolder({ folder: stringInput(request.input, 'folder') || null })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'onedrive.upload_test_file',
    category: 'onedrive_delivery',
    label: 'OneDrive upload test file',
    description: 'External write adapter placeholder. It blocks honestly until upload connector invocation exists.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['onedrive_if_connector_configured'],
    blocked_reason: 'onedrive_upload_connector_not_configured',
    safety: SAFETY,
    handler: async (request, session) => {
      const result = await uploadAgentZeroOneDriveTestFile({ folder: stringInput(request.input, 'folder') || null, bridgeSessionId: session.session_id })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'onedrive.upload_report_pdf',
    category: 'onedrive_delivery',
    label: 'OneDrive upload report',
    description: 'External report upload adapter placeholder. It blocks honestly until upload connector invocation exists.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['onedrive_if_connector_configured'],
    blocked_reason: 'onedrive_upload_connector_not_configured',
    safety: SAFETY,
    handler: async (request, session) => {
      const result = await uploadAgentZeroReportToOneDrive({
        reportId: stringInput(request.input, 'report_id') || null,
        folder: stringInput(request.input, 'folder') || null,
        bridgeSessionId: session.session_id,
      })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'onedrive.verify_link',
    category: 'onedrive_delivery',
    label: 'OneDrive verify link',
    description: 'Registered verification adapter. It blocks until link verification is configured.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: false,
    bridge_session_required: true,
    allowed_scope_keys: ['onedrive_if_connector_configured'],
    blocked_reason: 'onedrive_link_verification_adapter_not_configured',
    safety: SAFETY,
    handler: async (request) => {
      const result = await verifyAgentZeroOneDriveLink({ link: stringInput(request.input, 'link') || null })
      return blockedResult(result.normal_reply, result.blocked_reason, result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'buildwiki.run_now',
    category: 'buildwiki_run_now',
    label: 'Build-Wiki Run Now',
    description: 'Scoped Build-Wiki action. This gateway will not run systemctl directly; it requires the registered dispatcher adapter to accept a Bridge Session id.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['buildwiki.run_now'],
    blocked_reason: 'buildwiki_run_now_bridge_session_dispatch_adapter_not_wired',
    safety: SAFETY,
    handler: async () => blockedResult(
      'Build-Wiki Run Now is blocked until the registered dispatcher accepts this Bridge Session id.',
      'buildwiki_run_now_bridge_session_dispatch_adapter_not_wired',
      {
        action: 'buildwiki.run_now',
        target_service: 'opencloud-docs-farmer.service',
        direct_systemctl_from_gateway: false,
      },
    ),
  },
  {
    action: 'obsidian.note.create',
    category: 'obsidian_adapter',
    label: 'Create Obsidian note',
    description: 'Creates one safe Markdown note inside the configured Obsidian vault through the adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['obsidian.write_adapter', 'obsidian.note.create'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = createAgentZeroObsidianNote({
        root: request.obsidianRoot,
        path: stringInput(request.input, 'path') || null,
        title: stringInput(request.input, 'title') || null,
        content: stringInput(request.input, 'content') || null,
        tags: request.input?.tags,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'obsidian_note_create_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'obsidian.note.update',
    category: 'obsidian_adapter',
    label: 'Update Obsidian note',
    description: 'Replaces one safe Markdown note through the Obsidian adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['obsidian.write_adapter', 'obsidian.note.update'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = updateAgentZeroObsidianNote({
        root: request.obsidianRoot,
        path: stringInput(request.input, 'path') || null,
        title: stringInput(request.input, 'title') || null,
        content: stringInput(request.input, 'content') || null,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'obsidian_note_update_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'obsidian.note.append_report_summary',
    category: 'obsidian_adapter',
    label: 'Append report summary to Obsidian note',
    description: 'Appends a bounded report summary section to one safe Markdown note.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['obsidian.write_adapter', 'obsidian.note.append_report_summary'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = appendAgentZeroObsidianReportSummary({
        root: request.obsidianRoot,
        path: stringInput(request.input, 'path') || null,
        title: stringInput(request.input, 'title') || null,
        summary: stringInput(request.input, 'summary') || null,
        reportId: stringInput(request.input, 'report_id') || null,
        reportUrl: stringInput(request.input, 'report_url') || null,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'obsidian_report_summary_append_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'obsidian.note.tag',
    category: 'obsidian_adapter',
    label: 'Tag Obsidian note',
    description: 'Adds safe tags to one Markdown note through the Obsidian adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['obsidian.write_adapter', 'obsidian.note.tag'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = tagAgentZeroObsidianNote({
        root: request.obsidianRoot,
        path: stringInput(request.input, 'path') || null,
        title: stringInput(request.input, 'title') || null,
        tags: request.input?.tags,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'obsidian_note_tag_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'obsidian.note.link_task_report',
    category: 'obsidian_adapter',
    label: 'Link Obsidian note to task or report',
    description: 'Appends safe task/report reference metadata to one Markdown note.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['obsidian.write_adapter', 'obsidian.note.link_task_report'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = linkAgentZeroObsidianNoteToTaskReport({
        root: request.obsidianRoot,
        path: stringInput(request.input, 'path') || null,
        title: stringInput(request.input, 'title') || null,
        taskId: stringInput(request.input, 'task_id') || null,
        reportId: stringInput(request.input, 'report_id') || null,
        reportUrl: stringInput(request.input, 'report_url') || null,
        linkTitle: stringInput(request.input, 'link_title') || null,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'obsidian_task_report_link_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'mempalace.memory.remember_task_result',
    category: 'mempalace_adapter',
    label: 'Remember task result in MemPalace',
    description: 'Stores a bounded owner-visible task-result memory summary through the MemPalace adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['mempalace.write_adapter', 'mempalace.memory.remember_task_result'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = rememberAgentZeroTaskResult({
        ...request.mempalacePaths,
        taskId: stringInput(request.input, 'task_id') || stringInput(request.input, 'taskId') || null,
        resultSummary: stringInput(request.input, 'result_summary') || stringInput(request.input, 'resultSummary') || stringInput(request.input, 'summary') || null,
        reportId: stringInput(request.input, 'report_id') || stringInput(request.input, 'reportId') || null,
        reportUrl: stringInput(request.input, 'report_url') || stringInput(request.input, 'reportUrl') || null,
        confidence: typeof request.input?.confidence === 'number' ? request.input.confidence : undefined,
        tags: request.input?.tags,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'mempalace_task_result_memory_write_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'mempalace.memory.remember_owner_preference',
    category: 'mempalace_adapter',
    label: 'Remember owner preference in MemPalace',
    description: 'Stores a bounded owner-visible preference summary through the MemPalace adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['mempalace.write_adapter', 'mempalace.memory.remember_owner_preference'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = rememberAgentZeroOwnerPreference({
        ...request.mempalacePaths,
        preference: stringInput(request.input, 'preference') || stringInput(request.input, 'summary') || null,
        scope: stringInput(request.input, 'scope') || null,
        confidence: typeof request.input?.confidence === 'number' ? request.input.confidence : undefined,
        tags: request.input?.tags,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'mempalace_owner_preference_memory_write_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'mempalace.memory.update_safe_summary',
    category: 'mempalace_adapter',
    label: 'Update safe MemPalace summary',
    description: 'Appends a new safe summary version for a MemPalace memory key without overwriting prior records.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['mempalace.write_adapter', 'mempalace.memory.update_safe_summary'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = updateAgentZeroSafeMemorySummary({
        ...request.mempalacePaths,
        memoryKey: stringInput(request.input, 'memory_key') || stringInput(request.input, 'memoryKey') || null,
        summary: stringInput(request.input, 'summary') || null,
        ownerVisibleSummary: stringInput(request.input, 'owner_visible_summary') || stringInput(request.input, 'ownerVisibleSummary') || null,
        confidence: typeof request.input?.confidence === 'number' ? request.input.confidence : undefined,
        tags: request.input?.tags,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'mempalace_safe_summary_memory_write_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'mempalace.memory.link_report_task',
    category: 'mempalace_adapter',
    label: 'Link MemPalace memory to task/report',
    description: 'Stores a safe audited memory link to a task and/or report through the MemPalace adapter.',
    status: 'available',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['mempalace.write_adapter', 'mempalace.memory.link_report_task'],
    blocked_reason: null,
    safety: SAFETY,
    handler: async (request) => {
      const result = linkAgentZeroMemoryToReportTask({
        ...request.mempalacePaths,
        memoryKey: stringInput(request.input, 'memory_key') || stringInput(request.input, 'memoryKey') || null,
        taskId: stringInput(request.input, 'task_id') || stringInput(request.input, 'taskId') || null,
        reportId: stringInput(request.input, 'report_id') || stringInput(request.input, 'reportId') || null,
        reportUrl: stringInput(request.input, 'report_url') || stringInput(request.input, 'reportUrl') || null,
        summary: stringInput(request.input, 'summary') || null,
        confidence: typeof request.input?.confidence === 'number' ? request.input.confidence : undefined,
        tags: request.input?.tags,
      })
      return result.ok
        ? {
            ok: true,
            status: 'completed',
            normal_reply: result.normal_reply,
            blocked_reason: null,
            result: result as unknown as Record<string, unknown>,
          }
        : blockedResult(result.normal_reply, result.blockers[0] || 'mempalace_task_report_link_memory_write_failed', result as unknown as Record<string, unknown>)
    },
  },
  {
    action: 'mcp.tool.execute',
    category: 'mcp_tool',
    label: 'MCP tool execution',
    description: 'MCP execution placeholder. It blocks unless the requested tool has a registered invocation adapter and Bridge Session scope.',
    status: 'blocked',
    execution_enabled: true,
    writes_enabled: true,
    bridge_session_required: true,
    allowed_scope_keys: ['mcp.tool.execute'],
    blocked_reason: 'mcp_tool_execution_adapter_not_configured',
    safety: SAFETY,
    handler: async (request) => blockedResult(
      'MCP tool execution is blocked because no invocation adapter is configured for this tool.',
      'mcp_tool_execution_adapter_not_configured',
      {
        requested_server: stringInput(request.input, 'server') || null,
        requested_tool: stringInput(request.input, 'tool') || null,
        tool_input_shape_visible: Boolean(objectInput(request.input, 'tool_input')),
        tool_invoked: false,
      },
    ),
  },
]

export function listAgentZeroExecutionAdapters(): AgentZeroExecutionAdapterSummary[] {
  return adapterSummaries()
}

function findAdapter(action: string): AdapterDefinition | null {
  return ADAPTERS.find((adapter) => adapter.action === action) || null
}

function sessionAllows(adapter: AdapterDefinition, session: AgentZeroBridgeSessionObject): boolean {
  const allowed = new Set([
    ...(session.allowed_tools || []),
    ...(session.allowed_integrations || []),
    ...(session.allowed_models || []),
    ...(session.allowed_brain_access || []),
  ])
  return adapter.allowed_scope_keys.some((key) => allowed.has(key)) || allowed.has(adapter.action)
}

function publicSession(session: AgentZeroBridgeSessionObject): AgentZeroExecutionGatewayResult['bridge_session'] {
  return {
    session_id: session.session_id,
    status: session.status,
    expires_at: session.expires_at,
    execution_enabled: session.execution_enabled,
    blocked_reason: session.blocked_reason,
  }
}

function baseResult(input: {
  action: string
  adapter: AgentZeroExecutionAdapterSummary | null
  session: AgentZeroBridgeSessionObject
  ok: boolean
  httpStatus: number
  accepted: boolean
  status: AgentZeroExecutionStatus
  normalReply: string
  blockedReason: string | null
  error?: string | null
  result?: Record<string, unknown> | null
  audit?: Partial<AgentZeroExecutionGatewayResult['audit']>
}): AgentZeroExecutionGatewayResult {
  return {
    ok: input.ok,
    http_status: input.httpStatus,
    mode: 'agent_zero_bridge_execution_gateway',
    action: input.action,
    adapter_registered: Boolean(input.adapter),
    adapter: input.adapter,
    bridge_session_required: true,
    bridge_session: publicSession(input.session),
    execution_enabled: input.session.execution_enabled,
    accepted_for_execution: input.accepted,
    writes_enabled: Boolean(input.accepted && input.adapter?.writes_enabled),
    status: input.status,
    result_checked: true,
    no_fake_done: true,
    raw_local_paths_exposed: false,
    raw_shell_enabled: false,
    arbitrary_filesystem_enabled: false,
    root_enabled: false,
    docker_socket_enabled: false,
    direct_secret_reads_enabled: false,
    audit: {
      started: Boolean(input.audit?.started),
      finished: Boolean(input.audit?.finished),
      start_event_id: input.audit?.start_event_id || null,
      finish_event_id: input.audit?.finish_event_id || null,
      blocked_reason: input.audit?.blocked_reason || null,
    },
    result: input.result ? safeJson(input.result) as Record<string, unknown> : null,
    normal_reply: redactUnsafeOwnerText(input.normalReply),
    blocked_reason: input.blockedReason,
    error: input.error || null,
  }
}

export async function executeAgentZeroBridgeAction(input: AgentZeroExecutionGatewayInput): Promise<AgentZeroExecutionGatewayResult> {
  const action = String(input.action || '').trim()
  const sessionRead = readLatestAgentZeroBridgeSession({
    db: input.db,
    workspaceId: input.requester.workspaceId,
    tenantId: input.requester.tenantId,
    sync: true,
    now: input.now,
  })
  const session = sessionRead.session
  const adapter = findAdapter(action)

  if (!adapter || FORBIDDEN_ACTION_RE.test(action)) {
    return baseResult({
      action,
      adapter: adapter ? adapterSummaries().find((item) => item.action === action) || null : null,
      session,
      ok: false,
      httpStatus: 400,
      accepted: false,
      status: 'blocked',
      normalReply: 'That action is not available through the Agent Zero Bridge execution gateway.',
      blockedReason: adapter ? 'forbidden_gateway_action' : 'adapter_not_registered',
      result: { registered_actions: adapterSummaries().map((item) => item.action), action_invoked: false },
    })
  }

  const adapterSummary = adapterSummaries().find((item) => item.action === action) || null
  const active = sessionRead.persistence_ready && session.status === 'active' && session.execution_enabled
  if (!active || !session.session_id || (input.bridgeSessionId && input.bridgeSessionId !== session.session_id)) {
    return baseResult({
      action,
      adapter: adapterSummary,
      session,
      ok: false,
      httpStatus: 423,
      accepted: false,
      status: 'blocked',
      normalReply: 'Agent Zero needs an active Bridge Session before this adapter can run.',
      blockedReason: !sessionRead.persistence_ready
        ? 'bridge_session_persistence_not_applied'
        : input.bridgeSessionId && input.bridgeSessionId !== session.session_id
          ? 'bridge_session_id_mismatch'
          : 'active_bridge_session_required',
    })
  }

  if (!sessionAllows(adapter, session)) {
    const blockedAudit = recordAgentZeroBridgeSessionAudit({
      db: input.db,
      sessionId: session.session_id,
      requester: input.requester,
      action,
      target: adapter.category,
      outcome: 'blocked',
      metadata: {
        reason: 'adapter_not_in_bridge_session_scope',
        allowed_scope_keys: adapter.allowed_scope_keys,
      },
      now: input.now,
    })
    return baseResult({
      action,
      adapter: adapterSummary,
      session: blockedAudit.session || session,
      ok: false,
      httpStatus: 403,
      accepted: false,
      status: 'blocked',
      normalReply: 'That adapter is outside the active Agent Zero Bridge Session scope.',
      blockedReason: 'adapter_not_in_bridge_session_scope',
      audit: {
        finished: Boolean(blockedAudit.ok),
        finish_event_id: blockedAudit.audit_event?.id || null,
        blocked_reason: blockedAudit.blocked_reason,
      },
    })
  }

  const started = recordAgentZeroBridgeSessionAudit({
    db: input.db,
    sessionId: session.session_id,
    requester: input.requester,
    action,
    target: adapter.category,
    outcome: 'started',
    metadata: {
      adapter_registered: true,
      writes_enabled: adapter.writes_enabled,
      raw_shell_enabled: false,
      docker_socket_enabled: false,
      direct_secret_reads_enabled: false,
    },
    now: input.now,
  })
  if (!started.ok) {
    return baseResult({
      action,
      adapter: adapterSummary,
      session: started.session || session,
      ok: false,
      httpStatus: started.http_status,
      accepted: false,
      status: 'blocked',
      normalReply: 'Agent Zero execution is blocked because the Bridge Session audit could not be started.',
      blockedReason: started.blocked_reason || 'bridge_session_audit_start_failed',
      audit: { blocked_reason: started.blocked_reason },
    })
  }

  try {
    const adapterResult = await adapter.handler(input, started.session)
    const finished = recordAgentZeroBridgeSessionAudit({
      db: input.db,
      sessionId: started.session.session_id,
      requester: input.requester,
      action,
      target: adapter.category,
      outcome: adapterResult.status,
      metadata: {
        result_checked: true,
        adapter_status: adapterResult.status,
        blocked_reason: adapterResult.blocked_reason,
        no_fake_done: true,
      },
      now: input.now,
    })
    return baseResult({
      action,
      adapter: adapterSummary,
      session: finished.session || started.session,
      ok: adapterResult.ok,
      httpStatus: adapterResult.status === 'completed' ? 200 : 423,
      accepted: adapterResult.status === 'completed',
      status: adapterResult.status,
      normalReply: adapterResult.normal_reply,
      blockedReason: adapterResult.blocked_reason,
      result: adapterResult.result,
      audit: {
        started: true,
        finished: Boolean(finished.ok),
        start_event_id: started.audit_event?.id || null,
        finish_event_id: finished.audit_event?.id || null,
        blocked_reason: finished.blocked_reason,
      },
    })
  } catch (error) {
    const finished = recordAgentZeroBridgeSessionAudit({
      db: input.db,
      sessionId: started.session.session_id,
      requester: input.requester,
      action,
      target: adapter.category,
      outcome: 'failed',
      metadata: {
        result_checked: true,
        error: error instanceof Error ? error.message.slice(0, 200) : 'adapter_execution_failed',
      },
      now: input.now,
    })
    return baseResult({
      action,
      adapter: adapterSummary,
      session: finished.session || started.session,
      ok: false,
      httpStatus: 500,
      accepted: false,
      status: 'failed',
      normalReply: 'Agent Zero could not complete that adapter action.',
      blockedReason: null,
      error: error instanceof Error ? error.message.slice(0, 300) : 'adapter_execution_failed',
      audit: {
        started: true,
        finished: Boolean(finished.ok),
        start_event_id: started.audit_event?.id || null,
        finish_event_id: finished.audit_event?.id || null,
        blocked_reason: finished.blocked_reason,
      },
    })
  }
}
