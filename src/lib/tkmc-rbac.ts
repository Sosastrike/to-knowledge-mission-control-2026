// TKMC — 5-Role RBAC System
// Maps old 3-role system (admin/operator/viewer) onto new 5-role system
// while maintaining backward compatibility.

export type TKMCRole = 'owner' | 'admin' | 'manager' | 'agent' | 'viewer'
export type LegacyRole = 'admin' | 'operator' | 'viewer'

export const TKMC_ROLES: TKMCRole[] = ['owner', 'admin', 'manager', 'agent', 'viewer']

export const ROLE_LABELS: Record<TKMCRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  agent: 'Agent',
  viewer: 'Viewer',
}

export const ROLE_DESCRIPTIONS: Record<TKMCRole, string> = {
  owner: 'Full system access + billing + destructive operations',
  admin: 'Manage users, agents, integrations, system configuration',
  manager: 'Assign tasks, manage team workflows, review work',
  agent: 'Execute assigned tasks, limited read access to admin areas',
  viewer: 'Read-only access to dashboards and reports',
}

/**
 * Capability toggles — each role inherits all lower-role capabilities.
 * Designed to be overridable with custom toggles per workspace.
 */
export const ROLE_CAPABILITIES: Record<TKMCRole, Set<string>> = {
  owner: new Set([
    'system.destroy', 'system.billing', 'system.rotate-keys',
    'users.manage', 'users.delete', 'users.change-roles',
    'agents.manage', 'agents.delete', 'agents.restart',
    'integrations.manage', 'integrations.delete', 'integrations.test',
    'channels.manage', 'channels.delete',
    'models.manage', 'skills.manage',
    'security.manage', 'security.audit',
    'schedule.manage', 'tasks.manage', 'tasks.assign',
    'dashboard.edit', 'dashboard.view',
  ]),
  admin: new Set([
    'users.manage', 'users.change-roles',
    'agents.manage', 'agents.restart',
    'integrations.manage', 'integrations.test',
    'channels.manage',
    'models.manage', 'skills.manage',
    'security.audit',
    'schedule.manage', 'tasks.manage', 'tasks.assign',
    'dashboard.edit', 'dashboard.view',
  ]),
  manager: new Set([
    'agents.view', 'agents.restart',
    'tasks.manage', 'tasks.assign', 'tasks.view',
    'schedule.view',
    'dashboard.view',
    'channels.view',
  ]),
  agent: new Set([
    'tasks.view', 'tasks.execute',
    'agents.view',
    'dashboard.view',
  ]),
  viewer: new Set([
    'dashboard.view',
    'tasks.view',
    'agents.view',
  ]),
}

/**
 * Map legacy 3-role system to new 5-role system.
 * admin → admin, operator → manager, viewer → viewer
 */
export function upgradeLegacyRole(legacy: LegacyRole | string | undefined): TKMCRole {
  switch (legacy) {
    case 'admin': return 'admin'
    case 'operator': return 'manager'
    case 'viewer': return 'viewer'
    case 'owner': return 'owner'
    case 'manager': return 'manager'
    case 'agent': return 'agent'
    default: return 'viewer'
  }
}

/**
 * Check if a role has a specific capability.
 */
export function hasCapability(role: TKMCRole | string | undefined, capability: string): boolean {
  const normalized = upgradeLegacyRole(role)
  return ROLE_CAPABILITIES[normalized]?.has(capability) ?? false
}

/**
 * 2FA cadence (days) per role — Phase 7
 */
export const ROLE_2FA_CADENCE_DAYS: Record<TKMCRole, number> = {
  owner: 30,    // monthly
  admin: 7,     // weekly
  manager: 7,   // weekly (treated like admin for 2FA)
  agent: 1,     // daily
  viewer: 1,    // daily
}

export function get2FACadenceDays(role: TKMCRole | string | undefined): number {
  return ROLE_2FA_CADENCE_DAYS[upgradeLegacyRole(role)] ?? 1
}
