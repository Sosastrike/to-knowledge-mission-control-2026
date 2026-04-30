// @ts-nocheck
// Phase-1 design artifact. Types to be refined in Phase 2 UI integration.
// Tracked in: /home/tony/.openclaw/docs/mc-agent0-absorption-plan.md
/**
 * Agent Advanced Configuration Schema (Phase 1 of Agent-0 → MC absorption)
 *
 * Path (post-deploy): /home/tony/mission-control/src/lib/agent-advanced-config.ts
 *
 * Purpose: Zod schema for the `advanced_v1` key inside each agent's `config` JSON.
 * Design: additive, backward-compatible, zero changes to existing MC behavior.
 *
 * Storage: nested under `config.advanced_v1` in the existing `agents.config` TEXT column.
 * Reads: GET /api/agents/[id]/advanced-config
 * Writes: PUT /api/agents/[id]/advanced-config
 *
 * See /home/tony/.openclaw/docs/mc-agent0-absorption-plan.md for the full plan.
 *
 * Version: v1 (2026-04-23)
 */

import { z } from 'zod'

// ────────────────────────────────────────────────────────────
// Reusable sub-schemas
// ────────────────────────────────────────────────────────────

export const ModelSlot = z.object({
  provider: z.enum([
    'anthropic',
    'openai',
    'google',
    'openrouter',
    'ollama',
    'huggingface',
    'mistral',
    'deepseek',
    'groq',
    'custom',
  ]),
  name: z.string().min(1).max(200),
  api_base: z.string().optional(),
  ctx_length: z.number().int().positive().optional(),
  ctx_history_pct: z.number().min(0).max(1).optional(),
  rate_limit_rpm: z.number().int().nonnegative().optional(),
  max_tokens_per_call: z.number().int().positive().optional(),
  kwargs: z.record(z.any()).optional(),
})

export const CredentialRef = z.object({
  // Bitwarden item reference — never store the raw credential inline
  bitwarden_item_id: z.string().optional(),
  // Or ENV var fallback (will be resolved at runtime, not stored here)
  env_var_name: z.string().optional(),
}).refine(
  (v) => !!(v.bitwarden_item_id || v.env_var_name),
  'Must provide either bitwarden_item_id or env_var_name'
)

// ────────────────────────────────────────────────────────────
// Category schemas
// ────────────────────────────────────────────────────────────

export const ModelsConfig = z.object({
  chat: ModelSlot.optional(),
  utility: ModelSlot.optional(),
  embedding: ModelSlot.optional(),
})

export const ToolsConfig = z.object({
  shell: z.enum(['off', 'sandbox', 'approval-required']).default('off'),
  browser: z.enum(['off', 'readonly', 'full']).default('off'),
  files: z.object({
    read: z.boolean().default(true),
    write_in_workdir: z.boolean().default(false),
    delete: z.enum(['never', 'approval-required']).default('never'),
    workdir_path: z.string().optional(),
  }).default({
    read: true,
    write_in_workdir: false,
    delete: 'never',
  }),
})

export const MemoryConfig = z.object({
  enabled: z.boolean().default(true),
  embedding_model_ref: z.string().optional(), // points to ModelSlot name
  importance_decay_hours: z.number().positive().optional(),
  knowledge_imports: z.array(z.string()).optional(), // paths to markdown/yaml imports
})

export const CommunicationsConfig = z.object({
  telegram: z.object({
    enabled: z.boolean().default(false),
    token_ref: CredentialRef.optional(),
    allowed_user_ids: z.array(z.string()).optional(),
  }).optional(),
  discord: z.object({
    enabled: z.boolean().default(false),
    token_ref: CredentialRef.optional(),
    allowed_channel_ids: z.array(z.string()).optional(),
  }).optional(),
  email: z.object({
    enabled: z.boolean().default(false),
    agentmail_ref: CredentialRef.optional(),
    allowlist_path: z.string().optional(),
  }).optional(),
  whatsapp: z.object({
    enabled: z.boolean().default(false),
    token_ref: CredentialRef.optional(),
  }).optional(),
})

export const SafetyConfig = z.object({
  approval_required_for: z.array(z.enum([
    'shell-exec',
    'file-delete',
    'file-write-outside-workdir',
    'external-api-paid',
    'send-email',
    'send-telegram',
    'send-discord',
    'browser-interactive',
    'plugin-install',
    'role-promotion',
    'cross-agent-memory-read',
  ])).default(['shell-exec', 'file-delete', 'file-write-outside-workdir', 'plugin-install']),
  rate_limit_per_hour: z.number().int().positive().optional(),
  max_tokens_per_task: z.number().int().positive().optional(),
  daily_cost_budget_usd: z.number().positive().optional(),
  destructive_action_log_required: z.boolean().default(true),
})

