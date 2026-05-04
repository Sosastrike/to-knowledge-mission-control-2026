import type { AgentZeroReadOnlyContext } from '@/lib/agent-zero-bridge'

export type HermesBrainSystemId = 'brain_sync' | 'obsidian' | 'mempalace' | 'graphify' | 'buildwiki'

export type HermesBrainSystemContext = {
  id: HermesBrainSystemId
  name: string
  role: string
  visible: boolean
  live_query_available: boolean
  read_available: boolean
  write_available: boolean
  write_enabled: false
  blocked: boolean
  blocked_reason: string | null
  read_blocked_reason: string | null
  write_blocked_reason: string | null
  source: 'mission_control_brain_registry' | 'mission_control_buildwiki_status'
}

export type HermesBrainBlocker = {
  system: HermesBrainSystemId
  blocker: string
}

export const HERMES_BRAIN_CANONICAL_HIERARCHY = {
  mode: 'hermes_brain_sync_canonical_hierarchy',
  owner: 'owner',
  nucleus: {
    id: 'agent_zero',
    name: 'Agent Zero',
    role: 'main nucleus / primary brain operator',
  },
  secondary: {
    id: 'hermes',
    name: 'Hermes',
    role: 'secondary / lieutenant / skill-workflow specialist',
    execution_enabled: false,
  },
  brain_systems: [
    { id: 'brain_sync', name: 'Brain Sync', role: 'brain coordination layer' },
    { id: 'obsidian', name: 'Obsidian', role: 'knowledge system' },
    { id: 'mempalace', name: 'MemPalace', role: 'memory system' },
    { id: 'graphify', name: 'Graphify', role: 'graph system' },
    { id: 'buildwiki', name: 'Build-Wiki / Farmer', role: 'knowledge sync / farmer system' },
  ],
  retired: {
    id: 'tony_legacy',
    role: 'archived / historical only',
    active_brain_center: false,
  },
} as const

const SYSTEM_ROLES: Record<HermesBrainSystemId, string> = {
  brain_sync: 'brain coordination layer',
  obsidian: 'knowledge system',
  mempalace: 'memory system',
  graphify: 'graph system',
  buildwiki: 'knowledge sync / farmer system',
}

const SYSTEM_NAMES: Record<HermesBrainSystemId, string> = {
  brain_sync: 'Brain Sync',
  obsidian: 'Obsidian',
  mempalace: 'MemPalace',
  graphify: 'Graphify',
  buildwiki: 'Build-Wiki / Farmer',
}

function labelBlocker(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/[_-]+/g, ' ')
}

function missingSystem(id: HermesBrainSystemId, blocker = `${id}_adapter_not_visible`): HermesBrainSystemContext {
  return {
    id,
    name: SYSTEM_NAMES[id],
    role: SYSTEM_ROLES[id],
    visible: false,
    live_query_available: false,
    read_available: false,
    write_available: false,
    write_enabled: false,
    blocked: true,
    blocked_reason: blocker,
    read_blocked_reason: blocker,
    write_blocked_reason: 'bridge_session_required_or_adapter_missing',
    source: id === 'buildwiki' ? 'mission_control_buildwiki_status' : 'mission_control_brain_registry',
  }
}

export function buildHermesBrainSystemsFromContext(context: AgentZeroReadOnlyContext): HermesBrainSystemContext[] {
  const registryById = new Map(context.brain.registry.map((item) => [item.id.toLowerCase(), item]))

  const fromRegistry = (id: Exclude<HermesBrainSystemId, 'buildwiki'>): HermesBrainSystemContext => {
    const source = registryById.get(id)
    if (!source) return missingSystem(id)
    const visible = Boolean(source.status_visible || source.read_available || source.status !== 'blocked')
    const readBlocked = source.read_available ? null : source.read_blocked_reason || source.blocked_reason || `${id}_read_adapter_blocked`
    const writeBlocked = source.write_available ? 'bridge_session_required_for_write' : source.write_blocked_reason || source.blocked_reason || `${id}_write_adapter_blocked`
    return {
      id,
      name: source.name || SYSTEM_NAMES[id],
      role: SYSTEM_ROLES[id],
      visible,
      live_query_available: Boolean(source.read_available || source.available_read_apis.length > 0),
      read_available: Boolean(source.read_available),
      write_available: Boolean(source.write_available),
      write_enabled: false,
      blocked: Boolean(source.blocked || !visible),
      blocked_reason: source.blocked_reason || (!visible ? `${id}_not_visible` : null),
      read_blocked_reason: readBlocked,
      write_blocked_reason: writeBlocked,
      source: 'mission_control_brain_registry',
    }
  }

  const buildWiki = context.opencloud_buildwiki
  const buildWikiVisible = Boolean(buildWiki?.build_wiki_status_visible || buildWiki?.read_available)
  const buildWikiBlocked = buildWiki?.blocked_reason || buildWiki?.write_blocked_reason || null

  return [
    fromRegistry('brain_sync'),
    fromRegistry('obsidian'),
    fromRegistry('mempalace'),
    fromRegistry('graphify'),
    buildWiki
      ? {
          id: 'buildwiki',
          name: SYSTEM_NAMES.buildwiki,
          role: SYSTEM_ROLES.buildwiki,
          visible: buildWikiVisible,
          live_query_available: Boolean(buildWiki.read_available || buildWiki.build_wiki_status_visible),
          read_available: Boolean(buildWiki.read_available),
          write_available: Boolean(buildWiki.write_available),
          write_enabled: false,
          blocked: Boolean(buildWiki.blocked || !buildWikiVisible),
          blocked_reason: buildWiki.blocked_reason || (!buildWikiVisible ? 'buildwiki_status_not_visible' : null),
          read_blocked_reason: buildWiki.read_blocked_reason || (!buildWikiVisible ? 'buildwiki_status_not_visible' : null),
          write_blocked_reason: buildWiki.write_blocked_reason || buildWikiBlocked || 'bridge_session_required_for_buildwiki_run_now',
          source: 'mission_control_buildwiki_status',
        }
      : missingSystem('buildwiki', 'buildwiki_status_not_visible'),
  ]
}

export function getHermesBrainBlockerTable(systems: HermesBrainSystemContext[]): HermesBrainBlocker[] {
  return systems.flatMap((system) => {
    const blockers = [
      system.blocked_reason,
      system.read_blocked_reason,
      system.write_blocked_reason,
    ].filter((blocker): blocker is string => Boolean(blocker))
    return Array.from(new Set(blockers)).map((blocker) => ({
      system: system.id,
      blocker,
    }))
  })
}

export function summarizeHermesBrainSystems(systems: HermesBrainSystemContext[]): string {
  return systems
    .map((system) => {
      const blocker = labelBlocker(system.blocked_reason || system.read_blocked_reason || system.write_blocked_reason)
      return [
        `${system.name}: ${system.visible ? 'visible' : 'blocked'}`,
        system.live_query_available ? 'live query available' : 'live query blocked',
        system.read_available ? 'read available' : 'read blocked',
        system.write_available ? 'write adapter available' : 'write blocked',
        `write enabled ${system.write_enabled ? 'yes' : 'no'}`,
        blocker ? `blocker ${blocker}` : null,
      ].filter(Boolean).join(', ')
    })
    .join('; ')
}

export function hermesCanTruthfullySeeBrainContext(systems: HermesBrainSystemContext[]): boolean {
  return systems.some((system) => system.visible && system.live_query_available)
}
