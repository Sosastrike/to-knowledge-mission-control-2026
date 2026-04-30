'use client'

// TKMC Phase 3 — Full settings shell with left sidebar (10 categories)
// Each category has its own detail panel on the right.

import { useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export interface SettingsCategory {
  id: string
  label: string
  icon: string
  description: string
  capability: string  // required RBAC capability
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'users',
    label: 'Users',
    icon: '👥',
    description: 'Create, invite, and manage team members',
    capability: 'users.manage',
  },
  {
    id: 'roles',
    label: 'Roles & Permissions',
    icon: '🛡️',
    description: 'Owner, Admin, Manager, Agent, Viewer + custom toggles',
    capability: 'users.manage',
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: '🤖',
    description: 'Status, channels, skills, logs, restart/reconnect',
    capability: 'agents.manage',
  },
  {
    id: 'models',
    label: 'Models',
    icon: '🧠',
    description: 'Assignments, priorities, fallbacks, cost rules',
    capability: 'models.manage',
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: '⚡',
    description: 'Versioning, validation, dependency checks',
    capability: 'skills.manage',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: '🔌',
    description: 'API tokens, health, test actions, error details',
    capability: 'integrations.manage',
  },
  {
    id: 'channels',
    label: 'Channels',
    icon: '📡',
    description: 'Telegram, Discord, WhatsApp, X, Instagram, LinkedIn',
    capability: 'channels.manage',
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: '🔔',
    description: 'Dashboard, email, Telegram/Discord alerts',
    capability: 'agents.manage',
  },
  {
    id: 'security',
    label: 'Security / 2FA',
    icon: '🔐',
    description: 'Role-based cadence and auth provider options',
    capability: 'security.manage',
  },
  {
    id: 'audit',
    label: 'Audit / Logs',
    icon: '📋',
    description: 'Administrative traceability and history',
    capability: 'security.audit',
  },
]

interface SettingsShellProps {
  active: string
  children?: ReactNode
}

export function SettingsShell({ active, children }: SettingsShellProps) {
  const router = useRouter()

  return (
    <div className="flex h-full bg-background">
      {/* Left sidebar */}
      <aside className="w-64 border-r border-border bg-surface-1 overflow-y-auto flex-shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Administrative command center
          </p>
        </div>
        <nav className="py-2">
          {SETTINGS_CATEGORIES.map(cat => {
            const isActive = active === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => router.push(`/settings/tkmc/${cat.id}`)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-l-2 border-primary'
                    : 'text-foreground/80 hover:bg-surface-2 border-l-2 border-transparent'
                }`}
              >
                <span className="text-lg leading-tight flex-shrink-0">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{cat.label}</div>
                  <div className="text-2xs text-muted-foreground truncate mt-0.5">
                    {cat.description}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Right detail pane */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  )
}

interface SettingsPageHeaderProps {
  categoryId: string
  actions?: ReactNode
}

export function SettingsPageHeader({ categoryId, actions }: SettingsPageHeaderProps) {
  const cat = SETTINGS_CATEGORIES.find(c => c.id === categoryId)
  if (!cat) return null

  return (
    <div className="flex items-start justify-between mb-6 pb-4 border-b border-border">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span>{cat.icon}</span>
          {cat.label}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
