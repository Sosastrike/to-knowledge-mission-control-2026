import { buildExecutionReadinessMatrix } from '@/lib/execution-readiness-matrix'
import { listJarvisAdapters } from '@/lib/jarvis-adapter-registry'
import {
  PAPERCLIP_COMPANY_BOOTSTRAP_ACTION,
  PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
  PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES,
  PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE,
} from '@/lib/paperclip-company-bootstrap-adapter'
import { JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID } from '@/lib/jarvis-zapier-exact-action-adapter'
import { JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID } from '@/lib/jarvis-drive-onedrive-exact-adapter'
import { JARVIS_VISIBLE_TASK_PROGRESS_ACTION, JARVIS_VISIBLE_TASK_PROGRESS_ADAPTER_ID } from '@/lib/jarvis-visible-task-progress'
import { JARVIS_FULL_GO_WORKFLOW_ACTION, JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID } from '@/lib/jarvis-full-go-workflow-adapter'
import { JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION, JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID } from '@/lib/jarvis-obsidian-structured-project-note-adapter'
import { JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION, JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID } from '@/lib/jarvis-mempalace-categorized-memory-adapter'
import { JARVIS_WEBHOOK_LOCAL_PING_ACTION, JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID } from '@/lib/jarvis-webhook-local-ping-adapter'
import { JARVIS_SCHEDULER_RUN_ACTION, JARVIS_SCHEDULER_RUN_ADAPTER_ID, JARVIS_SCHEDULER_RUN_TASK_ID } from '@/lib/jarvis-scheduler-run-adapter'
import { JARVIS_MCP_MEMORY_WRITE_ACTION, JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID } from '@/lib/jarvis-mcp-memory-write-adapter'
import { JARVIS_AGENTMAIL_DRAFT_ACTION, JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID } from '@/lib/jarvis-agentmail-draft-adapter'
import { JARVIS_TELEGRAM_DELIVERY_ACTION, JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID } from '@/lib/jarvis-telegram-delivery-adapter'
import {
  PUBLIC_WEBPAGE_READ_ACTION,
  PUBLIC_WEBPAGE_READ_ADAPTER_ID,
  YOUTUBE_TRANSCRIPT_ACTION,
  YOUTUBE_TRANSCRIPT_ADAPTER_ID,
} from '@/lib/public-research'

export type JarvisSystemCommandState =
  | 'available'
  | 'certified'
  | 'pending_adapter'
  | 'pending_credential'
  | 'owner_hard_stop'
  | 'blocked_by_policy'

export type JarvisSystemCommandEntry = {
  command_id: string
  system_id: string
  label: string
  command_type: string
  read: boolean
  write: boolean
  execute: boolean
  adapter_id: string | null
  action: string | null
  scope: Record<string, unknown> | null
  command_status: JarvisSystemCommandState
  credential_required: boolean
  credential_names_present: Record<string, boolean>
  adapter_missing: boolean
  certified: boolean
  hard_stop: boolean
  exact_blocker: string | null
  owner_visible_ticket_required: boolean
  visible_blocker_packet_required: boolean
  blocked_lane_stops_project: false
  continue_safe_lanes_when_blocked: true
  owner_visible_ticket_route: '/api/tasks'
  canonical_execution_route: '/api/bridge/agent-zero/execute'
  next_action: string
  credential_values_exposed: false
}

export type JarvisSystemRegistryEntry = {
  system_id: string
  label: string
  category: string
  read: boolean
  write: boolean
  execute: boolean
  command_status: JarvisSystemCommandState
  credential_required: boolean
  adapter_missing: boolean
  certified: boolean
  hard_stop: boolean
  commands: string[]
  exact_blockers: string[]
}

function envPresent(name: string) {
  return Boolean((process.env[name] || '').trim())
}

function credentialNamesPresent(names: readonly string[]) {
  return Object.fromEntries(names.map((name) => [name, envPresent(name)]))
}