export const RuntimeConfig = z.object({
  ctx_length: z.number().int().positive().optional(),
  compaction_trigger_pct: z.number().min(0).max(1).optional(),
  autonomy_level: z.enum([
    'read-only',
    'suggest',
    'execute-with-approval',
    'execute-autonomously',
  ]).default('suggest'),
  retry_policy: z.object({
    max_retries: z.number().int().nonnegative().default(2),
    backoff_seconds: z.number().nonnegative().default(5),
  }).optional(),
})

// ────────────────────────────────────────────────────────────
// Top-level schema
// ────────────────────────────────────────────────────────────

export const AgentAdvancedConfigV1 = z.object({
  version: z.literal(1).default(1),
  last_updated: z.string().optional(), // ISO timestamp, server-maintained
  last_editor: z.string().optional(), // user email, server-maintained

  models: ModelsConfig.optional(),
  tools: ToolsConfig.optional(),
  memory: MemoryConfig.optional(),
  communications: CommunicationsConfig.optional(),
  safety: SafetyConfig.optional(),
  runtime: RuntimeConfig.optional(),

  // Escape hatch — raw notes / custom fields not yet in schema
  notes: z.string().max(4000).optional(),
  custom: z.record(z.any()).optional(),
})

export type AgentAdvancedConfig = z.infer<typeof AgentAdvancedConfigV1>

// ────────────────────────────────────────────────────────────
// Authority / RBAC helpers
// ────────────────────────────────────────────────────────────

/**
 * Fields that require owner role (not just admin) to modify.
 * Admin can view but not change these.
 */
export const OWNER_ONLY_FIELDS = [
  'tools.shell',
  'tools.browser',
  'tools.files.write_in_workdir',
  'tools.files.delete',
  'safety.approval_required_for',
  'safety.daily_cost_budget_usd',
  'runtime.autonomy_level',
  'communications.telegram.token_ref',
  'communications.discord.token_ref',
  'communications.email.agentmail_ref',
  'communications.whatsapp.token_ref',
] as const

/**
 * Default safety posture for a newly-created agent.
 * Used when an agent has no advanced_v1 key yet.
 */
export const SAFE_DEFAULT_ADVANCED_CONFIG: AgentAdvancedConfig = {
  version: 1,
  tools: {
    shell: 'off',
    browser: 'off',
    files: {
      read: true,
      write_in_workdir: false,
      delete: 'never',
    },
  },
  memory: {
    enabled: true,
  },
  communications: {},
  safety: {
    approval_required_for: [
      'shell-exec',
      'file-delete',
      'file-write-outside-workdir',
      'external-api-paid',
      'send-email',
      'plugin-install',
    ],
    destructive_action_log_required: true,
  },
  runtime: {
    autonomy_level: 'suggest',
    retry_policy: {
      max_retries: 2,
      backoff_seconds: 5,
    },
  },
}

/**
 * Extract the advanced_v1 key from an agent's config JSON.
 * Returns SAFE_DEFAULT_ADVANCED_CONFIG if missing.
 */
export function extractAdvancedConfig(configJson: string | object | null | undefined): AgentAdvancedConfig {
  if (!configJson) return SAFE_DEFAULT_ADVANCED_CONFIG
  const obj = typeof configJson === 'string' ? JSON.parse(configJson) : configJson
  const raw = (obj as any)?.advanced_v1
  if (!raw) return SAFE_DEFAULT_ADVANCED_CONFIG
  const parsed = AgentAdvancedConfigV1.safeParse(raw)
  if (!parsed.success) {
    // Invalid schema — return safe defaults instead of crashing
    return SAFE_DEFAULT_ADVANCED_CONFIG
  }
  return parsed.data
}

/**
 * Merge advanced_v1 into an existing config JSON without touching other keys.
 * Used by the PUT route.
 */
export function mergeAdvancedConfig(
  existingConfigJson: string | object | null | undefined,
  newAdvanced: AgentAdvancedConfig,
  editor: string,
): object {
  const base: any = existingConfigJson
    ? (typeof existingConfigJson === 'string' ? JSON.parse(existingConfigJson) : existingConfigJson)
    : {}
  const withMeta = {
    ...newAdvanced,
    last_updated: new Date().toISOString(),
    last_editor: editor,
  }
  return { ...base, advanced_v1: withMeta }
}
