import { getZapierToolBridge, type ZapierToolBridgePayload, type ZapierToolRecord } from './zapier-tool-bridge'
import { readAgentZeroReport } from './agent-zero-report-delivery'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

export const ONEDRIVE_UPLOAD_BLOCKED_MESSAGE = 'OneDrive upload is blocked because the upload connector is not configured.'
export const ONEDRIVE_UPLOAD_SCOPE = 'onedrive.upload' as const

const ONEDRIVE_CREDENTIAL_KEYS = [
  'ONEDRIVE_ACCESS_TOKEN',
  'ONEDRIVE_REFRESH_TOKEN',
  'MICROSOFT_GRAPH_ACCESS_TOKEN',
  'MICROSOFT_GRAPH_REFRESH_TOKEN',
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_CLIENT_SECRET',
] as const

const ONEDRIVE_TARGET_FOLDER_KEYS = [
  'ONEDRIVE_TARGET_FOLDER_ID',
  'ONEDRIVE_REPORTS_FOLDER_ID',
  'ONEDRIVE_TARGET_FOLDER',
] as const

export type AgentZeroOneDriveStepId =
  | 'status_only'
  | 'folder_lookup'
  | 'upload_test_file'
  | 'upload_report_pdf'
  | 'verify_link'

export type AgentZeroOneDriveStep = {
  id: AgentZeroOneDriveStepId
  label: string
  status: 'available' | 'blocked'
  read_only: boolean
  external_write: boolean
  bridge_session_required: boolean
  connector_configured: boolean
  blocked_reason: string | null
}

export type AgentZeroOneDriveDeliveryStatus = {
  ok: true
  provider: 'onedrive'
  mode: 'agent_zero_onedrive_delivery_adapter'
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  status: 'blocked' | 'configured'
  connected: boolean
  configured: boolean
  required_scope: typeof ONEDRIVE_UPLOAD_SCOPE
  target_folder_required: true
  target_folder_configured: boolean
  target_folder_keys: string[]
  credential_names: string[]
  upload_connector_configured: boolean
  upload_tool_visible: boolean
  folder_lookup_tool_visible: boolean
  schema_available: boolean
  tool_names: string[]
  folder_lookup_tool_names: string[]
  upload_tool_names: string[]
  credential_present: boolean
  credential_values_exposed: false
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  external_write_requires_bridge_session: true
  steps: AgentZeroOneDriveStep[]
  normal_reply: string
  blocked_reason: string
  no_upload_performed: true
  no_fake_done: true
  no_tokens_exposed: true
}

export type AgentZeroOneDriveActionResult = {
  ok: false
  provider: 'onedrive'
  action: string
  status: 'blocked'
  accepted_for_execution: false
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  owner_approval_required: true
  required_scope: typeof ONEDRIVE_UPLOAD_SCOPE
  target_folder_required: true
  target_folder_configured: boolean
  upload_connector_configured: boolean
  normal_reply: string
  blocked_reason: string
  report_link?: string | null
  folder?: string | null
  verify_link?: string | null
  no_upload_performed: true
  no_fake_done: true
  no_tokens_exposed: true
}

type StatusInput = {
  toolBridge?: ZapierToolBridgePayload
}

function isOneDriveTool(tool: ZapierToolRecord): boolean {
  const text = `${tool.tool_name} ${tool.description || ''} ${tool.category}`.toLowerCase()
  return text.includes('onedrive') || text.includes('one_drive') || text.includes('one drive')
}

function isOneDriveUploadTool(tool: ZapierToolRecord): boolean {
  const text = `${tool.tool_name} ${tool.description || ''}`.toLowerCase()
  return isOneDriveTool(tool) && /\b(upload|create|file)\b/.test(text)
}

function isOneDriveFolderLookupTool(tool: ZapierToolRecord): boolean {
  const text = `${tool.tool_name} ${tool.description || ''}`.toLowerCase()
  return isOneDriveTool(tool) && /\b(folder|search|find|list|lookup)\b/.test(text)
}

function hasSchema(tool: ZapierToolRecord): boolean {
  return Array.isArray(tool.required_fields) && tool.required_fields.length > 0
}

function presentEnvNames(keys: readonly string[]): string[] {
  return keys.filter((key) => typeof process.env[key] === 'string' && process.env[key]?.trim())
}