function hasAnyCredential(names: readonly string[]) {
  return names.some((name) => envPresent(name))
}

function adapterById(id: string) {
  return listJarvisAdapters().find((adapter) => adapter.id === id) || null
}

function matrixEntry(id: string) {
  return buildExecutionReadinessMatrix().entries.find((entry) => entry.id === id) || null
}

function command(input: Omit<JarvisSystemCommandEntry, 'owner_visible_ticket_route' | 'canonical_execution_route' | 'credential_values_exposed' | 'visible_blocker_packet_required' | 'blocked_lane_stops_project' | 'continue_safe_lanes_when_blocked'>): JarvisSystemCommandEntry {
  return {
    ...input,
    visible_blocker_packet_required: input.owner_visible_ticket_required,
    blocked_lane_stops_project: false,
    continue_safe_lanes_when_blocked: true,
    owner_visible_ticket_route: '/api/tasks',
    canonical_execution_route: '/api/bridge/agent-zero/execute',
    credential_values_exposed: false,
  }
}

function systemFromCommands(input: { system_id: string; label: string; category: string; commands: JarvisSystemCommandEntry[] }): JarvisSystemRegistryEntry {
  const credentialRequired = input.commands.some((item) => item.credential_required)
  const adapterMissing = input.commands.some((item) => item.adapter_missing)
  const hardStop = input.commands.some((item) => item.hard_stop)
  const certified = input.commands.some((item) => item.certified)
  const status: JarvisSystemCommandState = hardStop
    ? 'owner_hard_stop'
    : adapterMissing
      ? 'pending_adapter'
      : credentialRequired
        ? 'pending_credential'
        : certified
          ? 'certified'
          : 'available'
  return {
    system_id: input.system_id,
    label: input.label,
    category: input.category,
    read: input.commands.some((item) => item.read),
    write: input.commands.some((item) => item.write),
    execute: input.commands.some((item) => item.execute),
    command_status: status,
    credential_required: credentialRequired,
    adapter_missing: adapterMissing,
    certified,
    hard_stop: hardStop,
    commands: input.commands.map((item) => item.command_id),
    exact_blockers: input.commands.map((item) => item.exact_blocker).filter((item): item is string => Boolean(item)),
  }
}

