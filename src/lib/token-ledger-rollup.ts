import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'

export const DEFAULT_CLAUDECLAW_TOKEN_DB_PATH = '/home/tony/claudeclaw/store/claudeclaw.db'
export const TOKEN_ROLLUP_SOURCE_MODE = 'read_only_rollup'

export interface TokenLedgerRecord {
  id: string
  model: string
  sessionId: string
  agentName: string
  timestamp: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  operation: string
  taskId?: number | null
  workspaceId?: number
  duration?: number
  source?: 'mission_control' | 'claudeclaw'
  sourceRunId?: string | null
  provider?: string
}

export interface SourceLedgerSummary {
  rows: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

export interface SourceLabeledTokenLedgerRollup {
  mission_control: SourceLedgerSummary
  claudeclaw: SourceLedgerSummary
  combined: SourceLedgerSummary
  source_mode: typeof TOKEN_ROLLUP_SOURCE_MODE
  double_count_guard: true
}

export interface ExpenseDetailModelGroup extends SourceLedgerSummary {
  provider: string
  model: string
  label: string
  unknown_provider: boolean
  unknown_model: boolean
}

export interface ExpenseDetailAgentGroup extends SourceLedgerSummary {
  agentName: string
}

export interface ExpenseDetailLedger {
  label: string
  summary: SourceLedgerSummary
  models: ExpenseDetailModelGroup[]
  agents: ExpenseDetailAgentGroup[]
}

export interface ExpenseDetailView {
  mission_control: ExpenseDetailLedger
  claudeclaw: ExpenseDetailLedger
  combined: ExpenseDetailLedger
  source_mode: typeof TOKEN_ROLLUP_SOURCE_MODE
  double_count_guard: true
  unknown_provider_model_rows: number
}

interface ClaudeClawTokenUsageRow {
  id: number
  chat_id: string
  session_id: string | null
  input_tokens: number
  output_tokens: number
  cost_usd: number
  created_at: number
  agent_id: string | null
  provider: string | null
  model: string | null
}

function finiteNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function roundCost(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function explicitString(value: unknown, fallback = 'unknown'): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

function summarize(records: TokenLedgerRecord[]): SourceLedgerSummary {
  return {
    rows: records.length,
    input_tokens: records.reduce((sum, record) => sum + finiteNumber(record.inputTokens), 0),
    output_tokens: records.reduce((sum, record) => sum + finiteNumber(record.outputTokens), 0),
    cost_usd: roundCost(records.reduce((sum, record) => sum + finiteNumber(record.cost), 0)),
  }
}

function groupByProviderModel(records: TokenLedgerRecord[]): ExpenseDetailModelGroup[] {
  const groups = new Map<string, TokenLedgerRecord[]>()
  for (const record of records) {
    const provider = record.provider || 'unknown'
    const model = record.model || 'unknown'
    const key = `${provider}\u0000${model}`
    const group = groups.get(key) || []
    group.push(record)
    groups.set(key, group)
  }

  return Array.from(groups.entries())
    .map(([key, group]) => {
      const [provider, model] = key.split('\u0000')
      const summary = summarize(group)
      const unknownProvider = provider === 'unknown'
      const unknownModel = model === 'unknown'
      const allClaudeClaw = group.every((record) => record.source === 'claudeclaw')
      const label = unknownProvider || unknownModel
        ? allClaudeClaw
          ? 'ClaudeClaw/Jarvis legacy unattributed'
          : 'Unknown provider/model'
        : `${provider}/${model}`
      return {
        provider,
        model,
        label,
        ...summary,
        unknown_provider: unknownProvider,
        unknown_model: unknownModel,
      }
    })
    .sort((a, b) => b.cost_usd - a.cost_usd || b.rows - a.rows || a.label.localeCompare(b.label))
}

function groupByAgent(records: TokenLedgerRecord[]): ExpenseDetailAgentGroup[] {
  const groups = new Map<string, TokenLedgerRecord[]>()
  for (const record of records) {
    const agentName = record.agentName || 'unknown'
    const group = groups.get(agentName) || []
    group.push(record)
    groups.set(agentName, group)
  }

  return Array.from(groups.entries())
    .map(([agentName, group]) => ({
      agentName,
      ...summarize(group),
    }))
    .sort((a, b) => b.cost_usd - a.cost_usd || b.rows - a.rows || a.agentName.localeCompare(b.agentName))
}

function buildExpenseLedger(label: string, records: TokenLedgerRecord[]): ExpenseDetailLedger {
  return {
    label,
    summary: summarize(records),
    models: groupByProviderModel(records),
    agents: groupByAgent(records),
  }
}

function sameExternalSourceRecord(missionControlRecord: TokenLedgerRecord, claudeClawRecord: TokenLedgerRecord): boolean {
  if (missionControlRecord.sourceRunId && missionControlRecord.sourceRunId === claudeClawRecord.sourceRunId) {
    return true
  }

  if (
    missionControlRecord.sessionId === claudeClawRecord.sessionId &&
    missionControlRecord.timestamp === claudeClawRecord.timestamp &&
    missionControlRecord.inputTokens === claudeClawRecord.inputTokens &&
    missionControlRecord.outputTokens === claudeClawRecord.outputTokens &&
    missionControlRecord.totalTokens === claudeClawRecord.totalTokens
  ) {
    return true
  }

  return false
}

export function combineReadOnlyTokenLedgerRecords(options: {
  missionControlRecords: TokenLedgerRecord[]
  claudeClawRecords: TokenLedgerRecord[]
}): TokenLedgerRecord[] {
  const missionControlRecords = options.missionControlRecords.map((record) => ({
    ...record,
    source: record.source ?? 'mission_control' as const,
  }))
  const claudeClawRecords = options.claudeClawRecords.filter((record) => {
    return !missionControlRecords.some((missionControlRecord) => sameExternalSourceRecord(missionControlRecord, record))
  })

  return [...missionControlRecords, ...claudeClawRecords]
}

export function buildReadOnlyTokenLedgerRollup(options: {
  missionControlRecords: TokenLedgerRecord[]
  claudeClawRecords: TokenLedgerRecord[]
}): SourceLabeledTokenLedgerRollup {
  const missionControlRecords = options.missionControlRecords.map((record) => ({
    ...record,
    source: record.source ?? 'mission_control' as const,
  }))
  const claudeClawRecords = options.claudeClawRecords.map((record) => ({
    ...record,
    source: 'claudeclaw' as const,
  }))
  const combinedRecords = combineReadOnlyTokenLedgerRecords({
    missionControlRecords,
    claudeClawRecords,
  })

  return {
    mission_control: summarize(missionControlRecords),
    claudeclaw: summarize(claudeClawRecords),
    combined: summarize(combinedRecords),
    source_mode: TOKEN_ROLLUP_SOURCE_MODE,
    double_count_guard: true,
  }
}

export function buildExpenseDetailView(options: {
  missionControlRecords: TokenLedgerRecord[]
  claudeClawRecords: TokenLedgerRecord[]
}): ExpenseDetailView {
  const missionControlRecords = options.missionControlRecords.map((record) => ({
    ...record,
    source: record.source ?? 'mission_control' as const,
  }))
  const claudeClawRecords = options.claudeClawRecords.map((record) => ({
    ...record,
    source: 'claudeclaw' as const,
  }))
  const combinedRecords = combineReadOnlyTokenLedgerRecords({
    missionControlRecords,
    claudeClawRecords,
  })

  return {
    mission_control: buildExpenseLedger('Mission Control ledger', missionControlRecords),
    claudeclaw: buildExpenseLedger('ClaudeClaw/Jarvis ledger', claudeClawRecords),
    combined: buildExpenseLedger('Combined observed spend', combinedRecords),
    source_mode: TOKEN_ROLLUP_SOURCE_MODE,
    double_count_guard: true,
    unknown_provider_model_rows: combinedRecords.filter((record) => {
      return (record.provider || 'unknown') === 'unknown' || (record.model || 'unknown') === 'unknown'
    }).length,
  }
}

export function loadClaudeClawTokenUsageRecords(options: {
  dbPath?: string
  workspaceId?: number
  limit?: number
} = {}): TokenLedgerRecord[] {
  const dbPath = options.dbPath ?? DEFAULT_CLAUDECLAW_TOKEN_DB_PATH
  const workspaceId = options.workspaceId ?? 1
  const limit = options.limit ?? 10000

  if (!existsSync(dbPath)) return []

  let db: Database.Database | null = null
  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true })
    const table = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'token_usage'
    `).get() as { name?: string } | undefined
    if (!table?.name) return []

    const columns = db.prepare('PRAGMA table_info(token_usage)').all() as Array<{ name: string }>
    const columnNames = new Set(columns.map((column) => column.name))
    const providerColumn = ['provider', 'provider_key', 'provider_path', 'source_provider']
      .find((column) => columnNames.has(column))
    const modelColumn = ['model', 'model_key', 'actual_model', 'source_model']
      .find((column) => columnNames.has(column))
    const providerExpr = providerColumn ? `${providerColumn} AS provider` : `'unknown' AS provider`
    const modelExpr = modelColumn ? `${modelColumn} AS model` : `'unknown' AS model`

    const rows = db.prepare(`
      SELECT
        id,
        chat_id,
        session_id,
        input_tokens,
        output_tokens,
        cost_usd,
        created_at,
        agent_id,
        ${providerExpr},
        ${modelExpr}
      FROM token_usage
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(limit) as ClaudeClawTokenUsageRow[]

    return rows.map((row) => {
      const inputTokens = finiteNumber(row.input_tokens)
      const outputTokens = finiteNumber(row.output_tokens)
      const sourceRunId = `claudeclaw:${row.id}`
      const agentName = `claudeclaw/${row.agent_id || 'unknown'}`
      const sessionId = row.session_id || row.chat_id || String(row.id)

      return {
        id: sourceRunId,
        source: 'claudeclaw',
        sourceRunId,
        provider: explicitString(row.provider),
        model: explicitString(row.model),
        sessionId: `claudeclaw:${sessionId}`,
        agentName,
        timestamp: finiteNumber(row.created_at) * 1000,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: finiteNumber(row.cost_usd),
        operation: 'claudeclaw_jarvis_read_only_rollup',
        taskId: null,
        workspaceId,
      }
    })
  } catch {
    return []
  } finally {
    db?.close()
  }
}
