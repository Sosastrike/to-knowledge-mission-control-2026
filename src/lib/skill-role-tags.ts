export const SKILL_ROLE_TAGS = [
  'engineering',
  'research',
  'automation',
  'email',
  'report',
  'brain',
  'workflow',
  'integration',
] as const

export type SkillRoleTag = typeof SKILL_ROLE_TAGS[number]

const TAG_PATTERNS: Array<[SkillRoleTag, RegExp]> = [
  ['engineering', /\b(code|debug|deploy|test|tdd|api|db|database|migration|security|network|rollback|performance|backend|frontend|architecture|git|pr|review|logs?)\b/i],
  ['research', /\b(research|browse|crawl|firecrawl|search|source|reference|knowledge|docs?|wiki|vetting|investigation)\b/i],
  ['automation', /\b(automation|automate|workflow|n8n|zapier|cron|schedule|pipeline|agent|task|runbook|hook)\b/i],
  ['email', /\b(email|mail|gmail|smtp|imap|agentmail|message|reply)\b/i],
  ['report', /\b(report|pdf|summary|summarize|executive|brief|dashboard|status|evidence)\b/i],
  ['brain', /\b(brain|memory|mempalace|obsidian|graph|graphify|vault|build[-_\s]?wiki|farmer|sync)\b/i],
  ['workflow', /\b(workflow|plan|planner|proposal|skill|specialist|handoff|review|approval|process)\b/i],
  ['integration', /\b(integration|connector|mcp|bridge|slack|telegram|drive|onedrive|google|heygen|api|webhook|provider|tool)\b/i],
]

export function inferSkillRoleTags(input: {
  name?: string | null
  source?: string | null
  description?: string | null
  path?: string | null
  dependencies?: string[]
  requiredTools?: string[]
  requiredCredentials?: string[]
  declaredTags?: string[]
}): SkillRoleTag[] {
  const declared = new Set<SkillRoleTag>()
  for (const tag of input.declaredTags || []) {
    const normalized = tag.toLowerCase().replace(/[^a-z]/g, '')
    const match = SKILL_ROLE_TAGS.find((known) => known.replace(/[^a-z]/g, '') === normalized)
    if (match) declared.add(match)
  }

  const haystack = [
    input.name,
    input.source,
    input.description,
    input.path,
    ...(input.dependencies || []),
    ...(input.requiredTools || []),
    ...(input.requiredCredentials || []),
  ].filter(Boolean).join(' ')

  for (const [tag, pattern] of TAG_PATTERNS) {
    if (pattern.test(haystack)) declared.add(tag)
  }

  if (declared.size === 0) declared.add('workflow')
  return Array.from(declared).sort((a, b) => a.localeCompare(b))
}
