import type Database from 'better-sqlite3'
import { getDatabase } from '@/lib/db'
import { calculateTokenCost } from '@/lib/token-pricing'
import { findCanonicalGatewayTelemetryIdentity } from '@/lib/gateway-telemetry-identity'

type DbLike = Pick<Database.Database, 'prepare'>

export type GatewayTelemetryWriteResult = {
  tokenUsageId: number | null
  activityIds: number[]
  skippedReason: string | null
}

export type GatewayModelUsageInput = {
  db?: DbLike
  agentName?: string | null
  canonicalAgentId?: string | null
  runId?: string | null
  provider?: string | null
  model: string
  sessionId: string
  inputTokens: number
  outputTokens: number
  costUsd?: number | null
  status?: string | null
  taskId?: number | null
  workspaceId?: number | null
  occurredAt?: string | number | Date | null
}

export type GatewayToolActivityInput = {
  db?: DbLike
  agentName?: string | null
  canonicalAgentId?: string | null
  runId?: string | null
  stepId?: string | null
  canonicalNodeId?: string | null
  canonicalEdgeId: string
  toolId?: string | null
  sourceSystem?: string | null
  actionType?: string | null
  requestCount?: number | null
  status?: string | null
  workspaceId?: number | null
  occurredAt?: string | number | Date | null
}

const MODEL_EDGE_MAP: Array<[RegExp, string]> = [
  [/\bopenrouter\b/i, 'model.openrouter_to_gateway'],
  [/\b(openai|codex|chatgpt|gpt[-_. ]?[45]|o3|o4[-_. ]?mini)\b/i, 'model.openai_codex_to_gateway'],
  [/\b(claude|anthropic)\b/i, 'model.claude_to_gateway'],
  [/\b(ollama|local[-_. ]?llama)\b/i, 'model.ollama_to_gateway'],
  [/\b(nvidia|nvidia[-_. ]?nim|\bnim\b)\b/i, 'model.nvidia_to_gateway'],
  [/\b(gemini|google)\b/i, 'model.gemini_to_gateway'],
  [/\bgroq\b/i, 'model.groq_to_gateway'],
  [/\b(xai|grok)\b/i, 'model.xai_grok_to_gateway'],
]

function dbFor(input?: DbLike): DbLike {
  return input || getDatabase()
}

