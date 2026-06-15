import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { config } from '@/lib/config'

export type JarvisLegacyProofAdapterId =
  | 'mcp_readonly_status_probe'
  | 'paperclip_eco_task_dry_run'
  | 'paperclip_gateway_inventory'
  | 'n8n_workflow_list'
  | 'buildwiki_run_now'

type LegacyProofSpec = {
  adapter_id: JarvisLegacyProofAdapterId
  file: string
  required_markers: string[]
}

const LEGACY_PROOF_SPECS: LegacyProofSpec[] = [
  {
    adapter_id: 'mcp_readonly_status_probe',
    file: 'jarvis-full-execution-adapter-implementation-report.md',
    required_markers: ['mcp_readonly_status_probe', 'mcp.status_probe'],
  },
  {
    adapter_id: 'paperclip_eco_task_dry_run',
    file: 'jarvis-phase2-paperclip-eco-dry-run-adapter-report.md',
    required_markers: ['paperclip_eco_task_dry_run', 'paperclip.eco_task_dry_run'],
  },
  {
    adapter_id: 'paperclip_gateway_inventory',
    file: 'exact-scope-adapter-expansion-report.md',
    required_markers: ['paperclip_gateway_inventory', '/api/bridge/paperclip/gateway-inventory'],
  },
  {
    adapter_id: 'n8n_workflow_list',
    file: 'jarvis-phase3-n8n-workflow-list-adapter-report.md',
    required_markers: ['n8n_workflow_list', 'credential_required'],
  },
  {
    adapter_id: 'buildwiki_run_now',
    file: 'jarvis-buildwiki-dispatch-certification-report.md',
    required_markers: ['buildwiki_run_now', 'opencloud-docs-farmer.service'],
  },
]

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

export function defaultJarvisLegacyProofProjectRoots(dataDir = config.dataDir, cwd = process.cwd()) {
  const roots = [
    process.env.MISSION_CONTROL_ROOT || '',
    basename(dataDir) === '.data' ? dirname(dataDir) : dirname(resolve(dataDir, '..', '.data')),
    cwd,
    resolve(cwd, '../..'),
  ]
  return unique(roots.map((root) => resolve(root)))
}

export function readJarvisLegacyProofCounts(options: {
  projectRoots?: string[]
  readFile?: (path: string) => string
  exists?: (path: string) => boolean
} = {}) {
  const roots = options.projectRoots || defaultJarvisLegacyProofProjectRoots()
  const readFile = options.readFile || ((path: string) => readFileSync(path, 'utf8'))
  const exists = options.exists || existsSync
  const counts: Record<JarvisLegacyProofAdapterId, number> = {
    mcp_readonly_status_probe: 0,
    paperclip_eco_task_dry_run: 0,
    paperclip_gateway_inventory: 0,
    n8n_workflow_list: 0,
    buildwiki_run_now: 0,
  }

  for (const spec of LEGACY_PROOF_SPECS) {
    const proven = roots.some((root) => {
      const reportPath = join(root, 'runtime', spec.file)
      if (!exists(reportPath)) return false
      const body = readFile(reportPath).toLowerCase()
      return spec.required_markers.every((marker) => body.includes(marker.toLowerCase()))
    })
    counts[spec.adapter_id] = proven ? 1 : 0
  }

  return counts
}