function steps(input: {
  uploadConnectorConfigured: boolean
  folderLookupToolVisible: boolean
  uploadToolVisible: boolean
}): AgentZeroOneDriveStep[] {
  const uploadBlockedReason = input.uploadConnectorConfigured ? null : 'onedrive_upload_connector_not_configured'
  return [
    {
      id: 'status_only',
      label: 'Status only',
      status: 'available',
      read_only: true,
      external_write: false,
      bridge_session_required: false,
      connector_configured: true,
      blocked_reason: null,
    },
    {
      id: 'folder_lookup',
      label: 'Folder lookup',
      status: 'blocked',
      read_only: true,
      external_write: false,
      bridge_session_required: true,
      connector_configured: false,
      blocked_reason: input.folderLookupToolVisible
        ? 'onedrive_folder_lookup_execution_requires_bridge_session_adapter'
        : 'onedrive_folder_lookup_connector_not_configured',
    },
    {
      id: 'upload_test_file',
      label: 'Upload test file',
      status: 'blocked',
      read_only: false,
      external_write: true,
      bridge_session_required: true,
      connector_configured: input.uploadConnectorConfigured,
      blocked_reason: uploadBlockedReason,
    },
    {
      id: 'upload_report_pdf',
      label: 'Upload report/PDF',
      status: 'blocked',
      read_only: false,
      external_write: true,
      bridge_session_required: true,
      connector_configured: input.uploadConnectorConfigured,
      blocked_reason: uploadBlockedReason,
    },
    {
      id: 'verify_link',
      label: 'Verify link',
      status: 'blocked',
      read_only: true,
      external_write: false,
      bridge_session_required: true,
      connector_configured: false,
      blocked_reason: 'onedrive_link_verification_adapter_not_configured',
    },
  ]
}

