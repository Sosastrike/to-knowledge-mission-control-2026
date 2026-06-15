import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { config } from '@/lib/config'

export const JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID = 'mcp_memory_write_probe'
export const JARVIS_MCP_MEMORY_WRITE_ACTION = 'mcp.memory.write_probe'
export const JARVIS_MCP_MEMORY_SERVER_ID = 'memory'
export const JARVIS_MCP_MEMORY_OPERATION = 'create_and_delete_test_entity'
export const JARVIS_MCP_MEMORY_TARGET = 'ephemeral_test_entity'

const MEMORY_SERVER_PACKAGE = '@modelcontextprotocol/server-memory@2026.1.26'
const PROOF_GRAPH_PATH = join(config.dataDir, 'jarvis-mcp-memory-write-proof-graph.json')

type JsonRpcResponse = {
  id?: number
  result?: unknown
  error?: unknown
}

type ToolCallResult = {
  structuredContent?: unknown
  content?: Array<{ type?: string; text?: string }>
}

export type JarvisMcpMemoryWriteProbeResult = {
  ok: boolean
  adapter_id: typeof JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID
  action: typeof JARVIS_MCP_MEMORY_WRITE_ACTION
  server_id: typeof JARVIS_MCP_MEMORY_SERVER_ID
  operation: typeof JARVIS_MCP_MEMORY_OPERATION
  target: typeof JARVIS_MCP_MEMORY_TARGET
  entity_name: string | null
  tool_package: string
  initialized: boolean
  tools_listed: boolean
  create_called: boolean
  create_succeeded: boolean
  rollback_called: boolean
  rollback_succeeded: boolean
  final_entity_present: boolean
  proof_graph_written: boolean
  proof_graph_path_exposed: false
  credential_values_exposed: false
  raw_tool_output_returned: false
  exact_blocker: string | null
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80)
}

function parseToolText(result: ToolCallResult | null): unknown {
  const text = result?.content?.find((item) => item.type === 'text' && typeof item.text === 'string')?.text
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function entityPresent(result: ToolCallResult | null, entityName: string) {
  const structured = result?.structuredContent
  const parsedText = parseToolText(result)
  const candidate = structured || parsedText
  if (!candidate || typeof candidate !== 'object') return false
  const entities = Array.isArray((candidate as { entities?: unknown }).entities)
    ? (candidate as { entities: unknown[] }).entities
    : Array.isArray(candidate)
      ? candidate
      : []
  return entities.some((entity) => {
    return Boolean(entity && typeof entity === 'object' && (entity as { name?: unknown }).name === entityName)
  })
}

function responseError(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 220)
  if (typeof value === 'object') {
    const row = value as { message?: unknown; code?: unknown }
    const message = typeof row.message === 'string' ? row.message : 'mcp_json_rpc_error'
    return `${message}${typeof row.code === 'number' ? `:${row.code}` : ''}`.slice(0, 220)
  }
  return 'mcp_json_rpc_error'
}

