import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { config, ensureDirExists } from './config'

export type AgentZeroReportDeliveryProvider = 'mission_control' | 'telegram' | 'onedrive' | 'google_drive'

export type AgentZeroReportSection = {
  heading: string
  body: string | string[]
}

export type AgentZeroReportRequestedDelivery = {
  provider: AgentZeroReportDeliveryProvider
  folder?: string | null
  requested_by_owner?: boolean
}

export type AgentZeroReportDeliveryChannel = {
  provider: AgentZeroReportDeliveryProvider
  requested: boolean
  status: 'available' | 'created' | 'blocked'
  url: string | null
  reason: string | null
  requires_bridge_session: boolean
  external_write: boolean
}

export type AgentZeroReportManifest = {
  id: string
  title: string
  summary: string
  created_at: string
  created_by: 'agent_zero'
  source: 'api' | 'test_chat'
  mission_control_url: string
  markdown_url: string
  pdf_url: string
  markdown_filename: string
  pdf_filename: string
  delivery_channels: AgentZeroReportDeliveryChannel[]
  normal_reply: string
  safety: {
    raw_local_paths_exposed: boolean
    task_ids_in_normal_reply: boolean
    protected_actions_executed: boolean
    external_writes_executed: boolean
    telegram_attachment_sent: boolean
  }
}

export type AgentZeroReportCreationResult = {
  report: AgentZeroReportManifest
  attachments: Array<{ type: 'pdf' | 'markdown'; label: string; url: string }>
  internal: {
    report_dir: string
    markdown_path: string
    pdf_path: string
    manifest_path: string
  }
}

const REPORT_ID_PATTERN = /^azr_[a-z0-9]+_[a-f0-9]{12}$/

function reportRoot(root?: string): string {
  return root || process.env.AGENT_ZERO_REPORT_ROOT || path.join(config.dataDir, 'agent-zero-reports')
}

