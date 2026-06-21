import type { User } from './auth'

type MissionControlRole = User['role'] | string

type AccountType = 'human' | 'service'

const ROLE_OPERATIONS: Record<string, string[]> = {
  admin: [
    'mission-control:profile:read',
    'mission-control:logout',
    'mission-control:agent-platform:read',
    'mission-control:agent-platform:write',
    'mission-control:approvals:read',
    'mission-control:approvals:decide',
    'mission-control:diagnostics:read',
  ],
  operator: [
    'mission-control:profile:read',
    'mission-control:logout',
    'mission-control:agent-platform:read',
    'mission-control:approvals:read',
    'mission-control:diagnostics:read',
  ],
  viewer: [
    'mission-control:profile:read',
    'mission-control:logout',
    'mission-control:agent-platform:read',
  ],
}

ROLE_OPERATIONS.mission_control_owner_operator = ROLE_OPERATIONS.admin

function accountTypeFor(user: User): AccountType {
  return user.id > 0 ? 'human' : 'service'
}

function actorIdFor(user: User): string {
  return user.id > 0 ? `usr_${user.id}` : `svc_${Math.abs(user.id)}`
}

export function allowedOperationsForRole(role: MissionControlRole): string[] {
  return [...(ROLE_OPERATIONS[role] || ROLE_OPERATIONS.viewer)]
}

export function buildAuthenticatedSessionPayload(user: User) {
  const roles = [user.role]
  return {
    authenticated: true,
    actor_id: actorIdFor(user),
    display_name: user.display_name || user.username,
    account_type: accountTypeFor(user),
    roles,
    allowed_operations: allowedOperationsForRole(user.role),
    expires_at: null,
    csrf_required: true,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      role: user.role,
      provider: user.provider || 'local',
      email: user.email || null,
      avatar_url: user.avatar_url || null,
      workspace_id: user.workspace_id ?? 1,
      tenant_id: user.tenant_id ?? 1,
    },
  }
}

export function buildUnauthenticatedSessionPayload() {
  return {
    authenticated: false,
    actor_id: null,
    display_name: null,
    account_type: null,
    roles: [],
    allowed_operations: [],
    expires_at: null,
    csrf_required: true,
  }
}
