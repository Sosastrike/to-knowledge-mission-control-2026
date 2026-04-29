'use client'

// ─────────────────────────────────────────────────────────────────────
// src/components/agent-network/AgentNetworkClient.tsx
//
// Client wrapper for the Agent Network Phase A page.
//
// Responsibilities:
//   - Fetch live agent list from existing /api/agents (mission-control's
//     own registry, behind requireRole('viewer'))
//   - Render tier-laned canvas (commander · lieutenant · specialist · worker)
//   - Render external/tailnet section (Agent Zero · Hermes sandbox ·
//     OpenClaw Gateway · Bridge Mode)
//   - Show "PHASE A — READ-ONLY" header chip
//   - Every disabled mutation control carries a visible
//     "Phase B — owner setup required" pill (no silent grays)
//
// Phase A explicitly does NOT:
//   - call any mutation endpoint (no POST/PATCH/DELETE)
//   - subscribe to SSE
//   - render approval state changes
//   - mutate Tony / Agent Zero / governance / credentials
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react'
import styles from './agent-network.module.css'

interface AgentRow {
  id?: string
  name?: string
  status?: string
  health?: string
  last_heartbeat?: number
  channels?: string[]
  skills?: string[]
  role?: string
  template?: string
  workspace_id?: number
}

interface HermesInfo {
  installed: boolean
  path: string | null
  version: string | null
}

interface BridgeInfo {
  plansFound: number
  paths: string[]
}

type ProviderState =
  | 'active'
  | 'configured'
  | 'missing_credential'
  | 'degraded'
  | 'sandbox'
  | 'backup'
  | 'unknown'

interface BridgeProviderStatus {
  id: string
  name: string
  category: string
  state: ProviderState
  last_checked: number
  detail?: {
    endpoint?: string | null
    version?: string | null
    http_status?: number | null
    latency_ms?: number | null
    credential_name?: string | null
    credential_present?: boolean
    notes?: string
    error?: string | null
  }
  next_action?: string | null
}

interface BridgeProvidersPayload {
  ok?: boolean
  providers?: BridgeProviderStatus[]
  summary?: {
    total?: number
    by_state?: Record<string, number>
  }
  error?: string
}

interface Props {
  hermes: HermesInfo
  bridge: BridgeInfo
}

// Static reference for the 4 tiers (per spec §1)
const TIER_DEFS: Array<{ id: string; label: string; sub: string }> = [
  { id: 'commander', label: 'Commander', sub: 'Owner-assistant; routes work, sets priorities' },
  { id: 'lieutenant', label: 'Lieutenants', sub: 'Cluster owners; report to commanders' },
  { id: 'specialist', label: 'Specialists', sub: 'Domain-specific workers' },
  { id: 'worker', label: 'Workers', sub: 'Long-running task agents' },
]

// Static role assignment for known agents (mirrors the canonical registry's
// seed data so the layout has correct tier placement before live RBAC lands).
// Phase B replaces this with the `agents.tier` column from spec §2.
const KNOWN_TIER_OF: Record<string, string> = {
  tony:       'commander',
  main:       'commander',  // alias used by /api/agents
  archivist:  'specialist',
  atlas:      'lieutenant',
  builder:    'specialist',
  echo:       'worker',
  forge:      'lieutenant',
  growth:     'specialist',
  loom:       'specialist',
  operator:   'lieutenant',
  pacman:     'specialist',
  qa:         'specialist',
  researcher: 'specialist',
}

const KNOWN_PROTECTED: Record<string, boolean> = {
  tony: true,
  main: true,
  // agent_zero is handled in the External section (it's not in MC's /api/agents)
}

// ── Phase B pill (visible — never silently grayed) ────────────────
function PhaseBPill({ label = 'Phase B — owner setup required' }: { label?: string }) {
  return <span className={styles.phaseBPill}>{label}</span>
}

function StatusDot({ status }: { status: string | undefined }) {
  const cls =
    status === 'active' || status === 'online'
      ? styles.dotOnline
      : status === 'idle'
      ? styles.dotIdle
      : status === 'degraded'
      ? styles.dotDegraded
      : styles.dotOffline
  return <span className={cls} aria-label={`status: ${status || 'unknown'}`} />
}

function providerStateLabel(state: ProviderState | undefined) {
  return (state || 'unknown').replace(/_/g, ' ')
}

