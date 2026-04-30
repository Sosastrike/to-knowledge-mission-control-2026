#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']
const root = process.cwd()
const openapiPath = path.join(root, 'openapi.json')
const ignorePath = path.join(root, 'scripts/api-contract-parity.ignore')

function toPosix(input) {
  return input.split(path.sep).join('/')
}

function normalizeSegment(segment) {
  if (segment.startsWith('[[...') && segment.endsWith(']]')) return `{${segment.slice(5, -2)}}`
  if (segment.startsWith('[...') && segment.endsWith(']')) return `{${segment.slice(4, -1)}}`
  if (segment.startsWith('[') && segment.endsWith(']')) return `{${segment.slice(1, -1)}}`
  return segment
}

function routeFileToApiPath(projectRoot, fullPath) {
  const rel = toPosix(path.relative(projectRoot, fullPath))
  const withoutRoute = rel.replace(/\/route\.tsx?$/, '')
  const trimmed = withoutRoute.startsWith('src/app/api') ? withoutRoute.slice('src/app/api'.length) : withoutRoute
  const parts = trimmed.split('/').filter(Boolean).map(normalizeSegment)
  return `/api${parts.length ? `/${parts.join('/')}` : ''}`
}

function extractHttpMethods(source) {
  const methods = []
  for (const method of HTTP_METHODS) {
    const constExport = new RegExp(`export\\s+const\\s+${method}\\s*=`, 'm')
    const fnExport = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`, 'm')
    if (constExport.test(source) || fnExport.test(source)) methods.push(method)
  }
  return methods
}

function walkRouteFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkRouteFiles(full, out)
    else if (entry.isFile() && /route\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

function normalizeOperation(operation) {
  const [method = '', ...pathParts] = String(operation || '').trim().split(' ')
  const normalizedMethod = method.toUpperCase()
  const normalizedPath = pathParts.join(' ').trim()
  return `${normalizedMethod} ${normalizedPath}`
}

function readIgnoredOperations() {
  if (!fs.existsSync(ignorePath)) return new Set()
  return new Set(fs
    .readFileSync(ignorePath, 'utf8')
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => x && !x.startsWith('#'))
    .map((x) => normalizeOperation(x)))
}

function tagFor(apiPath) {
  if (apiPath.startsWith('/api/bridge')) return 'Bridge'
  if (apiPath.startsWith('/api/auth')) return 'Auth'
  if (apiPath.startsWith('/api/agent-zero') || apiPath.startsWith('/api/agents')) return 'Agents'
  if (apiPath.startsWith('/api/firecrawl') || apiPath.startsWith('/api/zapier') || apiPath.startsWith('/api/n8n') || apiPath.startsWith('/api/mcp')) return 'Integrations'
  if (apiPath.startsWith('/api/skills')) return 'Skills'
  if (apiPath.startsWith('/api/viral-crawl')) return 'Viral Crawl'
  return 'System'
}

function operationId(method, apiPath) {
  return `${method.toLowerCase()}${apiPath
    .replace(/^\/api\//, '-')
    .replace(/[{}]/g, '')
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase())}`
}

function operationBlock(method, apiPath, indent = '      ') {
  const lower = method.toLowerCase()
  const responses = [
    '"200": { "description": "OK" }',
    '"401": { "$ref": "#/components/responses/Unauthorized" }',
    '"403": { "$ref": "#/components/responses/Forbidden" }',
  ]
  if (['post', 'put', 'patch', 'delete'].includes(lower)) {
    responses.push('"423": { "description": "Locked until owner approval/audit gate is satisfied" }')
  }
  if (['/api/firecrawl/{path}', '/api/zapier/{path}', '/api/n8n/{path}'].includes(apiPath)) {
    responses.push('"503": { "description": "Required connector credential or backend is not configured" }')
  }

  return [
    `${indent}"${lower}": {`,
    `${indent}  "tags": ["${tagFor(apiPath)}"],`,
    `${indent}  "summary": "${method} ${apiPath}",`,
    `${indent}  "description": "Documented for route/OpenAPI parity. Current production posture is read-only or owner-approval-gated unless a route-specific contract states otherwise.",`,
    `${indent}  "operationId": "${operationId(method, apiPath)}",`,
    `${indent}  "responses": { ${responses.join(', ')} }`,
    `${indent}}`,
  ].join('\n')
}

if (!fs.existsSync(openapiPath)) {
  console.error(JSON.stringify({ ok: false, error: 'openapi_not_found', path: openapiPath }, null, 2))
  process.exit(1)
}

const openapi = JSON.parse(fs.readFileSync(openapiPath, 'utf8'))
const ignored = readIgnoredOperations()
const openapiOps = new Set()
for (const [apiPath, pathItem] of Object.entries(openapi.paths || {})) {
  for (const method of Object.keys(pathItem || {})) {
    const upper = method.toUpperCase()
    if (HTTP_METHODS.includes(upper)) openapiOps.add(`${upper} ${apiPath}`)
  }
}

const missingByPath = new Map()
for (const file of walkRouteFiles(path.join(root, 'src/app/api'))) {
  const apiPath = routeFileToApiPath(root, file)
  const source = fs.readFileSync(file, 'utf8')
  for (const method of extractHttpMethods(source)) {
    const op = `${method} ${apiPath}`
    if (openapiOps.has(op) || ignored.has(op)) continue
    if (!missingByPath.has(apiPath)) missingByPath.set(apiPath, [])
    missingByPath.get(apiPath).push(method)
  }
}

if (missingByPath.size === 0) {
  console.log(JSON.stringify({ ok: true, inserted_operations: 0 }, null, 2))
  process.exit(0)
}

const pathBlocks = Array.from(missingByPath.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([apiPath, methods]) => `    "${apiPath}": {\n${methods.sort().map((method) => operationBlock(method, apiPath)).join(',\n')}\n    }`)
  .join(',\n')

const originalText = fs.readFileSync(openapiPath, 'utf8')
const marker = '\n    }\n  },\n  "components": {'
if (!originalText.includes(marker)) {
  console.error(JSON.stringify({ ok: false, error: 'paths_closing_marker_not_found' }, null, 2))
  process.exit(1)
}

const updatedText = originalText.replace(marker, `\n    },\n${pathBlocks}\n  },\n  "components": {`)
fs.writeFileSync(openapiPath, updatedText)

const insertedOperations = Array.from(missingByPath.values()).reduce((total, methods) => total + methods.length, 0)
console.log(JSON.stringify({
  ok: true,
  inserted_operations: insertedOperations,
  inserted_paths: missingByPath.size,
}, null, 2))
