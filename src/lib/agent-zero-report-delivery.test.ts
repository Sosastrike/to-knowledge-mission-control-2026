import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  containsUnsafeOwnerText,
  createAgentZeroReport,
  listAgentZeroReports,
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

  it('blocks Telegram attachment until an approved document route exists', async () => {
    const root = makeRoot()
    const result = await createAgentZeroReport({
      root,
      title: 'Telegram Report',
      summary: 'Owner asked for a Telegram PDF attachment.',
      ownerMessage: 'Create a report and attach the PDF in Telegram',
    })

    const telegram = result.report.delivery_channels.find((channel) => channel.provider === 'telegram')
    expect(telegram).toMatchObject({ requested: true, status: 'blocked' })
    expect(telegram?.reason).toBe('no_approved_telegram_document_attachment_route')
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
