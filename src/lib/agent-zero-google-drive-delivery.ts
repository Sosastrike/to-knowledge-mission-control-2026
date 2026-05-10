import { getZapierToolBridge, type ZapierToolBridgePayload, type ZapierToolRecord } from './zapier-tool-bridge'
import { readAgentZeroReport } from './agent-zero-report-delivery'
import type { MissionControlCanonicalStatus, MissionControlClosureBlockerClass } from './agent-zero-bridge'

export const GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE = 'Google Drive upload is blocked because the upload connector is not configured.'
export const GOOGLE_DRIVE_UPLOAD_SCOPE = 'google_drive.upload' as const

const GOOGLE_DRIVE_CREDENTIAL_KEYS = [
  'GOOGLE_DRIVE_CREDENTIALS',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_ACCESS_TOKEN',
  'GOOGLE_DRIVE_REFRESH_TOKEN',
  'GOOGLE_CLIENT_ID',
] as const

const GOOGLE_DRIVE_TARGET_FOLDER_KEYS = [
  'GOOGLE_DRIVE_TARGET_FOLDER_ID',
  'GOOGLE_DRIVE_REPORTS_FOLDER_ID',
  'GOOGLE_DRIVE_TARGET_FOLDER',
] as const

export type AgentZeroGoogleDriveStepId =
  | 'status_only'
  | 'folder_lookup'
  | 'upload_test_file'
  | 'upload_report_pdf'
  | 'verify_link'

export type AgentZeroGoogleDriveStep = {
  id: AgentZeroGoogleDriveStepId
  label: string
  status: 'available' | 'blocked'
  read_only: boolean
  external_write: boolean
  bridge_session_required: boolean
  connector_configured: boolean
  blocked_reason: string | null
}

export type AgentZeroGoogleDriveDeliveryStatus = {
  ok: true
  provider: 'google_drive'
  mode: 'agent_zero_google_drive_delivery_adapter'
  canonical_status: MissionControlCanonicalStatus
  blocker_class: MissionControlClosureBlockerClass
  status: 'blocked' | 'configured'
  connected: boolean
  configured: boolean
  required_scope: typeof GOOGLE_DRIVE_UPLOAD_SCOPE
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
  steps: AgentZeroGoogleDriveStep[]
  normal_reply: string
  blocked_reason: string
  no_upload_performed: true
  no_fake_done: true
  no_tokens_exposed: true
}

export type AgentZeroGoogleDriveActionResult = {
  ok: false
  provider: 'google_drive'
  action: string
  status: 'blocked'
  accepted_for_execution: false
  execution_enabled: false
  writes_enabled: false
  bridge_session_required: true
  owner_approval_required: true
  upload_connector_configured: boolean
  normal_reply: string
  blocked_reason: string
  report_link?: string | null
  folder?: string | null
  verify_link?: string | null
  no_fake_done: true
  no_tokens_exposed: true
}

type StatusInput = {
  toolBridge?: ZapierToolBridgePayload
}

function isGoogleDriveTool(tool: ZapierToolRecord): boolean {
  const text = `${tool.tool_name} ${tool.description || ''} ${tool.category}`.toLowerCase()
  return text.includes('google_drive') || text.includes('google drive')
}

function isGoogleDriveUploadTool(tool: ZapierToolRecord): boolean {
  const text = `${tool.tool_name} ${tool.description || ''}`.toLowerCase()
  return isGoogleDriveTool(tool) && /\b(upload|create|file)\b/.test(text)
}

function isGoogleDriveFolderLookupTool(tool: ZapierToolRecord): boolean {
  const text = `${tool.tool_name} ${tool.description || ''}`.toLowerCase()
  return isGoogleDriveTool(tool) && /\b(folder|search|find|list|lookup)\b/.test(text)
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
}): AgentZeroGoogleDriveStep[] {
  const uploadBlockedReason = input.uploadConnectorConfigured ? null : 'google_drive_upload_connector_not_configured'
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
      status: input.folderLookupToolVisible ? 'blocked' : 'blocked',
      read_only: true,
      external_write: false,
      bridge_session_required: true,
      connector_configured: false,
      blocked_reason: input.folderLookupToolVisible
        ? 'google_drive_folder_lookup_execution_requires_bridge_session_adapter'
        : 'google_drive_folder_lookup_connector_not_configured',
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
      blocked_reason: 'google_drive_link_verification_adapter_not_configured',
    },
  ]
}

