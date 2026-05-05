export const GATEWAY_STORAGE_MODES = ['local_vault', 'scratchpad', 'git_sync'] as const

export type GatewayStorageMode = (typeof GATEWAY_STORAGE_MODES)[number]

export const GATEWAY_SYNC_STATES = [
  'not_configured',
  'clean',
  'dirty',
  'pull_required',
  'push_required',
  'conflict',
  'blocked',
] as const

export type GatewaySyncState = (typeof GATEWAY_SYNC_STATES)[number]

export const GATEWAY_SYNCABLE_RESOURCE_KINDS = [
  'gateway_registry',
  'gateway_routes',
  'gateway_policies',
  'capability_registry',
  'skill_manifest',
  'model_catalog',
  'mcp_client_config',
  'api_collection',
  'event_contract',
  'brain_adapter_manifest',
  'report_template',
] as const

export type GatewaySyncableResourceKind = (typeof GATEWAY_SYNCABLE_RESOURCE_KINDS)[number]

export const GATEWAY_BLOCKED_SYNC_RESOURCE_KINDS = [
  'api_key',
  'oauth_token',
  'auth_file',
  'env_file',
  'systemd_credential',
  'raw_memory_dump',
  'raw_vault_note',
  'delivery_attachment',
  'runtime_log_with_secrets',
] as const

export type GatewayBlockedSyncResourceKind = (typeof GATEWAY_BLOCKED_SYNC_RESOURCE_KINDS)[number]

export type GatewaySyncResourceKind = GatewaySyncableResourceKind | GatewayBlockedSyncResourceKind

export type GatewayGitRemote = {
  provider: 'github' | 'gitlab' | 'bitbucket' | 'other'
  url_configured: boolean
  url_label: string | null
  branch: string | null
  auth_configured: boolean
  auth_source: 'git_config' | 'credential_helper' | 'secret_file' | 'ssh_agent' | 'missing'
}

export type GatewaySecretSyncPolicy = {
  sync_secrets: false
  allowed_secret_references: 'names_only'
  external_vault_required: boolean
  scanner_required: boolean
  blocked_resource_kinds: GatewayBlockedSyncResourceKind[]
}

export type GatewayStorageProject = {
  id: string
  label: string
  mode: GatewayStorageMode
  local_first: boolean
  cloud_required: false
  remote: GatewayGitRemote | null
  sync_state: GatewaySyncState
  last_commit: string | null
  dirty_files: string[]
  conflicts: string[]
  syncable_resource_kinds: GatewaySyncableResourceKind[]
  secret_policy: GatewaySecretSyncPolicy
  blockers: string[]
}

export type GatewayStorageResource = {
  id: string
  kind: GatewaySyncResourceKind
  label: string
  safe_to_sync: boolean
  path_hint: string
  blocker: string | null
}

export type GatewayGitSyncPlan = {
  project: GatewayStorageProject
  resources: GatewayStorageResource[]
  actions: Array<{
    id: string
    label: string
    allowed: boolean
    blocker: string | null
  }>
  owner_summary: string
}

const DEFAULT_SECRET_POLICY: GatewaySecretSyncPolicy = {
  sync_secrets: false,
  allowed_secret_references: 'names_only',
  external_vault_required: true,
  scanner_required: true,
  blocked_resource_kinds: [...GATEWAY_BLOCKED_SYNC_RESOURCE_KINDS],
}

const DEFAULT_SYNCABLE_RESOURCE_KINDS: GatewaySyncableResourceKind[] = [...GATEWAY_SYNCABLE_RESOURCE_KINDS]

