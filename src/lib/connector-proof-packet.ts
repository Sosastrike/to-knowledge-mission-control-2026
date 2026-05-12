import { getAgentMailReadiness } from './agentmail-readiness'
import { getAgentMailDeliveryStatus } from './agentmail-delivery'
import { getAgentZeroGoogleDriveDeliveryStatus } from './agent-zero-google-drive-delivery'
import { getAgentZeroOneDriveDeliveryStatus } from './agent-zero-onedrive-delivery'
import { getAgentZeroTelegramDeliveryStatus } from './agent-zero-telegram-delivery'
import { evaluateHeyGenSchemaReadiness } from './heygen-schema-readiness'
import { getZapierToolBridge, type ZapierToolBridgePayload } from './zapier-tool-bridge'
import type { MissionControlClosureBlockerClass } from './agent-zero-bridge'
import type { OwnerFacingBlockerClass, OwnerFacingStatus } from './owner-status'

export type ConnectorProofPacket = {
  connector_id: string
  name: string
  timestamp: string
  runtime_commit: string | null
  route_or_service_checked: string
  result: OwnerFacingStatus
  blocker_class: OwnerFacingBlockerClass
  blocker: string | null
  audit_pointer: string | null
  safe_log_pointer: string | null
  rollback_command: string
  required_scope: string | null
  bridge_session_required: boolean
  approval_required: boolean
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  fake_success_allowed: false
  secrets_exposed: false
  raw_paths_exposed: false
  proof: Record<string, unknown>
}

export type ConnectorProofReplayPacket = {
  ok: true
  mode: 'connector_proof_replay_packet'
  generated_at: string
  runtime_commit: string | null
  connectors_total: number
  connector_packets: ConnectorProofPacket[]
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  no_telegram_send: true
  no_agentmail_send: true
  no_drive_upload: true
  no_onedrive_upload: true
  no_zapier_writes: true
  no_heygen_generation: true
  secrets_exposed: false
  raw_paths_exposed: false
  consistency_ok: boolean
  consistency_issues: string[]
  safe_log_pointer: string
  rollback_command: string
}

export type ConnectorProofReplayInput = {
  generatedAt?: string
  runtimeCommit?: string | null
  zapierBridge?: ZapierToolBridgePayload
}

function basePacket(input: {
  connectorId: string
  name: string
  generatedAt: string
  runtimeCommit: string | null
  route: string
  result: OwnerFacingStatus
  blockerClass: OwnerFacingBlockerClass
  blocker: string | null
  requiredScope: string | null
  bridgeSessionRequired: boolean
  approvalRequired: boolean
  rollbackCommand: string
  proof: Record<string, unknown>
}): ConnectorProofPacket {
  return {
    connector_id: input.connectorId,
    name: input.name,
    timestamp: input.generatedAt,
    runtime_commit: input.runtimeCommit,
    route_or_service_checked: input.route,
    result: input.result,
    blocker_class: input.blockerClass,
    blocker: input.blocker,
    audit_pointer: '/api/bridge/approval-requests/audit-report',
    safe_log_pointer: input.route,
    rollback_command: input.rollbackCommand,
    required_scope: input.requiredScope,
    bridge_session_required: input.bridgeSessionRequired,
    approval_required: input.approvalRequired,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    fake_success_allowed: false,
    secrets_exposed: false,
    raw_paths_exposed: false,
    proof: input.proof,
  }
}

function collectConsistencyIssues(packets: ConnectorProofPacket[]): string[] {
  const issues: string[] = []
  for (const packet of packets) {
    if (packet.execution_enabled) issues.push(`${packet.connector_id}:execution_enabled`)
    if (packet.writes_enabled) issues.push(`${packet.connector_id}:writes_enabled`)
    if (packet.external_writes_enabled) issues.push(`${packet.connector_id}:external_writes_enabled`)
    if (packet.fake_success_allowed) issues.push(`${packet.connector_id}:fake_success_allowed`)
    if (packet.secrets_exposed) issues.push(`${packet.connector_id}:secrets_exposed`)
    if (packet.raw_paths_exposed) issues.push(`${packet.connector_id}:raw_paths_exposed`)
    if (packet.result === 'LIVE') issues.push(`${packet.connector_id}:live_without_execution_proof`)
  }
  return issues
}

