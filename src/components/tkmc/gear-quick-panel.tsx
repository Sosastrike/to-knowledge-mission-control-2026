'use client'

// TKMC Phase 3 — Gear icon quick panel (hybrid: quick shortcuts + link to full settings)
// Click gear → this panel slides open. Shows fast-access admin shortcuts.

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Shortcut {
  id: string
  label: string
  description: string
  icon: string
  action: () => void
}

export function GearQuickPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const shortcuts: Shortcut[] = [
    {
      id: 'add-user',
      label: 'Add User',
      description: 'Invite a new team member',
      icon: '👤',
      action: () => { router.push('/settings/tkmc/users?action=new'); onClose() },
    },
    {
      id: 'invite-user',
      label: 'Send Invite',
      description: 'Email, link, or CSV',
      icon: '✉️',
      action: () => { router.push('/settings/tkmc/users?action=invite'); onClose() },
    },
    {
      id: 'view-alerts',
      label: 'View Alerts',
      description: 'Active system alerts',
      icon: '🔔',
      action: () => { router.push('/settings/tkmc/alerts'); onClose() },
    },
    {
      id: 'integration-health',
      label: 'Integration Health',
      description: 'API tokens & connections',
      icon: '🔌',
      action: () => { router.push('/settings/tkmc/integrations'); onClose() },
    },
    {
      id: 'channels',
      label: 'Channels',
      description: 'Telegram, Discord, WhatsApp, X...',
      icon: '📡',
      action: () => { router.push('/settings/tkmc/channels'); onClose() },
    },
    {
      id: 'security',
      label: 'Security / 2FA',
      description: 'Authenticator & SMS setup',
      icon: '🔐',
      action: () => { router.push('/settings/tkmc/security'); onClose() },
    },
  ]

  return (
    <div
      ref={panelRef}
      className="fixed top-14 right-4 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
      style={{ animation: 'tkmc-slide-in 150ms ease-out' }}
    >
      <div className="px-4 py-3 border-b border-border bg-surface-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Quick Admin</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-lg leading-none"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="divide-y divide-border">
        {shortcuts.map(s => (
          <button
            key={s.id}
            onClick={s.action}
            className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-1 transition-colors"
          >
            <span className="text-2xl flex-shrink-0">{s.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">{s.label}</div>
              <div className="text-xs text-muted-foreground truncate">{s.description}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border bg-surface-1">
        <button
          onClick={() => { router.push('/settings/tkmc'); onClose() }}
          className="w-full px-3 py-2 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open Full Settings →
        </button>
      </div>

      <style jsx>{`
        @keyframes tkmc-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export function GearIconButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-1 transition-colors"
        aria-label="Admin quick panel"
        title="Admin quick panel"
      >
        <svg className="w-5 h-5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="2" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" strokeLinecap="round" />
        </svg>
      </button>
      {open && <GearQuickPanel onClose={() => setOpen(false)} />}
    </>
  )
}