export function normalizeGatewayStorageMode(mode: string | null | undefined): GatewayStorageMode {
  const normalized = String(mode || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (isGatewayStorageMode(normalized)) return normalized
  if (normalized === 'local' || normalized === 'vault') return 'local_vault'
  if (normalized === 'scratch' || normalized === 'scratch_pad') return 'scratchpad'
  if (normalized === 'git' || normalized === 'git_backed') return 'git_sync'
  return 'local_vault'
}

export function normalizeGatewaySyncState(state: string | null | undefined): GatewaySyncState {
  const normalized = String(state || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (isGatewaySyncState(normalized)) return normalized
  if (['ok', 'synced', 'up_to_date'].includes(normalized)) return 'clean'
  if (['modified', 'changes'].includes(normalized)) return 'dirty'
  if (['behind'].includes(normalized)) return 'pull_required'
  if (['ahead'].includes(normalized)) return 'push_required'
  if (['merge_conflict', 'conflicts'].includes(normalized)) return 'conflict'
  return 'not_configured'
}

export function isGatewayResourceSyncable(kind: GatewaySyncResourceKind | string): kind is GatewaySyncableResourceKind {
  return (GATEWAY_SYNCABLE_RESOURCE_KINDS as readonly string[]).includes(kind)
}

export function isGatewayResourceBlockedFromSync(kind: GatewaySyncResourceKind | string): kind is GatewayBlockedSyncResourceKind {
  return (GATEWAY_BLOCKED_SYNC_RESOURCE_KINDS as readonly string[]).includes(kind)
}

export function createGatewayStorageProject(input: Partial<GatewayStorageProject> & {
  id: string
  label: string
  mode?: GatewayStorageMode | string
}): GatewayStorageProject {
  const mode = normalizeGatewayStorageMode(input.mode)
  const remote = input.remote ?? null
  const blockers = [
    ...(input.blockers || []),
    ...blockersForStorageMode(mode, remote),
  ].filter(Boolean)

  return {
    id: normalizeId(input.id),
    label: input.label,
    mode,
    local_first: input.local_first ?? true,
    cloud_required: false,
    remote,
    sync_state: normalizeGatewaySyncState(input.sync_state),
    last_commit: input.last_commit || null,
    dirty_files: input.dirty_files ? [...input.dirty_files] : [],
    conflicts: input.conflicts ? [...input.conflicts] : [],
    syncable_resource_kinds: input.syncable_resource_kinds ? [...input.syncable_resource_kinds] : [...DEFAULT_SYNCABLE_RESOURCE_KINDS],
    secret_policy: input.secret_policy || DEFAULT_SECRET_POLICY,
    blockers,
  }
}

export function createGatewayStorageResource(input: {
  id: string
  kind: GatewaySyncResourceKind | string
  label: string
  path_hint?: string
}): GatewayStorageResource {
  const kind = normalizeResourceKind(input.kind)
  const safeToSync = isGatewayResourceSyncable(kind)
  return {
    id: normalizeId(input.id),
    kind,
    label: input.label,
    safe_to_sync: safeToSync,
    path_hint: input.path_hint || ownerSafePathHint(kind),
    blocker: safeToSync ? null : 'gateway_git_sync_blocks_secret_or_runtime_resource',
  }
}

export function createGatewayGitSyncPlan(input: {
  project: GatewayStorageProject
  resources: GatewayStorageResource[]
}): GatewayGitSyncPlan {
  const blockedResources = input.resources.filter((resource) => !resource.safe_to_sync)
  const gitReady = input.project.mode === 'git_sync'
    && input.project.remote?.url_configured === true
    && input.project.remote?.auth_configured === true
    && input.project.blockers.length === 0
  const canCommit = blockedResources.length === 0 && input.project.sync_state !== 'conflict'
  const canPush = gitReady && canCommit

  return {
    project: input.project,
    resources: input.resources.map((resource) => ({ ...resource })),
    actions: [
      {
        id: 'commit_gateway_project',
        label: 'Commit Gateway project resources',
        allowed: canCommit,
        blocker: canCommit ? null : blockedResources[0]?.blocker || 'gateway_git_sync_conflict_requires_resolution',
      },
      {
        id: 'push_gateway_project',
        label: 'Push Gateway project resources',
        allowed: canPush,
        blocker: canPush ? null : input.project.blockers[0] || 'gateway_git_remote_or_auth_not_configured',
      },
      {
        id: 'pull_gateway_project',
        label: 'Pull Gateway project resources',
        allowed: input.project.mode === 'git_sync' && input.project.remote?.url_configured === true,
        blocker: input.project.mode === 'git_sync' && input.project.remote?.url_configured === true
          ? null
          : 'gateway_git_remote_not_configured',
      },
    ],
    owner_summary: summarizeGatewayGitSync(input.project, blockedResources.length),
  }
}

function summarizeGatewayGitSync(project: GatewayStorageProject, blockedResourceCount: number): string {
  if (project.mode !== 'git_sync') return 'Gateway project is local-first and not connected to Git Sync.'
  if (project.blockers.length > 0) return `Gateway Git Sync is blocked: ${project.blockers[0]}.`
  if (blockedResourceCount > 0) return `Gateway Git Sync is blocked by ${blockedResourceCount} non-syncable secret/runtime resource(s).`
  return 'Gateway Git Sync can version safe project resources; credentials stay in external secret stores.'
}

function blockersForStorageMode(mode: GatewayStorageMode, remote: GatewayGitRemote | null): string[] {
  if (mode !== 'git_sync') return []
  if (!remote) return ['gateway_git_remote_not_configured']
  const blockers: string[] = []
  if (!remote.url_configured) blockers.push('gateway_git_remote_not_configured')
  if (!remote.auth_configured) blockers.push('gateway_git_auth_not_configured')
  return blockers
}

function ownerSafePathHint(kind: GatewaySyncResourceKind): string {
  if (isGatewayResourceBlockedFromSync(kind)) return 'secret-store-only'
  return `gateway/${kind}`
}

function normalizeResourceKind(kind: string): GatewaySyncResourceKind {
  const normalized = normalizeId(kind)
  if (isGatewayResourceSyncable(normalized) || isGatewayResourceBlockedFromSync(normalized)) {
    return normalized
  }
  return 'api_collection'
}

function normalizeId(value: string): string {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function isGatewayStorageMode(mode: string): mode is GatewayStorageMode {
  return (GATEWAY_STORAGE_MODES as readonly string[]).includes(mode)
}

function isGatewaySyncState(state: string): state is GatewaySyncState {
  return (GATEWAY_SYNC_STATES as readonly string[]).includes(state)
}