function ProviderCard({ provider }: { provider: BridgeProviderStatus }) {
  const detail = provider.detail || {}
  return (
    <div className={styles.providerCard}>
      <div className={styles.providerHead}>
        <div className={styles.providerTitleWrap}>
          <StatusDot status={provider.state} />
          <strong className={styles.providerName}>{provider.name}</strong>
        </div>
        <span className={`${styles.providerState} ${styles[`providerState_${provider.state}`] || ''}`}>
          {providerStateLabel(provider.state)}
        </span>
      </div>
      <div className={styles.providerMeta}>
        <span>{provider.category}</span>
        {detail.http_status != null && <span>HTTP {detail.http_status}</span>}
        {detail.latency_ms != null && <span>{detail.latency_ms}ms</span>}
        {detail.credential_name && (
          <span>
            {detail.credential_name}: {detail.credential_present ? 'present' : 'missing'}
          </span>
        )}
      </div>
      {detail.endpoint && <div className={styles.providerEndpoint}>{detail.endpoint}</div>}
      {detail.notes && <p className={styles.providerNotes}>{detail.notes}</p>}
      {provider.next_action && <p className={styles.providerAction}>{provider.next_action}</p>}
    </div>
  )
}

// ── per-agent card ────────────────────────────────────────────────
function AgentCard({ agent }: { agent: AgentRow }) {
  const id = agent.id || agent.name || 'unknown'
  const isProtected = KNOWN_PROTECTED[id.toLowerCase()] === true
  const status = agent.status || (agent.health ?? 'unknown')
  return (
    <div className={isProtected ? `${styles.agentCard} ${styles.agentCardProtected}` : styles.agentCard}>
      <div className={styles.agentCardHead}>
        <StatusDot status={status} />
        <strong className={styles.agentName}>{(agent.name || id).toString()}</strong>
        {isProtected && <span className={styles.lockChip} title="Tony / Agent 0 cannot be modified">🔒 Protected</span>}
      </div>
      <div className={styles.agentMeta}>
        {agent.role && <span className={styles.metaItem}>role: {agent.role}</span>}
        {agent.template && <span className={styles.metaItem}>template: {agent.template}</span>}
        <span className={styles.metaItem}>status: {status || 'unknown'}</span>
        {typeof agent.last_heartbeat === 'number' && (
          <span className={styles.metaItem}>
            last heartbeat: {new Date(agent.last_heartbeat).toLocaleString()}
          </span>
        )}
      </div>
      <div className={styles.agentActions}>
        <button type="button" disabled className={styles.btnDisabled}>
          Rename
          <PhaseBPill />
        </button>
        <button type="button" disabled className={styles.btnDisabled}>
          Promote
          <PhaseBPill />
        </button>
        <button type="button" disabled className={styles.btnDisabled}>
          Retire
          <PhaseBPill />
        </button>
        <button type="button" disabled className={styles.btnDisabled}>
          Connect Engine
          <PhaseBPill />
        </button>
      </div>
    </div>
  )
}

// ── external entity card (Agent Zero, Hermes, Gateway, Bridge) ────
function ExternalCard({
  title,
  badge,
  description,
  details,
  showPhaseB = true,
}: {
  title: string
  badge?: string
  description: string
  details: Array<{ label: string; value: string }>
  showPhaseB?: boolean
}) {
  return (
    <div className={styles.externalCard}>
      <div className={styles.externalHead}>
        <strong className={styles.externalTitle}>{title}</strong>
        {badge && <span className={styles.externalBadge}>{badge}</span>}
      </div>
      <p className={styles.externalDescription}>{description}</p>
      <dl className={styles.externalDetails}>
        {details.map((d, i) => (
          <div key={i} className={styles.externalDetailRow}>
            <dt>{d.label}</dt>
            <dd>{d.value}</dd>
          </div>
        ))}
      </dl>
      {showPhaseB && (
        <div className={styles.agentActions}>
          <button type="button" disabled className={styles.btnDisabled}>
            Configure
            <PhaseBPill />
          </button>
        </div>
      )}
    </div>
  )
}