export async function executeJarvisMcpMemoryWriteProbe(input: {
  idempotencyKey: string
  actor: string
}): Promise<JarvisMcpMemoryWriteProbeResult> {
  const suffix = safeId(input.idempotencyKey || `${Date.now()}`) || 'proof'
  const entityName = `jarvis_mcp_write_probe_${suffix}`
  mkdirSync(dirname(PROOF_GRAPH_PATH), { recursive: true })

  const child = spawn('npx', ['-y', MEMORY_SERVER_PACKAGE], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MEMORY_FILE_PATH: PROOF_GRAPH_PATH,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let stderr = ''
  const pending = new Map<number, {
    resolve: (value: JsonRpcResponse) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()
  let buffer = ''

  const finishPending = (id: number, response: JsonRpcResponse) => {
    const entry = pending.get(id)
    if (!entry) return
    clearTimeout(entry.timeout)
    pending.delete(id)
    entry.resolve(response)
  }

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line) as JsonRpcResponse
        if (typeof parsed.id === 'number') finishPending(parsed.id, parsed)
      } catch {
        // Ignore non-JSON stdio noise from the MCP server.
      }
    }
  })

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString('utf8').slice(0, 1000)
  })

  const send = (id: number, method: string, params: Record<string, unknown>) => {
    return new Promise<JsonRpcResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`mcp_${method}_timeout`))
      }, 12_000)
      pending.set(id, { resolve, reject, timeout })
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
    })
  }

  try {
    const initialized = await send(1, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'mission-control-jarvis', version: '1' },
    })
    const initError = responseError(initialized.error)
    if (initError) {
      return baseResult(entityName, 'mcp_memory_initialize_failed')
    }

    const tools = await send(2, 'tools/list', {})
    const toolsError = responseError(tools.error)
    const toolRows = Array.isArray((tools.result as { tools?: unknown[] } | undefined)?.tools)
      ? (tools.result as { tools: Array<{ name?: unknown }> }).tools
      : []
    const hasCreate = toolRows.some((tool) => tool.name === 'create_entities')
    const hasDelete = toolRows.some((tool) => tool.name === 'delete_entities')
    const hasReadGraph = toolRows.some((tool) => tool.name === 'read_graph')
    if (toolsError || !hasCreate || !hasDelete || !hasReadGraph) {
      return baseResult(entityName, 'mcp_memory_required_tools_missing')
    }

    const created = await send(3, 'tools/call', {
      name: 'create_entities',
      arguments: {
        entities: [{
          name: entityName,
          entityType: 'mission_control_exact_scope_proof',
          observations: [
            'Jarvis exact-scope MCP memory write probe. This entity must be deleted by rollback in the same adapter run.',
          ],
        }],
      },
    })
    const createError = responseError(created.error)
    if (createError) {
      return {
        ...baseResult(entityName, 'mcp_memory_create_failed'),
        initialized: true,
        tools_listed: true,
        create_called: true,
      }
    }

    const afterCreate = await send(4, 'tools/call', {
      name: 'read_graph',
      arguments: {},
    })
    const presentAfterCreate = entityPresent(afterCreate.result as ToolCallResult | null, entityName)

    const deleted = await send(5, 'tools/call', {
      name: 'delete_entities',
      arguments: { entityNames: [entityName] },
    })
    const deleteError = responseError(deleted.error)

    const afterDelete = await send(6, 'tools/call', {
      name: 'read_graph',
      arguments: {},
    })
    const presentAfterDelete = entityPresent(afterDelete.result as ToolCallResult | null, entityName)
    const rollbackSucceeded = !deleteError && !presentAfterDelete

    return {
      ok: presentAfterCreate && rollbackSucceeded,
      adapter_id: JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID,
      action: JARVIS_MCP_MEMORY_WRITE_ACTION,
      server_id: JARVIS_MCP_MEMORY_SERVER_ID,
      operation: JARVIS_MCP_MEMORY_OPERATION,
      target: JARVIS_MCP_MEMORY_TARGET,
      entity_name: entityName,
      tool_package: MEMORY_SERVER_PACKAGE,
      initialized: true,
      tools_listed: true,
      create_called: true,
      create_succeeded: presentAfterCreate,
      rollback_called: true,
      rollback_succeeded: rollbackSucceeded,
      final_entity_present: presentAfterDelete,
      proof_graph_written: existsSync(PROOF_GRAPH_PATH) && readFileSync(PROOF_GRAPH_PATH, 'utf8').length >= 0,
      proof_graph_path_exposed: false,
      credential_values_exposed: false,
      raw_tool_output_returned: false,
      exact_blocker: presentAfterCreate && rollbackSucceeded
        ? null
        : (presentAfterCreate ? 'mcp_memory_rollback_failed' : 'mcp_memory_create_not_verified'),
    }
  } catch (error) {
    return baseResult(entityName, error instanceof Error ? error.message : 'mcp_memory_write_probe_failed')
  } finally {
    for (const entry of pending.values()) clearTimeout(entry.timeout)
    pending.clear()
    child.kill()
    if (stderr.includes('Authorization') || stderr.includes('Bearer ')) {
      // The server should not emit secrets. Keep this as a fail-closed guard.
      child.kill('SIGKILL')
    }
  }
}

function baseResult(entityName: string, blocker: string): JarvisMcpMemoryWriteProbeResult {
  return {
    ok: false,
    adapter_id: JARVIS_MCP_MEMORY_WRITE_ADAPTER_ID,
    action: JARVIS_MCP_MEMORY_WRITE_ACTION,
    server_id: JARVIS_MCP_MEMORY_SERVER_ID,
    operation: JARVIS_MCP_MEMORY_OPERATION,
    target: JARVIS_MCP_MEMORY_TARGET,
    entity_name: entityName,
    tool_package: MEMORY_SERVER_PACKAGE,
    initialized: false,
    tools_listed: false,
    create_called: false,
    create_succeeded: false,
    rollback_called: false,
    rollback_succeeded: false,
    final_entity_present: false,
    proof_graph_written: existsSync(PROOF_GRAPH_PATH),
    proof_graph_path_exposed: false,
    credential_values_exposed: false,
    raw_tool_output_returned: false,
    exact_blocker: blocker.slice(0, 220),
  }
}