export function buildJarvisSystemCommandRegistry() {
  const paperclipBoardCredentialPresent = hasAnyCredential(PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES)
  const paperclipBootstrapAdapter = adapterById(PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID)
  const zapierAdapter = adapterById(JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID)
  const driveAdapter = adapterById(JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID)
  const n8nEntry = matrixEntry('n8n_workflow_list')

  const commands: JarvisSystemCommandEntry[] = [
    command({
      command_id: 'agent_zero.visible_task_progress.update',
      system_id: 'agent_zero',
      label: 'Update owner-visible Mission Control task progress',
      command_type: 'update_visible_task_progress',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_VISIBLE_TASK_PROGRESS_ADAPTER_ID,
      action: JARVIS_VISIBLE_TASK_PROGRESS_ACTION,
      scope: { system: 'mission_control', surface: 'visible_task_board', operation: 'update_progress' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Update /api/tasks through the visible task progress adapter and verify owner-visible proof before claiming completion.',
    }),
    command({
      command_id: 'agent_zero.daily_health_workflow.run',
      system_id: 'agent_zero',
      label: 'Run Jarvis daily health workflow through exact-scope workflow adapter',
      command_type: 'run_internal_workflow',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_FULL_GO_WORKFLOW_ADAPTER_ID,
      action: JARVIS_FULL_GO_WORKFLOW_ACTION,
      scope: { system: 'jarvis', operation: 'run_workflow', workflow_id: 'full_go_company_status', company_scope: 'ECO' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Use the exact Jarvis workflow adapter; no external connector, provider, Paperclip, Zapier, n8n, or delivery state is changed.',
    }),
    command({
      command_id: 'gateway.status.read',
      system_id: 'gateway',
      label: 'Read Mission Control Gateway status and registry state',
      command_type: 'read_status',
      read: true,
      write: false,
      execute: false,
      adapter_id: null,
      action: 'gateway.status.read',
      scope: { system: 'gateway', operation: 'read_status', route: '/api/gateway/status' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Read Gateway status/registry only; OpenClaw remains supporting runtime and is never treated as Jarvis.',
    }),
    command({
      command_id: 'web.public_page.read',
      system_id: 'public_research',
      label: 'Read a public webpage, product page, or documentation page without owner approval',
      command_type: 'public_read_only_research',
      read: true,
      write: false,
      execute: true,
      adapter_id: PUBLIC_WEBPAGE_READ_ADAPTER_ID,
      action: PUBLIC_WEBPAGE_READ_ACTION,
      scope: { connector: 'web', operation: 'public_read_only', method: 'GET' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: !adapterById(PUBLIC_WEBPAGE_READ_ADAPTER_ID),
      certified: Boolean(adapterById(PUBLIC_WEBPAGE_READ_ADAPTER_ID)),
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Fetch public content with GET only, no cookies, no auth headers, no forms, no login bypass, and no writes.',
    }),
    command({
      command_id: 'youtube.transcript.read',
      system_id: 'video_intelligence',
      label: 'Read public YouTube transcript segments through the YouTube transcript route',
      command_type: 'video_transcript_read_only',
      read: true,
      write: false,
      execute: true,
      adapter_id: YOUTUBE_TRANSCRIPT_ADAPTER_ID,
      action: YOUTUBE_TRANSCRIPT_ACTION,
      scope: { connector: 'youtube', operation: 'public_transcript_read_only', method: 'GET' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: !adapterById(YOUTUBE_TRANSCRIPT_ADAPTER_ID),
      certified: Boolean(adapterById(YOUTUBE_TRANSCRIPT_ADAPTER_ID)),
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Route YouTube watch, youtu.be, Shorts, and embed URLs to /api/youtube/transcript first; create a blocker instead of guessing if captions are unavailable.',
    }),
    command({
      command_id: 'brain_memory.obsidian_structured_project_note.create',
      system_id: 'brain_memory',
      label: 'Create structured Obsidian project note from owner-visible task result',
      command_type: 'memory_write',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ADAPTER_ID,
      action: JARVIS_OBSIDIAN_STRUCTURED_PROJECT_NOTE_ACTION,
      scope: { system: 'obsidian', operation: 'structured_project_note_create', vault: 'canonical', folder: 'jarvis_full_go' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Write only a structured project note through the exact Obsidian adapter; no broad vault overwrite.',
    }),
    command({
      command_id: 'brain.status.read',
      system_id: 'brain_memory',
      label: 'Read Brain Bridge Mode Gateway status and exact lane states',
      command_type: 'brain_status_read',
      read: true,
      write: false,
      execute: false,
      adapter_id: null,
      action: 'brain.status.read',
      scope: { system: 'brain_bridge', operation: 'read_gateway_status', route: '/api/bridge/brain-sync/gateway-status' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Read exact Brain Bridge states; do not treat OpenClaw as Brain Bridge or enable memory writes.',
    }),
    command({
      command_id: 'brain.memory.propose_write',
      system_id: 'brain_memory',
      label: 'Propose approval-gated Brain memory write',
      command_type: 'memory_write_request',
      read: true,
      write: true,
      execute: false,
      adapter_id: null,
      action: 'brain.memory.propose_write',
      scope: { system: 'brain_bridge', operation: 'memory_write_request', route: '/api/bridge/brain-sync/memory/write-request' },
      command_status: 'blocked_by_policy',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: 'memory_write_approval_required',
      owner_visible_ticket_required: true,
      next_action: 'Create an approval-gated memory write request only; no direct memory write or broad deletion.',
    }),
    command({
      command_id: 'brain.buildwiki.events.read',
      system_id: 'brain_memory',
      label: 'Read Build-Wiki event polling feed',
      command_type: 'brain_event_read',
      read: true,
      write: false,
      execute: false,
      adapter_id: null,
      action: 'brain.buildwiki.events',
      scope: { system: 'build_wiki', operation: 'read_events', route: '/api/bridge/brain-sync/build-wiki/events' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Read polling events only; Run Now execution remains Bridge-gated.',
    }),
    command({
      command_id: 'brain_memory.mempalace_categorized_task_result.write',
      system_id: 'brain_memory',
      label: 'Write categorized MemPalace task-result memory summary',
      command_type: 'memory_write',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ADAPTER_ID,
      action: JARVIS_MEMPALACE_CATEGORIZED_MEMORY_ACTION,
      scope: { system: 'mempalace', operation: 'categorized_memory_write', vault: 'safe_memory_summary', category: 'task_result' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Write only the exact categorized safe summary; no raw private memory dump or broad overwrite.',
    }),
    command({
      command_id: 'spaceagent.status.read',
      system_id: 'spaceagent',
      label: 'Read SpaceAgent registered status',
      command_type: 'read_status',
      read: true,
      write: false,
      execute: false,
      adapter_id: null,
      action: 'spaceagent.status.read',
      scope: { system: 'spaceagent', operation: 'read_status', route: '/api/bridge/spaceagent/status' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Read SpaceAgent state only; production SpaceAgent actions require their own certified exact-scope adapter.',
    }),
    command({
      command_id: 'paperclip.company.bootstrap.pacman_cybersecurity',
      system_id: 'paperclip',
      label: 'Create Pacman Cybersecurity company and seed cybersecurity leadership/team',
      command_type: 'create_company',
      read: true,
      write: true,
      execute: true,
      adapter_id: PAPERCLIP_COMPANY_BOOTSTRAP_ADAPTER_ID,
      action: PAPERCLIP_COMPANY_BOOTSTRAP_ACTION,
      scope: PAPERCLIP_COMPANY_BOOTSTRAP_SCOPE,
      command_status: paperclipBoardCredentialPresent ? 'available' : 'pending_credential',
      credential_required: !paperclipBoardCredentialPresent,
      credential_names_present: credentialNamesPresent(PAPERCLIP_COMPANY_BOOTSTRAP_BOARD_CREDENTIAL_NAMES),
      adapter_missing: !paperclipBootstrapAdapter,
      certified: Boolean(paperclipBootstrapAdapter),
      hard_stop: false,
      exact_blocker: paperclipBoardCredentialPresent ? null : 'paperclip_board_admin_credential_required',
      owner_visible_ticket_required: true,
      next_action: paperclipBoardCredentialPresent
        ? 'POST /api/bridge/agent-zero/execute with the exact Pacman Cybersecurity bootstrap scope.'
        : 'Use the owner-visible task ticket to show paperclip_board_admin_credential_required; do not use vague unavailable-route language.',
    }),
    command({
      command_id: 'paperclip.eco_issue_comment.create',
      system_id: 'paperclip',
      label: 'Create bounded Paperclip ECO issue comment',
      command_type: 'write_existing_issue_comment',
      read: true,
      write: true,
      execute: true,
      adapter_id: 'paperclip_eco_task_write',
      action: 'paperclip.eco_issue_comment.create',
      scope: { company: 'ECO', operation: 'issue_comment_create', target: 'existing_issue' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: { PAPERCLIP_API_KEY: envPresent('PAPERCLIP_API_KEY') },
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Use only existing ECO issue identifiers; TOK remains forbidden.',
    }),
    command({
      command_id: 'hermes.recommendation.create',
      system_id: 'hermes',
      label: 'Ask Ron Weasley for route, workflow, skill, or optimization recommendation',
      command_type: 'request_plan',
      read: true,
      write: true,
      execute: false,
      adapter_id: null,
      action: 'hermes.recommendation.create',
      scope: { system: 'hermes', operation: 'internal_recommendation' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Ron Weasley drafts and recommends under Jarvis authority; Jarvis executes major changes.',
    }),
    command({
      command_id: 'pi.recommend',
      system_id: 'pi',
      label: 'Ask Pi for advisory routing recommendation',
      command_type: 'request_plan',
      read: true,
      write: true,
      execute: false,
      adapter_id: null,
      action: 'pi.recommend',
      scope: { system: 'pi', operation: 'advisory_recommendation' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Pi recommends; Jarvis remains execution authority.',
    }),
    command({
      command_id: 'zapier.connection_probe',
      system_id: 'zapier',
      label: 'Probe Zapier MCP connection and list safe metadata',
      command_type: 'connector_probe',
      read: true,
      write: false,
      execute: true,
      adapter_id: JARVIS_ZAPIER_EXACT_ACTION_ADAPTER_ID,
      action: 'zapier.connection_probe',
      scope: { connector: 'zapier', operation: 'connection_probe' },
      command_status: zapierAdapter ? 'certified' : 'pending_adapter',
      credential_required: false,
      credential_names_present: { ZAPIER_MCP_URL: envPresent('ZAPIER_MCP_URL') },
      adapter_missing: !zapierAdapter,
      certified: Boolean(zapierAdapter),
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Use approved Zapier action library only; broad Zap creation and social posting remain gated.',
    }),
    command({
      command_id: 'drive_onedrive.approved_folder_upload',
      system_id: 'drive_onedrive',
      label: 'List/upload/delete rollback inside approved Drive folder only',
      command_type: 'connector_upload',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_DRIVE_ONEDRIVE_UPLOAD_ADAPTER_ID,
      action: 'drive_onedrive.upload_file',
      scope: { connector: 'drive_onedrive', operation: 'approved_folder_upload', target: 'single_test_file' },
      command_status: driveAdapter?.status === 'executable' ? 'certified' : 'pending_credential',
      credential_required: driveAdapter?.status !== 'executable',
      credential_names_present: {
        GOOGLE_DRIVE_ACCESS_TOKEN: envPresent('GOOGLE_DRIVE_ACCESS_TOKEN'),
        GOOGLE_APPLICATION_CREDENTIALS: envPresent('GOOGLE_APPLICATION_CREDENTIALS'),
        GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON: envPresent('GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON'),
        GOOGLE_DRIVE_APPROVED_FOLDER_ID: envPresent('GOOGLE_DRIVE_APPROVED_FOLDER_ID'),
        GOOGLE_DRIVE_APPROVED_FOLDER_NAME: envPresent('GOOGLE_DRIVE_APPROVED_FOLDER_NAME'),
      },
      adapter_missing: !driveAdapter,
      certified: Boolean(driveAdapter),
      hard_stop: false,
      exact_blocker: driveAdapter?.exact_blocker || null,
      owner_visible_ticket_required: true,
      next_action: 'Use approved folder scope only; no public sharing or broad folder access.',
    }),
    command({
      command_id: 'n8n.workflow_list',
      system_id: 'n8n',
      label: 'List n8n workflows for controlled planning',
      command_type: 'connector_inventory',
      read: true,
      write: false,
      execute: true,
      adapter_id: 'n8n_workflow_list',
      action: 'n8n.workflow_list',
      scope: { connector: 'n8n', operation: 'workflow_list_readiness' },
      command_status: n8nEntry?.execution_allowed ? 'certified' : 'pending_credential',
      credential_required: n8nEntry?.health === 'credential_gated',
      credential_names_present: { N8N_BASE_URL: envPresent('N8N_BASE_URL'), N8N_API_KEY: envPresent('N8N_API_KEY') },
      adapter_missing: !n8nEntry,
      certified: Boolean(n8nEntry?.adapter_present),
      hard_stop: false,
      exact_blocker: n8nEntry?.exact_blocker || null,
      owner_visible_ticket_required: true,
      next_action: 'List only; activation/execution requires separate exact workflow scope.',
    }),
    command({
      command_id: 'provider.model.local_ollama_generate',
      system_id: 'providers',
      label: 'Run bounded local Gateway/Ollama model generation',
      command_type: 'model_execute',
      read: true,
      write: false,
      execute: true,
      adapter_id: 'gateway_ollama_local_model_execute',
      action: 'gateway.model.local_generate',
      scope: { provider: 'ollama', operation: 'local_generate' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Use Token Governor and local-only scope; paid external providers remain brokered and capped.',
    }),
    command({
      command_id: 'webhooks.local_ping',
      system_id: 'webhooks',
      label: 'Run internal webhook local ping proof',
      command_type: 'webhook_local_probe',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_WEBHOOK_LOCAL_PING_ADAPTER_ID,
      action: JARVIS_WEBHOOK_LOCAL_PING_ACTION,
      scope: { system: 'webhook', operation: 'invoke_local_test', target: 'mission_control_internal_ping' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Use the local ping adapter only; no external endpoint call and no public webhook creation.',
    }),
    command({
      command_id: 'scheduler.auto_backup.run_now',
      system_id: 'scheduler',
      label: 'Run scheduler auto-backup exact task now',
      command_type: 'scheduled_job_run_now',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_SCHEDULER_RUN_ADAPTER_ID,
      action: JARVIS_SCHEDULER_RUN_ACTION,
      scope: { system: 'scheduler', operation: 'run_now', task_id: JARVIS_SCHEDULER_RUN_TASK_ID },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Run only the auto_backup exact task; no cleanup, webhook retry, connector sends/uploads, or provider calls.',
    }),
    command({
      command_id: 'mcp.readonly_status_probe',
      system_id: 'mcp',
      label: 'Probe MCP status through read-only exact adapter',
      command_type: 'mcp_probe',
      read: true,
      write: false,
      execute: true,
      adapter_id: 'mcp_readonly_status_probe',
      action: 'mcp.status.probe',
      scope: { system: 'mcp', operation: 'readonly_status_probe' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Probe MCP read-only status only; arbitrary MCP tools remain blocked without exact adapter scope.',
    }),
    command({
      command_id: 'mcp.memory_write_probe',
      system_id: 'mcp',
      label: 'Run MCP memory write proof with immediate rollback',
      command_type: 'mcp_write_probe',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID,
      action: JARVIS_MCP_MEMORY_WRITE_ACTION,
      scope: { system: 'mcp', server_id: 'memory', operation: 'create_and_delete_test_entity', target: 'ephemeral_test_entity' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Create and delete only the ephemeral MCP memory proof entity; arbitrary MCP writes remain blocked.',
    }),
    command({
      command_id: 'agentmail.draft.create',
      system_id: 'agentmail',
      label: 'Create AgentMail internal draft without sending',
      command_type: 'delivery_draft',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_AGENTMAIL_DRAFT_ADAPTER_ID,
      action: JARVIS_AGENTMAIL_DRAFT_ACTION,
      scope: { system: 'agentmail', operation: 'create_draft', target: 'internal_draft' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: {},
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Create internal AgentMail draft only; sending requires separate exact send approval and credentials.',
    }),
    command({
      command_id: 'telegram.owner_message.send',
      system_id: 'telegram',
      label: 'Send exact owner Telegram message through Jarvis bot',
      command_type: 'delivery_send',
      read: true,
      write: true,
      execute: true,
      adapter_id: JARVIS_TELEGRAM_DELIVERY_ADAPTER_ID,
      action: JARVIS_TELEGRAM_DELIVERY_ACTION,
      scope: { system: 'telegram', operation: 'send_owner_message', target: 'owner_chat' },
      command_status: 'certified',
      credential_required: false,
      credential_names_present: { JARVIS_BOT_TOKEN: envPresent('JARVIS_BOT_TOKEN') },
      adapter_missing: false,
      certified: true,
      hard_stop: false,
      exact_blocker: null,
      owner_visible_ticket_required: true,
      next_action: 'Send only the exact owner-chat message through @Jarvis_88sbot; no broad Telegram delivery.',
    }),
  ]

  const systems = [
    systemFromCommands({ system_id: 'agent_zero', label: 'Agent Zero / Jarvis', category: 'mission_control_owner_operator', commands: commands.filter((item) => item.system_id === 'agent_zero') }),
    systemFromCommands({ system_id: 'hermes', label: 'Ron Weasley — Nuclear Dispatcher', category: 'dispatcher_optimizer', commands: commands.filter((item) => item.system_id === 'hermes') }),
    systemFromCommands({ system_id: 'pi', label: 'Pi advisory dispatcher', category: 'advisory_agent', commands: commands.filter((item) => item.system_id === 'pi') }),
    systemFromCommands({ system_id: 'paperclip', label: 'Paperclip company/workforce system', category: 'company_workforce_system', commands: commands.filter((item) => item.system_id === 'paperclip') }),
    systemFromCommands({ system_id: 'spaceagent', label: 'SpaceAgent', category: 'registered_agent', commands: commands.filter((item) => item.system_id === 'spaceagent') }),
    systemFromCommands({ system_id: 'gateway', label: 'Mission Control Gateway', category: 'supporting_runtime_gateway', commands: commands.filter((item) => item.system_id === 'gateway') }),
    systemFromCommands({ system_id: 'public_research', label: 'Public read-only research', category: 'read_only_research', commands: commands.filter((item) => item.system_id === 'public_research') }),
    systemFromCommands({ system_id: 'video_intelligence', label: 'Video intelligence', category: 'read_only_research', commands: commands.filter((item) => item.system_id === 'video_intelligence') }),
    systemFromCommands({ system_id: 'brain_memory', label: 'Brain / memory', category: 'brain_memory', commands: commands.filter((item) => item.system_id === 'brain_memory') }),
    systemFromCommands({ system_id: 'n8n', label: 'n8n', category: 'automation_connector', commands: commands.filter((item) => item.system_id === 'n8n') }),
    systemFromCommands({ system_id: 'zapier', label: 'Zapier', category: 'automation_connector', commands: commands.filter((item) => item.system_id === 'zapier') }),
    systemFromCommands({ system_id: 'drive_onedrive', label: 'Drive / OneDrive', category: 'storage_connector', commands: commands.filter((item) => item.system_id === 'drive_onedrive') }),
    systemFromCommands({ system_id: 'webhooks', label: 'Webhooks', category: 'delivery_connector', commands: commands.filter((item) => item.system_id === 'webhooks') }),
    systemFromCommands({ system_id: 'scheduler', label: 'Scheduled jobs', category: 'scheduler', commands: commands.filter((item) => item.system_id === 'scheduler') }),
    systemFromCommands({ system_id: 'mcp', label: 'MCP tools', category: 'mcp_tools', commands: commands.filter((item) => item.system_id === 'mcp') }),
    systemFromCommands({ system_id: 'providers', label: 'Approved model/provider routes', category: 'model_provider', commands: commands.filter((item) => item.system_id === 'providers') }),
    systemFromCommands({ system_id: 'agentmail', label: 'AgentMail', category: 'delivery_connector', commands: commands.filter((item) => item.system_id === 'agentmail') }),
    systemFromCommands({ system_id: 'telegram', label: 'Telegram owner delivery', category: 'delivery_connector', commands: commands.filter((item) => item.system_id === 'telegram') }),
  ]

  const summary = {
    systems_total: systems.length,
    commands_total: commands.length,
    certified_commands: commands.filter((item) => item.command_status === 'certified').length,
    pending_credentials: commands.filter((item) => item.command_status === 'pending_credential').length,
    pending_adapters: commands.filter((item) => item.command_status === 'pending_adapter').length,
    owner_hard_stops: commands.filter((item) => item.command_status === 'owner_hard_stop').length,
  }

  return {
    route: 'bridge.agent-zero.system-command-registry',
    mode: 'jarvis_global_server_command_registry',
    canonical_execution_route: '/api/bridge/agent-zero/execute',
    owner_visible_ticket_route: '/api/tasks',
    jarvis_remains_commander: true,
    hermes_recommends_under_jarvis: true,
    openclaw_is_supporting_runtime_only: true,
    credential_values_exposed: false,
    no_raw_secret_values: true,
    missing_command_policy: {
      jarvis_must_not_say_not_proven_without_ticket: true,
      missing_adapter_ticket_required: true,
      missing_credential_ticket_required: true,
      blocked_lane_must_be_isolated_to_visible_ticket: true,
      credential_blocker_does_not_stop_unrelated_safe_work: true,
      visible_blocker_packet_required: true,
      repeated_owner_request_escalates_delivery_failure: true,
    },
    summary,
    systems,
    commands,
  }
}

export function resolveJarvisSystemCommandRequest(request: string) {
  const normalized = request.toLowerCase().replace(/\s+/g, ' ').trim()
  const registry = buildJarvisSystemCommandRegistry()
  if (normalized.includes('pacman cybersecurity') || (normalized.includes('paperclip') && normalized.includes('company'))) {
    return registry.commands.find((item) => item.command_id === 'paperclip.company.bootstrap.pacman_cybersecurity') || null
  }
  if (normalized.includes('zapier')) return registry.commands.find((item) => item.system_id === 'zapier') || null
  if (normalized.includes('n8n')) return registry.commands.find((item) => item.system_id === 'n8n') || null
  if (normalized.includes('drive')) return registry.commands.find((item) => item.system_id === 'drive_onedrive') || null
  if (normalized.includes('webhook')) return registry.commands.find((item) => item.system_id === 'webhooks') || null
  if (normalized.includes('backup') || normalized.includes('schedule')) return registry.commands.find((item) => item.command_id === 'scheduler.auto_backup.run_now') || null
  if (normalized.includes('mcp memory')) return registry.commands.find((item) => item.command_id === 'mcp.memory_write_probe') || null
  if (normalized.includes('mcp')) return registry.commands.find((item) => item.command_id === 'mcp.readonly_status_probe') || null
  if (normalized.includes('obsidian')) return registry.commands.find((item) => item.command_id === 'brain_memory.obsidian_structured_project_note.create') || null
  if (normalized.includes('brain bridge') || normalized.includes('brain sync')) return registry.commands.find((item) => item.command_id === 'brain.status.read') || null
  if (normalized.includes('mempalace') || normalized.includes('memory summary')) return registry.commands.find((item) => item.command_id === 'brain_memory.mempalace_categorized_task_result.write') || null
  if (normalized.includes('telegram')) return registry.commands.find((item) => item.system_id === 'telegram') || null
  if (normalized.includes('agentmail') || normalized.includes('email draft')) return registry.commands.find((item) => item.system_id === 'agentmail') || null
  if (normalized.includes('gateway')) return registry.commands.find((item) => item.command_id === 'gateway.status.read') || null
  if (normalized.includes('youtube') || normalized.includes('youtu.be') || normalized.includes('video')) return registry.commands.find((item) => item.command_id === 'youtube.transcript.read') || null
  if (normalized.includes('http://') || normalized.includes('https://') || normalized.includes('public page') || normalized.includes('product page') || normalized.includes('docs')) return registry.commands.find((item) => item.command_id === 'web.public_page.read') || null
  if (normalized.includes('spaceagent') || normalized.includes('space agent')) return registry.commands.find((item) => item.command_id === 'spaceagent.status.read') || null
  return null
}
