import type { AgentZeroReadOnlyContext, AgentZeroSkillRegistryItem } from '@/lib/agent-zero-bridge'
import type { SkillRoleTag } from '@/lib/skill-role-tags'
import { inferSkillRoleTags } from '@/lib/skill-role-tags'

export const HERMES_SKILL_DRAFT_ROOT = '/home/tony/.openclaw/drafts/hermes/skills'

export type HermesSkillInventoryItem = {
  name: string
  source: string
  source_label: string
  path: string | null
  skill_doc_path: string | null
  description: string
  role_tags: SkillRoleTag[]
  available_to: Array<'agent_zero' | 'hermes'>
  required_tools: string[]
  required_credentials: string[]
  execution_requirements: string[]
  missing_dependencies: string[]
  blocked_reasons: string[]
  status: string
  blocked: boolean
  blocked_reason: string | null
  draft_writes_enabled: false
}

export type HermesSkillInventory = {
  runtime_layer: 'OpenClaw+'
  total: number
  blocked_total: number
  missing_dependencies_total: number
  role_tags: SkillRoleTag[]
  role_tag_counts: Record<SkillRoleTag, number>
  source_count: number
  draft_location: string
  draft_writes_enabled: false
  production_skill_writes_enabled: false
  activation_requires: 'agent_zero_bridge_session'
  review_workflow: string[]
  skills: HermesSkillInventoryItem[]
  tony_owns_skill_system: false
}

export type HermesSkillProposal = {
  ok: true
  mode: 'proposal_only_no_files_written'
  title: string
  slug: string
  draft_location: string
  file_written: false
  production_skill_write: false
  requires_agent_zero_review: true
  activation_requires: 'agent_zero_bridge_session'
  role_tags: SkillRoleTag[]
  purpose: string
  inputs: string[]
  outputs: string[]
  required_tools: string[]
  required_credentials: string[]
  blocked_reasons: string[]
  review_workflow: string[]
  outline: string[]
}

const REVIEW_WORKFLOW = [
  'Hermes drafts a proposal only; no production skill write occurs from read-only chat.',
  'Agent Zero reviews the proposal for purpose, dependencies, credentials, and safety.',
  'Owner-approved Agent Zero Bridge Session is required before writing a draft spec.',
  'Activation requires tests, security review, audit entry, and explicit promotion from draft to production.',
]

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function blockedReason(skill: AgentZeroSkillRegistryItem): string | null {
  return skill.blocked_reason || skill.blocked_reasons?.[0] || skill.missing_dependencies?.[0] || skill.blocked_dependencies?.[0] || null
}

export function buildHermesSkillInventory(context: AgentZeroReadOnlyContext): HermesSkillInventory {
  const skills = context.skills.registry.map((skill): HermesSkillInventoryItem => {
    const roleTags = uniqueSorted([
      ...(skill.role_tags || []),
      ...inferSkillRoleTags({
        name: skill.name,
        source: skill.source,
        description: skill.description,
        path: skill.path,
        dependencies: skill.dependencies,
        requiredTools: skill.required_tools,
        requiredCredentials: skill.required_credentials,
      }),
    ])
    const availableTo = uniqueSorted([...(skill.available_to || []), ...(skill.available_to_agents || []), 'agent_zero', 'hermes']) as Array<'agent_zero' | 'hermes'>
    const reason = blockedReason(skill)
    const blocked = skill.status === 'blocked' || Boolean(reason)
    return {
      name: skill.name,
      source: skill.source,
      source_label: skill.source_label,
      path: skill.path || null,
      skill_doc_path: skill.skill_doc_path || null,
      description: skill.description,
      role_tags: roleTags,
      available_to: availableTo,
      required_tools: skill.required_tools,
      required_credentials: skill.required_credentials,
      execution_requirements: skill.execution_requirements,
      missing_dependencies: skill.missing_dependencies,
      blocked_reasons: uniqueSorted([...(skill.blocked_reasons || []), ...(reason ? [reason] : [])]),
      status: skill.status,
      blocked,
      blocked_reason: reason,
      draft_writes_enabled: false,
    }
  })

  const tagList: SkillRoleTag[] = ['engineering', 'research', 'automation', 'email', 'report', 'brain', 'workflow', 'integration']
  const roleTagCounts = Object.fromEntries(
    tagList.map((tag) => [tag, skills.filter((skill) => skill.role_tags.includes(tag)).length]),
  ) as Record<SkillRoleTag, number>

  return {
    runtime_layer: 'OpenClaw+',
    total: skills.length,
    blocked_total: skills.filter((skill) => skill.blocked).length,
    missing_dependencies_total: skills.filter((skill) => skill.missing_dependencies.length > 0).length,
    role_tags: uniqueSorted(skills.flatMap((skill) => skill.role_tags)),
    role_tag_counts: roleTagCounts,
    source_count: context.skills.sources.length,
    draft_location: HERMES_SKILL_DRAFT_ROOT,
    draft_writes_enabled: false,
    production_skill_writes_enabled: false,
    activation_requires: 'agent_zero_bridge_session',
    review_workflow: REVIEW_WORKFLOW,
    skills,
    tony_owns_skill_system: false,
  }
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'hermes-skill-proposal'
}

export function buildHermesSkillProposal(topic: string): HermesSkillProposal {
  const title = topic.trim() || 'Summarize Build-Wiki Runs'
  const slug = slugify(title.includes('Build-Wiki') || title.includes('Build Wiki') ? 'summarize-build-wiki-runs' : title)
  const roleTags = inferSkillRoleTags({
    name: slug,
    description: title,
    dependencies: ['tool:mission_control.read', 'tool:buildwiki.status', 'execution:bridge_session_required_for_activation'],
  })
  return {
    ok: true,
    mode: 'proposal_only_no_files_written',
    title: title.includes('Build-Wiki') || title.includes('Build Wiki') ? 'Summarize Build-Wiki Runs' : title,
    slug,
    draft_location: `${HERMES_SKILL_DRAFT_ROOT}/${slug}/SKILL.md`,
    file_written: false,
    production_skill_write: false,
    requires_agent_zero_review: true,
    activation_requires: 'agent_zero_bridge_session',
    role_tags: roleTags,
    purpose: 'Help Agent Zero turn Build-Wiki/Farmer run status, logs, blockers, and outputs into a concise owner-facing summary without running the farmer.',
    inputs: ['Build-Wiki/Farmer status payload', 'last run result', 'run-now approval state', 'known blockers'],
    outputs: ['short owner summary', 'blocked connector table', 'recommended next action', 'audit-ready evidence summary'],
    required_tools: ['mission_control.read', 'buildwiki.status.read'],
    required_credentials: [],
    blocked_reasons: ['draft_write_requires_agent_zero_bridge_session', 'activation_requires_agent_zero_review'],
    review_workflow: REVIEW_WORKFLOW,
    outline: [
      'Read Build-Wiki/Farmer status through Mission Control only.',
      'Summarize timer, service, last run, SMB/Fork 2 blocker, and Run Now approval state.',
      'State whether execution is blocked, approval-required, or ready inside Bridge Session.',
      'Return a natural owner-facing report with no raw paths, no task IDs, and no fake completion.',
    ],
  }
}

export function summarizeHermesSkillInventory(inventory: HermesSkillInventory): string {
  const tags = inventory.role_tags.length ? inventory.role_tags.join(', ') : 'no role tags visible'
  return `${inventory.total} OpenClaw+ shared skills visible to Hermes across ${inventory.source_count} sources; ${inventory.blocked_total} have blocked dependencies or missing requirements; role tags: ${tags}.`
}