function safeId(): string {
  return `azr_${Date.now().toString(36)}_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return slug || 'agent-zero-report'
}

export function isAgentZeroReportId(value: string): boolean {
  return REPORT_ID_PATTERN.test(value)
}

export function redactUnsafeOwnerText(value: string): string {
  return value
    .replace(/(?:\/home\/tony|\/tmp|\/var\/folders)[^\s`'"\])}]*/g, '<server-local-path>')
    .replace(/\bruntime\/executive-reports\/[^\s`'"\])}]*/g, '<internal-report-path>')
    .replace(/\bFailed stage\b/gi, 'A report step could not complete')
    .replace(/\s+$/g, '')
}

export function containsUnsafeOwnerText(value: string): boolean {
  return /\/home\/tony|\/tmp\/|\/var\/folders|runtime\/executive-reports|\bFailed stage\b/i.test(value)
}

function bounded(value: unknown, fallback: string, max = 4000): string {
  const text = typeof value === 'string' ? value : fallback
  return redactUnsafeOwnerText(text.replace(/\s+$/g, '')).slice(0, max) || fallback
}

function normalizeSections(input: unknown): AgentZeroReportSection[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const heading = bounded(record.heading, 'Report Section', 120)
      const body = Array.isArray(record.body)
        ? record.body.map((line) => bounded(line, '', 1200)).filter(Boolean)
        : bounded(record.body, '', 4000)
      return body ? { heading, body } : null
    })
    .filter((item): item is AgentZeroReportSection => Boolean(item))
    .slice(0, 16)
}

function normalizeRequestedDelivery(input: unknown, ownerMessage?: string): AgentZeroReportRequestedDelivery[] {
  const deliveries: AgentZeroReportRequestedDelivery[] = []
  const add = (provider: AgentZeroReportDeliveryProvider, folder?: string | null) => {
    if (!deliveries.some((item) => item.provider === provider && (item.folder || null) === (folder || null))) {
      deliveries.push({ provider, folder: folder || null, requested_by_owner: true })
    }
  }

  const parseRecord = (record: Record<string, unknown>) => {
    const provider = String(record.provider || '').toLowerCase().replace(/[\s-]+/g, '_')
    if (provider === 'mission_control' || provider === 'telegram' || provider === 'onedrive' || provider === 'google_drive') {
      add(provider, typeof record.folder === 'string' ? record.folder : null)
    }
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') add(item.toLowerCase().replace(/[\s-]+/g, '_') as AgentZeroReportDeliveryProvider)
      else if (item && typeof item === 'object') parseRecord(item as Record<string, unknown>)
    }
  } else if (typeof input === 'string') {
    add(input.toLowerCase().replace(/[\s-]+/g, '_') as AgentZeroReportDeliveryProvider)
  } else if (input && typeof input === 'object') {
    parseRecord(input as Record<string, unknown>)
  }

  const text = ownerMessage || ''
  if (/one\s*drive/i.test(text)) {
    const folder = text.match(/one\s*drive\s+folder\s+([\w .&-]{2,80})/i)?.[1]?.trim() || null
    add('onedrive', folder)
  }
  if (/google\s*drive/i.test(text)) add('google_drive')
  if (/telegram|attach(?:ed|ment)?/i.test(text)) add('telegram')

  if (!deliveries.some((item) => item.provider === 'mission_control')) {
    deliveries.unshift({ provider: 'mission_control', folder: null, requested_by_owner: false })
  }
  return deliveries.filter((item) => item.provider === 'mission_control' || item.provider === 'telegram' || item.provider === 'onedrive' || item.provider === 'google_drive')
}

function deliveryChannels(requested: AgentZeroReportRequestedDelivery[], id: string): AgentZeroReportDeliveryChannel[] {
  const requestedProviders = new Map(requested.map((item) => [item.provider, item]))
  const missionControlUrl = `/api/bridge/agent-zero/reports/${id}`
  const telegramConfigured = Boolean(
    (process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || process.env.BOT_TOKEN)
    && (process.env.AGENT_ZERO_OWNER_TELEGRAM_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID || process.env.TELEGRAM_CHAT_ID),
  )
  return [
    {
      provider: 'mission_control',
      requested: Boolean(requestedProviders.get('mission_control')),
      status: 'available',
      url: missionControlUrl,
      reason: null,
      requires_bridge_session: false,
      external_write: false,
    },
    {
      provider: 'telegram',
      requested: Boolean(requestedProviders.get('telegram')),
      status: 'blocked',
      url: null,
      reason: requestedProviders.get('telegram')
        ? (telegramConfigured
            ? 'telegram_report_delivery_requires_bridge_session'
            : 'telegram_report_delivery_adapter_not_configured')
        : 'telegram_attachment_not_requested',
      requires_bridge_session: true,
      external_write: true,
    },
    {
      provider: 'onedrive',
      requested: Boolean(requestedProviders.get('onedrive')),
      status: 'blocked',
      url: null,
      reason: requestedProviders.get('onedrive')
        ? 'onedrive_report_delivery_adapter_not_configured'
        : 'onedrive_delivery_not_requested',
      requires_bridge_session: true,
      external_write: true,
    },
    {
      provider: 'google_drive',
      requested: Boolean(requestedProviders.get('google_drive')),
      status: 'blocked',
      url: null,
      reason: requestedProviders.get('google_drive')
        ? 'google_drive_report_delivery_adapter_not_configured'
        : 'google_drive_delivery_not_requested',
      requires_bridge_session: true,
      external_write: true,
    },
  ]
}

function buildNormalReply(channels: AgentZeroReportDeliveryChannel[]): string {
  const requestedBlocked = channels.filter((channel) => channel.requested && channel.status === 'blocked' && channel.provider !== 'mission_control')
  if (requestedBlocked.some((channel) => channel.provider === 'onedrive')) {
    return 'OneDrive upload is blocked because the upload connector is not configured.'
  }
  if (requestedBlocked.some((channel) => channel.provider === 'google_drive')) {
    return 'Google Drive upload is blocked because the upload connector is not configured.'
  }
  if (requestedBlocked.some((channel) => channel.provider === 'telegram')) {
    return requestedBlocked.some((channel) => channel.reason === 'telegram_report_delivery_adapter_not_configured')
      ? 'Telegram PDF attachment is blocked because Telegram connector is not configured.'
      : 'Telegram PDF attachment is blocked until an approved active Bridge Session is available.'
  }
  return 'Done. The report is ready in Mission Control.'
}

function markdownForReport(input: {
  title: string
  summary: string
  createdAt: string
  sections: AgentZeroReportSection[]
  channels: AgentZeroReportDeliveryChannel[]
  safety: AgentZeroReportManifest['safety']
}): string {
  const lines = [
    `# ${input.title}`,
    '',
    input.summary,
    '',
    `Created: ${input.createdAt}`,
    '',
    '## Delivery',
    '',
    ...input.channels.map((channel) => `- ${channel.provider}: ${channel.status}${channel.reason ? ` (${channel.reason})` : ''}`),
    '',
    '## Safety',
    '',
    `- Raw local paths exposed: ${input.safety.raw_local_paths_exposed}`,
    `- Protected actions executed: ${input.safety.protected_actions_executed}`,
    `- External writes executed: ${input.safety.external_writes_executed}`,
    '',
  ]
  for (const section of input.sections) {
    lines.push(`## ${section.heading}`, '')
    if (Array.isArray(section.body)) lines.push(...section.body.map((line) => `- ${line}`))
    else lines.push(section.body)
    lines.push('')
  }
  return redactUnsafeOwnerText(lines.join('\n')).trim() + '\n'
}

function pdfEscape(value: string): string {
  return value.replace(/[\\()]/g, (char) => `\\${char}`).replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?')
}

function wrapLines(value: string): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 86) {
      if (current) lines.push(current)
      current = word
    } else {
      current = `${current} ${word}`.trim()
    }
  }
  if (current) lines.push(current)
  return lines
}

