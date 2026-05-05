import { describe, expect, it } from 'vitest'
import {
  GATEWAY_BLOCKED_SYNC_RESOURCE_KINDS,
  GATEWAY_STORAGE_MODES,
  GATEWAY_SYNCABLE_RESOURCE_KINDS,
  createGatewayGitSyncPlan,
  createGatewayStorageProject,
  createGatewayStorageResource,
  isGatewayResourceBlockedFromSync,
  isGatewayResourceSyncable,
  normalizeGatewayStorageMode,
  normalizeGatewaySyncState,
} from './gateway-storage-model'

describe('Gateway Git Sync storage model', () => {
  it('defines local-first Gateway storage modes and sync states', () => {
    expect([...GATEWAY_STORAGE_MODES]).toEqual(['local_vault', 'scratchpad', 'git_sync'])
    expect(normalizeGatewayStorageMode('Local Vault')).toBe('local_vault')
    expect(normalizeGatewayStorageMode('scratch pad')).toBe('scratchpad')
    expect(normalizeGatewayStorageMode('git-backed')).toBe('git_sync')
    expect(normalizeGatewaySyncState('synced')).toBe('clean')
    expect(normalizeGatewaySyncState('behind')).toBe('pull_required')
    expect(normalizeGatewaySyncState('merge conflict')).toBe('conflict')
  })

  it('allows registries, specs, MCP client config, skills, models, and policies to sync', () => {
    expect([...GATEWAY_SYNCABLE_RESOURCE_KINDS]).toEqual(
      expect.arrayContaining([
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
      ]),
    )
    expect(isGatewayResourceSyncable('mcp_client_config')).toBe(true)
    expect(isGatewayResourceSyncable('skill_manifest')).toBe(true)
  })

  it('blocks credentials, auth files, env files, raw memory, and runtime artifacts from sync', () => {
    expect([...GATEWAY_BLOCKED_SYNC_RESOURCE_KINDS]).toEqual(
      expect.arrayContaining([
        'api_key',
        'oauth_token',
        'auth_file',
        'env_file',
        'systemd_credential',
        'raw_memory_dump',
        'raw_vault_note',
        'delivery_attachment',
        'runtime_log_with_secrets',
      ]),
    )
    expect(isGatewayResourceBlockedFromSync('auth_file')).toBe(true)
    expect(isGatewayResourceBlockedFromSync('env_file')).toBe(true)
  })

  it('creates Git Sync projects that require explicit remote and auth readiness', () => {
    const project = createGatewayStorageProject({
      id: 'Gateway Project',
      label: 'Gateway project',
      mode: 'git_sync',
      sync_state: 'dirty',
      remote: {
        provider: 'github',
        url_configured: true,
        url_label: 'github:owner/gateway-project',
        branch: 'main',
        auth_configured: false,
        auth_source: 'missing',
      },
    })

    expect(project).toMatchObject({
      id: 'gateway_project',
      mode: 'git_sync',
      local_first: true,
      cloud_required: false,
      sync_state: 'dirty',
      blockers: ['gateway_git_auth_not_configured'],
    })
    expect(project.secret_policy).toMatchObject({
      sync_secrets: false,
      allowed_secret_references: 'names_only',
      external_vault_required: true,
      scanner_required: true,
    })
  })

  it('marks secret-like resources unsafe even when the project can sync', () => {
    const safe = createGatewayStorageResource({
      id: 'Gateway Registry',
      kind: 'gateway_registry',
      label: 'Gateway registry',
    })
    const blocked = createGatewayStorageResource({
      id: 'Codex Auth',
      kind: 'auth_file',
      label: 'Codex auth file',
    })

    expect(safe).toMatchObject({
      id: 'gateway_registry',
      kind: 'gateway_registry',
      safe_to_sync: true,
      blocker: null,
      path_hint: 'gateway/gateway_registry',
    })
    expect(blocked).toMatchObject({
      id: 'codex_auth',
      kind: 'auth_file',
      safe_to_sync: false,
      blocker: 'gateway_git_sync_blocks_secret_or_runtime_resource',
      path_hint: 'secret-store-only',
    })
  })

  it('produces a Git Sync plan that can commit safe resources and refuses secret resources', () => {
    const project = createGatewayStorageProject({
      id: 'gateway',
      label: 'Gateway',
      mode: 'git_sync',
      sync_state: 'dirty',
      remote: {
        provider: 'github',
        url_configured: true,
        url_label: 'github:owner/gateway',
        branch: 'to-knowledge-mc',
        auth_configured: true,
        auth_source: 'credential_helper',
      },
    })
    const plan = createGatewayGitSyncPlan({
      project,
      resources: [
        createGatewayStorageResource({ id: 'routes', kind: 'gateway_routes', label: 'Gateway route contracts' }),
        createGatewayStorageResource({ id: 'token', kind: 'oauth_token', label: 'OAuth token' }),
      ],
    })

    expect(plan.actions.find((action) => action.id === 'commit_gateway_project')).toMatchObject({
      allowed: false,
      blocker: 'gateway_git_sync_blocks_secret_or_runtime_resource',
    })
    expect(plan.actions.find((action) => action.id === 'push_gateway_project')?.allowed).toBe(false)
    expect(plan.owner_summary).toContain('blocked by 1 non-syncable')
  })

  it('allows commit and push when remote/auth are configured and resources are safe', () => {
    const project = createGatewayStorageProject({
      id: 'gateway',
      label: 'Gateway',
      mode: 'git_sync',
      sync_state: 'push_required',
      remote: {
        provider: 'github',
        url_configured: true,
        url_label: 'github:owner/gateway',
        branch: 'to-knowledge-mc',
        auth_configured: true,
        auth_source: 'credential_helper',
      },
    })
    const plan = createGatewayGitSyncPlan({
      project,
      resources: [
        createGatewayStorageResource({ id: 'models', kind: 'model_catalog', label: 'Model catalog' }),
        createGatewayStorageResource({ id: 'mcp', kind: 'mcp_client_config', label: 'MCP client config' }),
      ],
    })

    expect(plan.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'commit_gateway_project', allowed: true, blocker: null }),
        expect.objectContaining({ id: 'push_gateway_project', allowed: true, blocker: null }),
        expect.objectContaining({ id: 'pull_gateway_project', allowed: true, blocker: null }),
      ]),
    )
    expect(plan.owner_summary).toBe('Gateway Git Sync can version safe project resources; credentials stay in external secret stores.')
  })
})
