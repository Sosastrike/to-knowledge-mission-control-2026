import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildAgentZeroReportLinks,
  containsUnsafeOwnerText,
  createAgentZeroReport,
  listAgentZeroReports,
  normalizeMissionControlPublicOrigin,
  readAgentZeroReportFile,
  shouldCreateAgentZeroReportFromMessage,
} from './agent-zero-report-delivery'

describe('Agent Zero report delivery surface', () => {
  function makeRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'az-report-delivery-'))
  }

  it('creates Markdown and PDF reports with Mission Control links only', async () => {
    const root = makeRoot()
    const result = await createAgentZeroReport({
      root,
      title: 'Agent Zero Capability Report',
      summary: 'Safe ecosystem capability inventory.',
      sections: [
        { heading: 'Visible tools', body: ['Mission Control', '/home/tony/secret/path', 'runtime/executive-reports/raw.pdf'] },
      ],
    })

    expect(result.report.mission_control_url).toMatch(/^\/api\/bridge\/agent-zero\/reports\/azr_/)
    expect(result.report.pdf_url).toMatch(/\/pdf$/)
    expect(result.report.markdown_url).toMatch(/\/markdown$/)
    expect(result.report.normal_reply).toBe('Done. The report is ready in Mission Control.')
    expect(result.report.safety.raw_local_paths_exposed).toBe(false)
    expect(result.report.safety.task_ids_in_normal_reply).toBe(false)
    expect(result.attachments.map((item) => item.type)).toEqual(['pdf', 'markdown'])
    expect(fs.readFileSync(result.internal.pdf_path, 'utf8').startsWith('%PDF-')).toBe(true)
    expect(fs.readFileSync(result.internal.markdown_path, 'utf8')).not.toContain('/home/tony')
    expect(fs.readFileSync(result.internal.markdown_path, 'utf8')).not.toContain('runtime/executive-reports')
    expect(JSON.stringify(result.report)).not.toContain(root)
    expect(containsUnsafeOwnerText(result.report.normal_reply)).toBe(false)
  })

  it('builds protected report links without exposing local origins or filesystem paths', async () => {
    const root = makeRoot()
    const result = await createAgentZeroReport({
      root,
      title: 'Protected Link Report',
      summary: 'Owner-safe protected link bundle.',
    })

    const localLinks = buildAgentZeroReportLinks(result.report, 'http://127.0.0.1:3337/gateway')
    expect(localLinks.auth_required).toBe(true)
    expect(localLinks.raw_local_paths_exposed).toBe(false)
    expect(localLinks.public_origin_available).toBe(false)
    expect(localLinks.blocked_reason).toBe('mission_control_public_url_required')
    expect(localLinks.mission_control.url).toBe(result.report.mission_control_url)
    expect(localLinks.pdf.url).toBe(result.report.pdf_url)
    expect(localLinks.markdown.url).toBe(result.report.markdown_url)
    expect(localLinks.mission_control.absolute_url).toBeNull()
    expect(JSON.stringify(localLinks)).not.toContain(root)
    expect(JSON.stringify(localLinks)).not.toContain('127.0.0.1')

    const publicLinks = buildAgentZeroReportLinks(result.report, 'https://tkmc.knowledge-vs-ai.com/gateway')
    expect(publicLinks.public_origin_available).toBe(true)
    expect(publicLinks.blocked_reason).toBeNull()
    expect(publicLinks.mission_control.absolute_url).toBe(`https://tkmc.knowledge-vs-ai.com${result.report.mission_control_url}`)
    expect(publicLinks.pdf.absolute_url).toBe(`https://tkmc.knowledge-vs-ai.com${result.report.pdf_url}`)
  })

  it('normalizes only safe Mission Control public origins', () => {
    expect(normalizeMissionControlPublicOrigin('https://tkmc.knowledge-vs-ai.com/gateway')).toBe('https://tkmc.knowledge-vs-ai.com')
    expect(normalizeMissionControlPublicOrigin('http://127.0.0.1:3337/gateway')).toBeNull()
    expect(normalizeMissionControlPublicOrigin('http://10.69.1.138/gateway')).toBeNull()
    expect(normalizeMissionControlPublicOrigin('file:///tmp/report.html')).toBeNull()
  })

  it('blocks requested external delivery without fake done claims', async () => {
    const root = makeRoot()
    const result = await createAgentZeroReport({
      root,
      title: 'OneDrive Requested Report',
      summary: 'Owner asked for external delivery.',
      ownerMessage: 'Create the report and send it to OneDrive folder Tony videos 2026',
      requestedDelivery: { provider: 'onedrive', folder: 'Tony videos 2026' },
    })

    const onedrive = result.report.delivery_channels.find((channel) => channel.provider === 'onedrive')
    expect(onedrive).toMatchObject({ requested: true, status: 'blocked', external_write: true, requires_bridge_session: true })
    expect(result.report.normal_reply).toBe('OneDrive upload is blocked because the upload connector is not configured.')
    expect(result.report.normal_reply.startsWith('Done')).toBe(false)
    expect(result.report.normal_reply).not.toContain('/home/tony')
  })


  it('uses the required Google Drive blocked message without fake done', async () => {
    const root = makeRoot()
    const result = await createAgentZeroReport({
      root,
      title: 'Google Drive Requested Report',
      summary: 'Owner asked for Google Drive delivery.',
      ownerMessage: 'Create the report and send it to Google Drive',
      requestedDelivery: { provider: 'google_drive' },
    })

    const drive = result.report.delivery_channels.find((channel) => channel.provider === 'google_drive')
    expect(drive).toMatchObject({ requested: true, status: 'blocked', external_write: true, requires_bridge_session: true })
    expect(result.report.normal_reply).toBe('Google Drive upload is blocked because the upload connector is not configured.')
    expect(result.report.normal_reply.startsWith('Done')).toBe(false)
    expect(result.report.normal_reply).not.toContain('/home/tony')
  })

  it('blocks Telegram attachment through the Bridge-gated adapter without fake done', async () => {
    const root = makeRoot()
    const result = await createAgentZeroReport({
      root,
      title: 'Telegram Report',
      summary: 'Owner asked for a Telegram PDF attachment.',
      ownerMessage: 'Create a report and attach the PDF in Telegram',
    })

    const telegram = result.report.delivery_channels.find((channel) => channel.provider === 'telegram')
    expect(telegram).toMatchObject({ requested: true, status: 'blocked' })
    expect(telegram?.reason).toBe('telegram_report_delivery_adapter_not_configured')
    expect(result.report.normal_reply).toBe('Telegram PDF attachment is blocked because Telegram connector is not configured.')
    expect(result.report.normal_reply).not.toMatch(/^Done\b/)
  })

  it('lists and reads report files without exposing local filesystem paths', async () => {
    const root = makeRoot()
    const created = await createAgentZeroReport({ root, title: 'Listable Report', summary: 'Listable summary.' })
    const reports = listAgentZeroReports({ root, limit: 5 })
    const pdf = readAgentZeroReportFile(created.report.id, 'pdf', root)
    const markdown = readAgentZeroReportFile(created.report.id, 'markdown', root)

    expect(reports).toHaveLength(1)
    expect(JSON.stringify(reports)).not.toContain(root)
    expect(pdf?.bytes.toString('utf8').startsWith('%PDF-')).toBe(true)
    expect(markdown?.bytes.toString('utf8')).toContain('# Listable Report')
  })

  it('detects explicit report creation requests for test chat wrapping', () => {
    expect(shouldCreateAgentZeroReportFromMessage('Create a simple report showing what you can see.')).toBe(true)
    expect(shouldCreateAgentZeroReportFromMessage('Tell me what you can see.')).toBe(false)
  })
})