export function createPdfBytes(title: string, markdown: string): Buffer {
  const textLines = [title, '', ...markdown.split('\n').filter((line) => line.trim()).flatMap(wrapLines)].slice(0, 52)
  const operations = ['BT', '/F1 10 Tf', '54 750 Td']
  for (const [index, line] of textLines.entries()) {
    if (index > 0) operations.push('0 -13 Td')
    operations.push(`(${pdfEscape(line)}) Tj`)
  }
  operations.push('ET')
  const stream = operations.join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf, 'utf8')
}

function safeReportDir(id: string, root?: string): string {
  if (!isAgentZeroReportId(id)) throw new Error('invalid_agent_zero_report_id')
  const base = path.resolve(reportRoot(root))
  const dir = path.resolve(base, id)
  if (!dir.startsWith(`${base}${path.sep}`)) throw new Error('invalid_agent_zero_report_path')
  return dir
}

function safeReportFile(dir: string, filename: string): string {
  const resolved = path.resolve(dir, filename)
  if (!resolved.startsWith(`${path.resolve(dir)}${path.sep}`)) throw new Error('invalid_agent_zero_report_file')
  return resolved
}

export async function createAgentZeroReport(input: {
  title?: string
  summary?: string
  sections?: unknown
  requestedDelivery?: unknown
  ownerMessage?: string
  source?: 'api' | 'test_chat'
  root?: string
  safety?: Partial<AgentZeroReportManifest['safety']>
}): Promise<AgentZeroReportCreationResult> {
  const id = safeId()
  const title = bounded(input.title, 'Agent Zero Report', 160)
  const summary = bounded(input.summary, 'Agent Zero created this report through Mission Control.', 1000)
  const createdAt = new Date().toISOString()
  const deliveries = normalizeRequestedDelivery(input.requestedDelivery, input.ownerMessage)
  const channels = deliveryChannels(deliveries, id)
  const normalReply = buildNormalReply(channels)
  const sections = normalizeSections(input.sections)
  const safety: AgentZeroReportManifest['safety'] = {
    raw_local_paths_exposed: false,
    task_ids_in_normal_reply: false,
    protected_actions_executed: Boolean(input.safety?.protected_actions_executed),
    external_writes_executed: Boolean(input.safety?.external_writes_executed),
    telegram_attachment_sent: Boolean(input.safety?.telegram_attachment_sent),
  }
  const slug = slugify(title)
  const markdownFilename = `${slug}.md`
  const pdfFilename = `${slug}.pdf`
  const dir = safeReportDir(id, input.root)
  ensureDirExists(reportRoot(input.root))
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })

  const markdown = markdownForReport({ title, summary, createdAt, sections, channels, safety })
  const pdf = createPdfBytes(title, markdown)
  const manifest: AgentZeroReportManifest = {
    id,
    title,
    summary,
    created_at: createdAt,
    created_by: 'agent_zero',
    source: input.source || 'api',
    mission_control_url: `/api/bridge/agent-zero/reports/${id}`,
    markdown_url: `/api/bridge/agent-zero/reports/${id}/markdown`,
    pdf_url: `/api/bridge/agent-zero/reports/${id}/pdf`,
    markdown_filename: markdownFilename,
    pdf_filename: pdfFilename,
    delivery_channels: channels,
    normal_reply: normalReply,
    safety,
  }

  const markdownPath = safeReportFile(dir, markdownFilename)
  const pdfPath = safeReportFile(dir, pdfFilename)
  const manifestPath = safeReportFile(dir, 'manifest.json')
  fs.writeFileSync(markdownPath, markdown, { mode: 0o600 })
  fs.writeFileSync(pdfPath, pdf, { mode: 0o600 })
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })

  return {
    report: manifest,
    attachments: [
      { type: 'pdf', label: 'PDF report', url: manifest.pdf_url },
      { type: 'markdown', label: 'Markdown report', url: manifest.markdown_url },
    ],
    internal: {
      report_dir: dir,
      markdown_path: markdownPath,
      pdf_path: pdfPath,
      manifest_path: manifestPath,
    },
  }
}