function ownerFacingBlockerClass(blockerClass: MissionControlClosureBlockerClass): OwnerFacingBlockerClass {
  return blockerClass === 'HARD_RESET_REQUIRED' ? 'BLOCKED' : blockerClass
}

export async function buildConnectorProofReplayPacket(input: ConnectorProofReplayInput = {}): Promise<ConnectorProofReplayPacket> {
  const generatedAt = input.generatedAt || new Date().toISOString()
  const runtimeCommit = input.runtimeCommit ?? null
  const zapier = input.zapierBridge || await getZapierToolBridge('heygen')
  const telegram = getAgentZeroTelegramDeliveryStatus()
  const agentmailReadiness = getAgentMailReadiness()
  const agentmailDelivery = getAgentMailDeliveryStatus()
  const googleDrive = await getAgentZeroGoogleDriveDeliveryStatus({ toolBridge: zapier })
  const oneDrive = await getAgentZeroOneDriveDeliveryStatus({ toolBridge: zapier })
  const heygen = evaluateHeyGenSchemaReadiness({ zapier })

  const packets = [
    basePacket({
      connectorId: 'telegram',
      name: 'Telegram',
      generatedAt,
      runtimeCommit,
      route: '/api/bridge/agent-zero/telegram/status',
      result: telegram.canonical_status,
      blockerClass: ownerFacingBlockerClass(telegram.blocker_class),
      blocker: telegram.blocked_reason,
      requiredScope: telegram.required_scope,
      bridgeSessionRequired: telegram.bridge_session_required,
      approvalRequired: telegram.external_write_requires_bridge_session,
      rollbackCommand: 'git revert <day-53-telegram-pdf-delivery-commit>',
      proof: {
        connector_configured: telegram.connector_configured,
        credential_present: telegram.credential_present,
        owner_channel_configured: telegram.owner_channel_configured,
        active_commander: telegram.active_commander,
        tony_active: telegram.tony_active,
        no_fake_done: telegram.no_fake_done,
        no_tokens_exposed: telegram.no_tokens_exposed,
      },
    }),
    basePacket({
      connectorId: 'agentmail',
      name: 'AgentMail',
      generatedAt,
      runtimeCommit,
      route: '/api/bridge/agent-zero/agentmail/status',
      result: agentmailReadiness.canonical_status,
      blockerClass: ownerFacingBlockerClass(agentmailReadiness.blocker_class),
      blocker: agentmailReadiness.blocked_reason || agentmailDelivery.blocked_reason,
      requiredScope: agentmailDelivery.required_scope,
      bridgeSessionRequired: agentmailDelivery.bridge_session_required,
      approvalRequired: true,
      rollbackCommand: 'git revert <day-56-agentmail-delivery-proof-commit>',
      proof: {
        incoming_status: agentmailReadiness.incoming.status,
        outgoing_status: agentmailReadiness.outgoing.status,
        credential_present: agentmailReadiness.credential_present,
        send_endpoint_configured: agentmailDelivery.send_endpoint_configured,
        allow_list_configured: agentmailDelivery.allow_list_configured,
        no_email_sent: agentmailDelivery.no_email_sent,
        no_fake_done: agentmailDelivery.no_fake_done,
        no_tokens_exposed: agentmailDelivery.no_tokens_exposed,
      },
    }),
    basePacket({
      connectorId: 'google_drive',
      name: 'Google Drive',
      generatedAt,
      runtimeCommit,
      route: '/api/bridge/agent-zero/google-drive/status',
      result: googleDrive.canonical_status,
      blockerClass: ownerFacingBlockerClass(googleDrive.blocker_class),
      blocker: googleDrive.blocked_reason,
      requiredScope: googleDrive.required_scope,
      bridgeSessionRequired: googleDrive.bridge_session_required,
      approvalRequired: googleDrive.external_write_requires_bridge_session,
      rollbackCommand: 'git revert <day-58-google-drive-proof-commit>',
      proof: {
        connected: googleDrive.connected,
        target_folder_configured: googleDrive.target_folder_configured,
        upload_connector_configured: googleDrive.upload_connector_configured,
        upload_tool_visible: googleDrive.upload_tool_visible,
        folder_lookup_tool_visible: googleDrive.folder_lookup_tool_visible,
        schema_available: googleDrive.schema_available,
        no_upload_performed: googleDrive.no_upload_performed,
        no_fake_done: googleDrive.no_fake_done,
        no_tokens_exposed: googleDrive.no_tokens_exposed,
      },
    }),
    basePacket({
      connectorId: 'onedrive',
      name: 'OneDrive',
      generatedAt,
      runtimeCommit,
      route: '/api/bridge/agent-zero/onedrive/status',
      result: oneDrive.canonical_status,
      blockerClass: ownerFacingBlockerClass(oneDrive.blocker_class),
      blocker: oneDrive.blocked_reason,
      requiredScope: oneDrive.required_scope,
      bridgeSessionRequired: oneDrive.bridge_session_required,
      approvalRequired: oneDrive.external_write_requires_bridge_session,
      rollbackCommand: 'git revert <day-60-onedrive-proof-commit>',
      proof: {
        connected: oneDrive.connected,
        target_folder_configured: oneDrive.target_folder_configured,
        upload_connector_configured: oneDrive.upload_connector_configured,
        upload_tool_visible: oneDrive.upload_tool_visible,
        folder_lookup_tool_visible: oneDrive.folder_lookup_tool_visible,
        schema_available: oneDrive.schema_available,
        no_upload_performed: oneDrive.no_upload_performed,
        no_fake_done: oneDrive.no_fake_done,
        no_tokens_exposed: oneDrive.no_tokens_exposed,
      },
    }),
    basePacket({
      connectorId: 'zapier',
      name: 'Zapier',
      generatedAt,
      runtimeCommit,
      route: '/api/bridge/zapier/status',
      result: zapier.canonical_status,
      blockerClass: zapier.blocker_class,
      blocker: zapier.blocker,
      requiredScope: 'zapier.write',
      bridgeSessionRequired: zapier.bridge_session_required,
      approvalRequired: zapier.approval_required_for_writes,
      rollbackCommand: 'git revert <day-52-mcp-zapier-heygen-final-closeout-commit>',
      proof: {
        connected: zapier.connected,
        mcp_reachable: zapier.mcp_reachable,
        read_enabled: zapier.read_enabled,
        tools_total: zapier.tools_total,
        read_tools_total: zapier.read_tools_total,
        write_tools_total: zapier.write_tools_total,
        source: zapier.source,
        no_zapier_writes: zapier.no_zapier_writes,
      },
    }),
    basePacket({
      connectorId: 'heygen',
      name: 'HeyGen',
      generatedAt,
      runtimeCommit,
      route: '/api/bridge/heygen/schema-readiness',
      result: heygen.canonical_status,
      blockerClass: heygen.blocker_class,
      blocker: heygen.blocker,
      requiredScope: 'heygen.generate',
      bridgeSessionRequired: heygen.bridge_session_required,
      approvalRequired: heygen.approval_required_for_generation,
      rollbackCommand: 'git revert <day-49-heygen-exact-scope-proof-commit>',
      proof: {
        schema_available: heygen.schema_available,
        tool_name: heygen.tool_name,
        required_fields: heygen.required_fields,
        payload_checked: heygen.payload_checked,
        payload_valid: heygen.payload_valid,
        accepted_for_generation: heygen.accepted_for_generation,
        no_heygen_generation: heygen.no_heygen_generation,
        no_zapier_writes: heygen.no_zapier_writes,
      },
    }),
  ]

  const consistencyIssues = collectConsistencyIssues(packets)

  return {
    ok: true,
    mode: 'connector_proof_replay_packet',
    generated_at: generatedAt,
    runtime_commit: runtimeCommit,
    connectors_total: packets.length,
    connector_packets: packets,
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    no_telegram_send: true,
    no_agentmail_send: true,
    no_drive_upload: true,
    no_onedrive_upload: true,
    no_zapier_writes: true,
    no_heygen_generation: true,
    secrets_exposed: false,
    raw_paths_exposed: false,
    consistency_ok: consistencyIssues.length === 0,
    consistency_issues: consistencyIssues,
    safe_log_pointer: '/api/bridge/connector-readiness',
    rollback_command: 'git revert <day-95-connector-proof-replay-commit>',
  }
}
