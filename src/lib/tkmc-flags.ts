// To Knowledge Mission Control (TKMC) — Feature flags for safe rollout
// Lets us build new admin/dashboard/schedule layers without breaking the existing UI.

export const TKMC = {
  // Phase 2 — new priority-only dashboard (6 modules)
  NEW_DASHBOARD: process.env.NEXT_PUBLIC_TKMC_DASHBOARD === 'true',

  // Phase 3 — gear icon quick panel + full settings shell
  GEAR_ICON: true,
  SETTINGS_SHELL: true,

  // Phase 4 — 5-role RBAC (Owner/Admin/Manager/Agent/Viewer)
  ROLE_EXPANSION: true,

  // Phase 5 — horizontal line-cook schedule
  NEW_SCHEDULE: true,

  // Phase 6 — admin management screens (Agents/Models/Skills/Integrations/Channels)
  ADMIN_MANAGEMENT: true,

  // Phase 7 — 2FA with role-based cadence
  TFA_ENABLED: true,

  // Edit Dashboard customization
  EDIT_DASHBOARD: true,
} as const

export type TKMCFlag = keyof typeof TKMC

export function isEnabled(flag: TKMCFlag): boolean {
  return TKMC[flag] === true
}