export async function getAgentZeroOneDriveDeliveryStatus(input: StatusInput = {}): Promise<AgentZeroOneDriveDeliveryStatus> {
  const bridge = input.toolBridge || await getZapierToolBridge('onedrive')
  const oneDriveTools = bridge.tools.filter(isOneDriveTool)
  const uploadTools = oneDriveTools.filter(isOneDriveUploadTool)
  const folderLookupTools = oneDriveTools.filter(isOneDriveFolderLookupTool)
  const credentialNames = presentEnvNames(ONEDRIVE_CREDENTIAL_KEYS)
  const targetFolderKeys = presentEnvNames(ONEDRIVE_TARGET_FOLDER_KEYS)

  // Tool/schema visibility is not enough to claim an upload connector exists.
  // This remains false until a scoped invocation adapter and Bridge Session
  // persistence/audit layer are implemented and tested.
  const uploadConnectorConfigured = false
  const credentialPresent = credentialNames.length > 0
  const targetFolderConfigured = targetFolderKeys.length > 0
  const blockedReason = !credentialPresent
    ? 'onedrive_credential_required'
    : !targetFolderConfigured
      ? 'onedrive_target_folder_required'
      : uploadConnectorConfigured
        ? 'bridge_session_required_for_onedrive_upload'
        : 'onedrive_upload_connector_not_configured'
  const canonicalStatus: MissionControlCanonicalStatus = !credentialPresent
    ? 'CREDENTIAL_GATED'
    : !targetFolderConfigured
      ? 'OWNER_GATED'
      : uploadConnectorConfigured
        ? 'OWNER_GATED'
        : 'BLOCKED'
  const blockerClass: MissionControlClosureBlockerClass = !credentialPresent
    ? 'CREDENTIAL_GATED'
    : !targetFolderConfigured
      ? 'OWNER_GATED'
      : uploadConnectorConfigured
        ? 'OWNER_GATED'
        : 'BLOCKED'

  return {
    ok: true,
    provider: 'onedrive',
    mode: 'agent_zero_onedrive_delivery_adapter',
    canonical_status: canonicalStatus,
    blocker_class: blockerClass,
    status: uploadConnectorConfigured ? 'configured' : 'blocked',
    connected: bridge.connected && oneDriveTools.length > 0,
    configured: uploadConnectorConfigured,
    required_scope: ONEDRIVE_UPLOAD_SCOPE,
    target_folder_required: true,
    target_folder_configured: targetFolderConfigured,
    target_folder_keys: targetFolderKeys,
    credential_names: credentialNames,
    upload_connector_configured: uploadConnectorConfigured,
    upload_tool_visible: uploadTools.length > 0,
    folder_lookup_tool_visible: folderLookupTools.length > 0,
    schema_available: [...uploadTools, ...folderLookupTools].some(hasSchema),
    tool_names: oneDriveTools.map((tool) => tool.tool_name).slice(0, 50),
    folder_lookup_tool_names: folderLookupTools.map((tool) => tool.tool_name).slice(0, 20),
    upload_tool_names: uploadTools.map((tool) => tool.tool_name).slice(0, 20),
    credential_present: Boolean(bridge.connected && bridge.mcp_reachable && oneDriveTools.length > 0),
    credential_values_exposed: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    external_write_requires_bridge_session: true,
    steps: steps({
      uploadConnectorConfigured,
      folderLookupToolVisible: folderLookupTools.length > 0,
      uploadToolVisible: uploadTools.length > 0,
    }),
    normal_reply: uploadConnectorConfigured
      ? 'OneDrive upload is configured, but uploads still require a scoped Bridge Session.'
      : ONEDRIVE_UPLOAD_BLOCKED_MESSAGE,
    blocked_reason: blockedReason,
    no_upload_performed: true,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

function blockedAction(input: {
  action: string
  uploadConnectorConfigured: boolean
  targetFolderConfigured: boolean
  folder?: string | null
  verifyLink?: string | null
  reportLink?: string | null
}): AgentZeroOneDriveActionResult {
  return {
    ok: false,
    provider: 'onedrive',
    action: input.action,
    status: 'blocked',
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    required_scope: ONEDRIVE_UPLOAD_SCOPE,
    target_folder_required: true,
    target_folder_configured: input.targetFolderConfigured,
    upload_connector_configured: input.uploadConnectorConfigured,
    normal_reply: ONEDRIVE_UPLOAD_BLOCKED_MESSAGE,
    blocked_reason: input.uploadConnectorConfigured
      ? 'onedrive_upload_requires_active_bridge_session'
      : 'onedrive_upload_connector_not_configured',
    folder: input.folder || null,
    verify_link: input.verifyLink || null,
    report_link: input.reportLink || null,
    no_upload_performed: true,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

export async function lookupAgentZeroOneDriveFolder(input: { folder?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroOneDriveActionResult> {
  const status = await getAgentZeroOneDriveDeliveryStatus({ toolBridge: input.toolBridge })
  return blockedAction({
    action: 'onedrive.folder_lookup',
    uploadConnectorConfigured: status.upload_connector_configured,
    targetFolderConfigured: status.target_folder_configured || Boolean(input.folder),
    folder: input.folder || null,
  })
}

export async function uploadAgentZeroOneDriveTestFile(input: { folder?: string | null; bridgeSessionId?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroOneDriveActionResult> {
  const status = await getAgentZeroOneDriveDeliveryStatus({ toolBridge: input.toolBridge })
  return blockedAction({
    action: 'onedrive.upload_test_file',
    uploadConnectorConfigured: status.upload_connector_configured && Boolean(input.bridgeSessionId),
    targetFolderConfigured: status.target_folder_configured || Boolean(input.folder),
    folder: input.folder || null,
  })
}

export async function uploadAgentZeroReportToOneDrive(input: { reportId?: string | null; folder?: string | null; bridgeSessionId?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroOneDriveActionResult> {
  const status = await getAgentZeroOneDriveDeliveryStatus({ toolBridge: input.toolBridge })
  const report = input.reportId ? readAgentZeroReport(input.reportId) : null
  return blockedAction({
    action: 'onedrive.upload_report_pdf',
    uploadConnectorConfigured: status.upload_connector_configured && Boolean(input.bridgeSessionId),
    targetFolderConfigured: status.target_folder_configured || Boolean(input.folder),
    folder: input.folder || null,
    reportLink: report?.mission_control_url || null,
  })
}

export async function verifyAgentZeroOneDriveLink(input: { link?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroOneDriveActionResult> {
  const status = await getAgentZeroOneDriveDeliveryStatus({ toolBridge: input.toolBridge })
  return blockedAction({
    action: 'onedrive.verify_link',
    uploadConnectorConfigured: status.upload_connector_configured,
    targetFolderConfigured: status.target_folder_configured,
    verifyLink: input.link || null,
  })
}