function cleanText(value: unknown, fallback = 'unknown'): string {
  return String(value || fallback)
    .replace(/[^\w.@:/ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160) || fallback
}

function cleanId(value: unknown, fallback = 'unknown'): string {
  return String(value || fallback)
    .replace(/[^\w.:-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120) || fallback
}

function workspaceId(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}

function positiveInt(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
}

function taskId(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
}

function epochSeconds(value: unknown): number {
  if (value instanceof Date && Number.isFinite(value.getTime())) return Math.floor(value.getTime() / 1000)
  if (typeof value === 'number' && Number.isFinite(value)) return value > 2_000_000_000 ? Math.floor(value / 1000) : Math.floor(value)
  if (typeof value === 'string' && value.trim()) {
    if (/^\d+$/.test(value.trim())) return epochSeconds(Number(value.trim()))
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000)
  }
  return Math.floor(Date.now() / 1000)
}

function modelEdge(provider: unknown, model: unknown): string | null {
  const haystack = `${provider || ''} ${model || ''}`
  for (const [pattern, edgeId] of MODEL_EDGE_MAP) {
    if (pattern.test(haystack)) return edgeId
  }
  return null
}

function agentIdentity(candidates: unknown[]) {
  const identity = findCanonicalGatewayTelemetryIdentity(candidates)
  if (!identity || identity.owner_operator || !identity.canonical_edge_id) return null
  return identity
}

function insertActivity(db: DbLike, input: {
  type: string
  actor: string
  description: string
  data: Record<string, unknown>
  workspaceId: number
  createdAt: number
}): number {
  const result = db.prepare(`
    INSERT INTO activities (type, entity_type, entity_id, actor, description, data, created_at, workspace_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.type,
    'gateway_telemetry',
    0,
    cleanId(input.actor),
    cleanText(input.description),
    JSON.stringify(input.data),
    input.createdAt,
    input.workspaceId,
  )
  return Number(result.lastInsertRowid)
}

export function recordGatewayModelUsage(input: GatewayModelUsageInput): GatewayTelemetryWriteResult {
  const db = dbFor(input.db)
  const createdAt = epochSeconds(input.occurredAt)
  const inputTokens = positiveInt(input.inputTokens)
  const outputTokens = positiveInt(input.outputTokens)
  const totalTokens = inputTokens + outputTokens
  const provider = cleanId(input.provider || '').replace(/^unknown$/, '')
  const model = cleanText(input.model, 'unknown')
  const modelName = provider ? `${provider}/${model}` : model
  const modelEdgeId = modelEdge(provider, model)
  const agent = agentIdentity([input.canonicalAgentId, input.agentName])
  const actor = agent?.canonical_agent_id || cleanId(input.agentName || 'gateway.dispatcher')
  const ids: number[] = []
  let tokenUsageId: number | null = null
  const resolvedWorkspaceId = workspaceId(input.workspaceId)

  if (totalTokens > 0 && model && input.sessionId) {
    const cost = Number.isFinite(Number(input.costUsd))
      ? Math.max(0, Number(input.costUsd))
      : calculateTokenCost(modelName, inputTokens, outputTokens)
    const result = db.prepare(`
      INSERT INTO token_usage (model, session_id, input_tokens, output_tokens, created_at, workspace_id, task_id, cost_usd, agent_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      modelName,
      cleanText(input.sessionId, `${actor}:model`),
      inputTokens,
      outputTokens,
      createdAt,
      resolvedWorkspaceId,
      taskId(input.taskId),
      cost,
      actor,
    )
    tokenUsageId = Number(result.lastInsertRowid)
  }

  if (modelEdgeId) {
    ids.push(insertActivity(db, {
      type: 'gateway_model_usage',
      actor,
      description: `${modelName} model request completed`,
      workspaceId: resolvedWorkspaceId,
      createdAt,
      data: {
        event_type: 'gateway_model_usage',
        source_system: 'model_runner',
        canonical_agent_id: agent?.canonical_agent_id || null,
        canonical_node_id: modelEdgeId.replace(/_to_gateway$/, '').replace(/^model\./, 'model.'),
        canonical_edge_id: modelEdgeId,
        provider: provider || null,
        model,
        run_id: input.runId ? cleanText(input.runId) : null,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: tokenUsageId === null ? null : Number(input.costUsd ?? calculateTokenCost(modelName, inputTokens, outputTokens)),
        request_count: 1,
        status: input.status ? cleanId(input.status) : 'success',
      },
    }))
  }

  if (agent?.canonical_edge_id) {
    ids.push(insertActivity(db, {
      type: 'gateway_agent_activity',
      actor: agent.canonical_agent_id,
      description: `${agent.canonical_agent_id} Gateway model activity`,
      workspaceId: resolvedWorkspaceId,
      createdAt,
      data: {
        event_type: 'gateway_agent_activity',
        source_system: 'agent_runtime',
        canonical_agent_id: agent.canonical_agent_id,
        canonical_node_id: agent.canonical_node_id,
        canonical_edge_id: agent.canonical_edge_id,
        model,
        provider: provider || null,
        run_id: input.runId ? cleanText(input.runId) : null,
        request_count: 1,
        status: input.status ? cleanId(input.status) : 'success',
      },
    }))
  }

  return {
    tokenUsageId,
    activityIds: ids,
    skippedReason: ids.length || tokenUsageId !== null ? null : 'canonical_edge_mapping_missing',
  }
}

export function recordGatewayToolActivity(input: GatewayToolActivityInput): GatewayTelemetryWriteResult {
  const db = dbFor(input.db)
  const createdAt = epochSeconds(input.occurredAt)
  const agent = agentIdentity([input.canonicalAgentId, input.agentName])
  const actor = agent?.canonical_agent_id || cleanId(input.agentName || 'gateway.dispatcher')
  const resolvedWorkspaceId = workspaceId(input.workspaceId)
  const ids: number[] = []

  if (!input.canonicalEdgeId) {
    return { tokenUsageId: null, activityIds: [], skippedReason: 'canonical_edge_mapping_missing' }
  }

  ids.push(insertActivity(db, {
    type: 'gateway_tool_activity',
    actor,
    description: `${cleanText(input.sourceSystem || 'tool')} ${cleanText(input.toolId || 'activity')} completed`,
    workspaceId: resolvedWorkspaceId,
    createdAt,
    data: {
      event_type: 'gateway_tool_activity',
      source_system: cleanId(input.sourceSystem || 'tool_runtime'),
      canonical_agent_id: agent?.canonical_agent_id || null,
      canonical_node_id: input.canonicalNodeId || null,
      canonical_edge_id: cleanId(input.canonicalEdgeId),
      tool_id: input.toolId ? cleanText(input.toolId) : null,
      run_id: input.runId ? cleanText(input.runId) : null,
      step_id: input.stepId ? cleanText(input.stepId) : null,
      action_type: input.actionType ? cleanId(input.actionType) : null,
      request_count: positiveInt(input.requestCount || 1) || 1,
      status: input.status ? cleanId(input.status) : null,
    },
  }))

  if (agent?.canonical_edge_id) {
    ids.push(insertActivity(db, {
      type: 'gateway_agent_activity',
      actor: agent.canonical_agent_id,
      description: `${agent.canonical_agent_id} Gateway tool activity`,
      workspaceId: resolvedWorkspaceId,
      createdAt,
      data: {
        event_type: 'gateway_agent_activity',
        source_system: 'agent_runtime',
        canonical_agent_id: agent.canonical_agent_id,
        canonical_node_id: agent.canonical_node_id,
        canonical_edge_id: agent.canonical_edge_id,
        tool_id: input.toolId ? cleanText(input.toolId) : null,
        run_id: input.runId ? cleanText(input.runId) : null,
        step_id: input.stepId ? cleanText(input.stepId) : null,
        action_type: input.actionType ? cleanId(input.actionType) : null,
        request_count: positiveInt(input.requestCount || 1) || 1,
        status: input.status ? cleanId(input.status) : null,
      },
    }))
  }

  return {
    tokenUsageId: null,
    activityIds: ids,
    skippedReason: ids.length ? null : 'canonical_edge_mapping_missing',
  }
}