export async function getAgentZeroGoogleDriveDeliveryStatus(input: StatusInput = {}): Promise<AgentZeroGoogleDriveDeliveryStatus> {
  const bridge = input.toolBridge || await getZapierToolBridge('google drive')
  const googleDriveTools = bridge.tools.filter(isGoogleDriveTool)
  const uploadTools = googleDriveTools.filter(isGoogleDriveUploadTool)
  const folderLookupTools = googleDriveTools.filter(isGoogleDriveFolderLookupTool)
  const credentialNames = presentEnvNames(GOOGLE_DRIVE_CREDENTIAL_KEYS)
  const targetFolderKeys = presentEnvNames(GOOGLE_DRIVE_TARGET_FOLDER_KEYS)

  // Tool/schema visibility is not enough to claim an upload connector exists.
  // This remains false until a scoped invocation adapter and Bridge Session
  // persistence/audit layer are implemented and tested.
  const uploadConnectorConfigured = false
  const credentialPresent = credentialNames.length > 0
  const targetFolderConfigured = targetFolderKeys.length > 0
  const blockedReason = !credentialPresent
    ? 'google_drive_credential_required'
    : !targetFolderConfigured
      ? 'google_drive_target_folder_required'
      : uploadConnectorConfigured
        ? 'bridge_session_required_for_google_drive_upload'
        : 'google_drive_upload_connector_not_configured'
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
    provider: 'google_drive',
    mode: 'agent_zero_google_drive_delivery_adapter',
    canonical_status: canonicalStatus,
    blocker_class: blockerClass,
    status: uploadConnectorConfigured ? 'configured' : 'blocked',
    connected: bridge.connected && googleDriveTools.length > 0,
    configured: uploadConnectorConfigured,
    required_scope: GOOGLE_DRIVE_UPLOAD_SCOPE,
    target_folder_required: true,
    target_folder_configured: targetFolderConfigured,
    target_folder_keys: targetFolderKeys,
    credential_names: credentialNames,
    upload_connector_configured: uploadConnectorConfigured,
    upload_tool_visible: uploadTools.length > 0,
    folder_lookup_tool_visible: folderLookupTools.length > 0,
    schema_available: [...uploadTools, ...folderLookupTools].some(hasSchema),
    tool_names: googleDriveTools.map((tool) => tool.tool_name).slice(0, 50),
    folder_lookup_tool_names: folderLookupTools.map((tool) => tool.tool_name).slice(0, 20),
    upload_tool_names: uploadTools.map((tool) => tool.tool_name).slice(0, 20),
    credential_present: credentialPresent,
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
      ? 'Google Drive upload is configured, but uploads still require a scoped Bridge Session.'
      : GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE,
    blocked_reason: blockedReason,
    no_upload_performed: true,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

function blockedAction(input: {
  action: string
  uploadConnectorConfigured: boolean
  folder?: string | null
  verifyLink?: string | null
  reportLink?: string | null
}): AgentZeroGoogleDriveActionResult {
  return {
    ok: false,
    provider: 'google_drive',
    action: input.action,
    status: 'blocked',
    accepted_for_execution: false,
    execution_enabled: false,
    writes_enabled: false,
    bridge_session_required: true,
    owner_approval_required: true,
    upload_connector_configured: input.uploadConnectorConfigured,
    normal_reply: GOOGLE_DRIVE_UPLOAD_BLOCKED_MESSAGE,
    blocked_reason: input.uploadConnectorConfigured
      ? 'google_drive_upload_requires_active_bridge_session'
      : 'google_drive_upload_connector_not_configured',
    folder: input.folder || null,
    verify_link: input.verifyLink || null,
    report_link: input.reportLink || null,
    no_fake_done: true,
    no_tokens_exposed: true,
  }
}

export async function lookupAgentZeroGoogleDriveFolder(input: { folder?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroGoogleDriveActionResult> {
  const status = await getAgentZeroGoogleDriveDeliveryStatus({ toolBridge: input.toolBridge })
  return blockedAction({
    action: 'google_drive.folder_lookup',
    uploadConnectorConfigured: status.upload_connector_configured,
    folder: input.folder || null,
  })
}

export async function uploadAgentZeroGoogleDriveTestFile(input: { folder?: string | null; bridgeSessionId?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroGoogleDriveActionResult> {
  const status = await getAgentZeroGoogleDriveDeliveryStatus({ toolBridge: input.toolBridge })
  return blockedAction({
    action: 'google_drive.upload_test_file',
    uploadConnectorConfigured: status.upload_connector_configured && Boolean(input.bridgeSessionId),
    folder: input.folder || null,
  })
}

export async function uploadAgentZeroReportToGoogleDrive(input: { reportId?: string | null; folder?: string | null; bridgeSessionId?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroGoogleDriveActionResult> {
  const status = await getAgentZeroGoogleDriveDeliveryStatus({ toolBridge: input.toolBridge })
  const report = input.reportId ? readAgentZeroReport(input.reportId) : null
  return blockedAction({
    action: 'google_drive.upload_report_pdf',
    uploadConnectorConfigured: status.upload_connector_configured && Boolean(input.bridgeSessionId),
    folder: input.folder || null,
    reportLink: report?.mission_control_url || null,
  })
}

export async function verifyAgentZeroGoogleDriveLink(input: { link?: string | null; toolBridge?: ZapierToolBridgePayload } = {}): Promise<AgentZeroGoogleDriveActionResult> {
  const status = await getAgentZeroGoogleDriveDeliveryStatus({ toolBridge: input.toolBridge })
  return blockedAction({
    action: 'google_drive.verify_link',
    uploadConnectorConfigured: status.upload_connector_configured,
    verifyLink: input.link || null,
  })
}