export function readAgentZeroReport(id: string, root?: string): AgentZeroReportManifest | null {
  try {
    const manifestPath = safeReportFile(safeReportDir(id, root), 'manifest.json')
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as AgentZeroReportManifest
    return manifest?.id === id ? manifest : null
  } catch {
    return null
  }
}

export function readAgentZeroReportFile(id: string, kind: 'markdown' | 'pdf', root?: string): { manifest: AgentZeroReportManifest; bytes: Buffer; filename: string } | null {
  const manifest = readAgentZeroReport(id, root)
  if (!manifest) return null
  const dir = safeReportDir(id, root)
  const filename = kind === 'markdown' ? manifest.markdown_filename : manifest.pdf_filename
  const filePath = safeReportFile(dir, filename)
  try {
    return { manifest, bytes: fs.readFileSync(filePath), filename }
  } catch {
    return null
  }
}

export function listAgentZeroReports(input: { root?: string; limit?: number } = {}): AgentZeroReportManifest[] {
  const root = reportRoot(input.root)
  try {
    if (!fs.existsSync(root)) return []
    return fs.readdirSync(root)
      .filter(isAgentZeroReportId)
      .map((id) => readAgentZeroReport(id, root))
      .filter((manifest): manifest is AgentZeroReportManifest => Boolean(manifest))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, Math.max(1, Math.min(100, input.limit || 25)))
  } catch {
    return []
  }
}

export function shouldCreateAgentZeroReportFromMessage(message: string): boolean {
  return /\b(create|make|prepare|generate|write)\b[\s\S]{0,80}\b(report|pdf|brief|summary)\b/i.test(message)
}
