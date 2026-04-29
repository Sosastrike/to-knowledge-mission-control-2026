// ─────────────────────────────────────────────────────────────────────
// src/app/agents/page.tsx
//
// Path A · Section 2 · Phase A — read-only Agent Network
//
// Sources of design truth:
//   /home/tony/mission-control/.designer-review/agent-network-spec.md
//   /home/tony/mission-control/.designer-review/path-a-section-2-agent-network-refinement.md
//   /home/tony/mission-control/.designer-review/agent-network-2026-04-28-review.md
//
// Phase A scope (per owner approval 2026-04-28):
//   ✓ read existing agents
//   ✓ read existing statuses
//   ✓ show Tony, Agent Zero (external/tailnet), Hermes (sandbox), OpenClaw Gateway, Bridge Mode
//   ✓ disabled controls carry "Phase B — owner setup required" pills
//   ✗ NO add/remove/promote actions
//   ✗ NO DB tables, migrations, API writes, SSE, TTL jobs
//   ✗ NO HTTP 423 backend (deferred to Phase B)
//   ✗ NO Tony memory/voice/governance/credentials touched
//   ✗ NO Agent Zero config changes
//
// This is a Server Component. Filesystem checks (Hermes sandbox) run
// server-side. Live agent data is fetched by a small client wrapper
// from the existing /api/agents (mission-control's own registry).
// ─────────────────────────────────────────────────────────────────────
import { existsSync } from 'node:fs'
import type { Metadata } from 'next'
import { AgentNetworkClient } from '@/components/agent-network/AgentNetworkClient'

export const metadata: Metadata = {
  title: 'Agent Network · Mission Control',
  description: 'Production-safe read-only view of the agent constellation (Phase A).',
}

// Force this page to be dynamic so the fs probes always run on request.
export const dynamic = 'force-dynamic'

// Server-side facts — authoritative reference data observed during the
// runtime triage (2026-04-28T17:30Z). These are static for Phase A;
// Phase B will replace with live DB / SSE feeds.
function discoverHermesSandbox() {
  // Scan for any /home/tony/sandbox/hermes-agent-* directory
  // (the install path can include a date suffix, e.g. -20260428).
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const root = '/home/tony/sandbox'
    if (!fs.existsSync(root)) return { installed: false, path: null, version: null }
    const entries = fs.readdirSync(root)
    const match = entries.find((e) => e.startsWith('hermes-agent-'))
    if (!match) return { installed: false, path: null, version: null }
    const fullPath = `${root}/${match}`
    const venvPath = `${fullPath}/.venv`
    if (!existsSync(venvPath)) return { installed: false, path: fullPath, version: null }
    return {
      installed: true,
      path: fullPath,
      version: 'v0.11.0', // captured during 2026-04-28 install; Phase B fetches live
    }
  } catch {
    return { installed: false, path: null, version: null }
  }
}

function discoverBridgeModePlans() {
  // Server-side count of bridge-mode plan files in claudeclaw runtime
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const root = '/home/tony/claudeclaw/runtime'
    if (!fs.existsSync(root)) return { plansFound: 0, paths: [] }
    const entries = fs.readdirSync(root)
    const matches = entries.filter((e) => /bridge-mode/i.test(e) || /agent-network-bridge/i.test(e))
    return {
      plansFound: matches.length,
      paths: matches.map((m) => `${root}/${m}`),
    }
  } catch {
    return { plansFound: 0, paths: [] }
  }
}

export default function AgentsPage() {
  const hermes = discoverHermesSandbox()
  const bridge = discoverBridgeModePlans()

  return (
    <AgentNetworkClient
      hermes={hermes}
      bridge={bridge}
    />
  )
}