// ── tier section ──────────────────────────────────────────────────
function TierSection({
  tier,
  agents,
}: {
  tier: { id: string; label: string; sub: string }
  agents: AgentRow[]
}) {
  if (agents.length === 0) {
    return (
      <section className={styles.tierSection}>
        <header className={styles.tierHeader}>
          <h2 className={styles.tierTitle}>{tier.label}</h2>
          <span className={styles.tierSub}>{tier.sub}</span>
        </header>
        <div className={styles.emptyTier}>(none in this tier)</div>
      </section>
    )
  }
  return (
    <section className={styles.tierSection}>
      <header className={styles.tierHeader}>
        <h2 className={styles.tierTitle}>{tier.label}</h2>
        <span className={styles.tierSub}>{tier.sub}</span>
        <span className={styles.tierCount}>{agents.length}</span>
      </header>
      <div className={styles.tierGrid}>
        {agents.map((a) => (
          <AgentCard key={a.id || a.name} agent={a} />
        ))}
      </div>
    </section>
  )
}

export function AgentNetworkClient({ hermes, bridge }: Props) {
  const [agents, setAgents] = useState<AgentRow[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [providers, setProviders] = useState<BridgeProvidersPayload | null>(null)
  const [providerState, setProviderState] = useState<'loading' | 'ok' | 'error'>('loading')
  const [providerError, setProviderError] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/agents', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }
        return r.json()
      })
      .then((data) => {
        if (cancelled) return
        const list = Array.isArray(data) ? data : (data?.agents ?? [])
        setAgents(list)
        setLoadState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMsg((err as Error).message || 'fetch failed')
        setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch('/api/bridge/providers', { cache: 'no-store', credentials: 'same-origin' })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          throw new Error(data?.error || `HTTP ${r.status}`)
        }
        return data as BridgeProvidersPayload
      })
      .then((data) => {
        if (cancelled) return
        setProviders(data)
        setProviderState('ok')
      })
      .catch((err) => {
        if (cancelled) return
        setProviderError((err as Error).message || 'fetch failed')
        setProviderState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Bucket the agents by tier
  const buckets: Record<string, AgentRow[]> = {
    commander: [],
    lieutenant: [],
    specialist: [],
    worker: [],
    other: [],
  }
  for (const a of agents) {
    const id = (a.id || a.name || '').toLowerCase()
    const tier = KNOWN_TIER_OF[id] || 'other'
    buckets[tier].push(a)
  }

  return (
    <main className={styles.root} data-theme="mc">
      <header className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <h1 className={styles.pageTitle}>Agent Network</h1>
          <span className={styles.phaseChip}>Phase A — Read-Only</span>
        </div>
        <p className={styles.pageSub}>
          Production-safe view of the current agent constellation. Mutations and live event streams are gated to Phase B per <code>path-a-section-2-agent-network-refinement.md</code>.
        </p>
      </header>

      {/* Top stats strip */}
      <section className={styles.statsStrip}>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{loadState === 'loading' ? '…' : agents.length}</div>
          <div className={styles.statLabel}>Agents in registry</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{hermes.installed ? '✓' : '—'}</div>
          <div className={styles.statLabel}>Hermes sandbox</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>{bridge.plansFound}</div>
          <div className={styles.statLabel}>Bridge plans on disk</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statValue}>0</div>
          <div className={styles.statLabel}>Mutations enabled</div>
        </div>
      </section>

      {/* Loading / error banner */}
      {loadState === 'loading' && (
        <div className={styles.banner}>Loading agents from <code>/api/agents</code>…</div>
      )}
      {loadState === 'error' && (
        <div className={`${styles.banner} ${styles.bannerError}`}>
          <strong>Could not load agents:</strong> {errorMsg}. Static reference cards below remain accurate.
        </div>
      )}

      {/* Tier-laned canvas */}
      <section className={styles.canvas}>
        {TIER_DEFS.map((t) => (
          <TierSection key={t.id} tier={t} agents={buckets[t.id]} />
        ))}
        {buckets.other.length > 0 && (
          <TierSection
            tier={{ id: 'other', label: 'Other / Unbucketed', sub: 'Tier not yet declared in registry' }}
            agents={buckets.other}
          />
        )}
      </section>

      {/* Bridge provider registry — read-only */}
      <section className={styles.providerSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>Bridge Provider Registry</h2>
          <span className={styles.tierSub}>
            Live read-only snapshot from <code>/api/bridge/providers</code>
          </span>
        </header>
        {providerState === 'loading' && (
          <div className={styles.banner}>Loading provider status from <code>/api/bridge/providers</code>…</div>
        )}
        {providerState === 'error' && (
          <div className={`${styles.banner} ${styles.bannerError}`}>
            <strong>Could not load provider status:</strong> {providerError}
          </div>
        )}
        {providerState === 'ok' && (
          <>
            <div className={styles.providerSummary}>
              <span>{providers?.summary?.total ?? providers?.providers?.length ?? 0} providers</span>
              {Object.entries(providers?.summary?.by_state || {}).map(([state, count]) => (
                <span key={state}>{providerStateLabel(state as ProviderState)}: {count}</span>
              ))}
            </div>
            <div className={styles.providerGrid}>
              {(providers?.providers || []).map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* External / tailnet entities */}
      <section className={styles.externalSection}>
        <header className={styles.externalSectionHeader}>
          <h2 className={styles.tierTitle}>External / Tailnet</h2>
          <span className={styles.tierSub}>
            Entities outside the Mission Control registry — read-only Phase A view
          </span>
        </header>
        <div className={styles.externalGrid}>
          <ExternalCard
            title="Agent Zero"
            badge="Tailnet-only"
            description="External agent runtime. Container running on Tailnet IP only — no public exposure. Phase A: visibility only."
            details={[
              { label: 'Image', value: 'agent0ai/agent-zero:latest' },
              { label: 'Tailnet endpoint', value: '100.116.35.95:50080' },
              { label: 'Public exposure', value: 'NONE (by design)' },
              { label: 'Mount', value: '/home/tony/agent-zero-deploy/data → /a0' },
              { label: 'Phase A access', value: 'read-only' },
            ]}
          />
          <ExternalCard
            title="Hermes Agent"
            badge={hermes.installed ? 'Sandbox installed' : 'Not installed'}
            description={
              hermes.installed
                ? 'Sandbox-only install. CLI works under isolated HERMES_HOME. Not operational in production.'
                : 'Sandbox folder not detected. Install per /home/tony/claudeclaw/runtime/hermes-sandbox-install-report.md.'
            }
            details={[
              { label: 'Path', value: hermes.path || '(not present)' },
              { label: 'Version', value: hermes.version || '(unknown)' },
              { label: 'Production wiring', value: 'NONE — sandbox-only' },
              { label: 'HERMES_HOME', value: '/home/tony/sandbox/hermes-home-* (isolated)' },
              { label: 'Phase A access', value: 'read-only status display' },
            ]}
          />
          <ExternalCard
            title="OpenClaw Gateway"
            badge="HTTP 200"
            description="Local gateway providing OpenClaw runtime services. Read-only health surface."
            details={[
              { label: 'Local endpoint', value: 'http://127.0.0.1:18789' },
              { label: 'Public endpoint', value: 'https://gw.knowledge-vs-ai.com' },
              { label: 'Status (last check)', value: '200 OK (healthy)' },
              { label: 'Phase A access', value: 'read-only health' },
            ]}
            showPhaseB={false}
          />
          <ExternalCard
            title="Bridge Mode"
            badge={bridge.plansFound > 0 ? `${bridge.plansFound} plans on disk` : 'No plans found'}
            description="Cross-agent ticketed handoff plane. Plan-only — implementation gated to Phase B."
            details={[
              { label: 'Architecture plan', value: 'runtime/agent-network-bridge-mode-plan.md' },
              { label: 'Phase A discovery', value: 'runtime/bridge-mode-phase-a-discovery-report.md' },
              { label: 'Phase B impl plan', value: 'runtime/bridge-mode-phase-b-implementation-plan.md' },
              { label: 'Schema plan', value: 'runtime/bridge-mode-schema-plan.md' },
              { label: 'Status', value: 'NOT IMPLEMENTED — planning artifacts only' },
            ]}
          />
        </div>
      </section>

      {/* Footer with Phase B notice */}
      <footer className={styles.footer}>
        <div className={styles.footerNote}>
          <strong>Phase B</strong> — full mutation surface (8 DB tables · ~18 API routes · SSE for brain_sync &amp; harness · TTL job for approvals · server-enforced HTTP 423 for Tony/Agent 0 · audit-chain double-emit) is gated on per-item owner approval. See <code>.designer-review/path-a-section-2-agent-network-refinement.md</code>.
        </div>
        <div className={styles.footerMeta}>
          <span>© 2025 To-Knowledge</span>
          <span className={styles.footerDot} />
          <span>Path A · Section 2 · Phase A</span>
          <span className={styles.footerDot} />
          <span>Read-only</span>
        </div>
      </footer>
    </main>
  )
}
