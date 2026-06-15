import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  BUILDWIKI_CONNECTOR,
  BUILDWIKI_TARGET_SERVICE,
  getBuildwikiStatus,
  type BuildwikiStatus,
} from '@/lib/buildwiki-runner'
import { config } from '@/lib/config'

export const JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID = 'buildwiki_result_ingest'
export const JARVIS_BUILDWIKI_RESULT_INGEST_ACTION = 'buildwiki.result_ingest'
export const JARVIS_BUILDWIKI_RESULT_INGEST_SESSION_SCOPE = 'buildwiki_result_ingest'

const storePath = join(config.dataDir, 'jarvis-buildwiki-result-ingestions.json')

export type JarvisBuildwikiResultIngestionRecord = {
  id: string
  at: string
  action: typeof JARVIS_BUILDWIKI_RESULT_INGEST_ACTION
  target: typeof BUILDWIKI_TARGET_SERVICE
  service_active: boolean
  timer_active: boolean
  recent_event_count: number
  latest_event: string | null
  dispatch_completed_count: number
  dispatch_failed_count: number
  credential_values_exposed: false
}

export type JarvisBuildwikiResultIngestResult = {
  ok: boolean
  adapter_id: typeof JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID
  action: typeof JARVIS_BUILDWIKI_RESULT_INGEST_ACTION
  target: typeof BUILDWIKI_TARGET_SERVICE
  ingestion_id: string | null
  ingestion_record_written: boolean
  service_active: boolean | null
  timer_active: boolean | null
  recent_event_count: number
  latest_event: string | null
  dispatch_completed_count: number
  dispatch_failed_count: number
  smb_touched: false
  external_farmers_touched: false
  other_systemd_units_touched: false
  credential_values_exposed: false
  raw_log_output_returned: false
  exact_blocker: string | null
}

function readRows(): JarvisBuildwikiResultIngestionRecord[] {
  try {
    const parsed = JSON.parse(readFileSync(storePath, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeIngestionRecord(row: JarvisBuildwikiResultIngestionRecord) {
  mkdirSync(dirname(storePath), { recursive: true })
  writeFileSync(storePath, `${JSON.stringify([row, ...readRows()], null, 2)}\n`, 'utf8')
  return row
}

function blocked(exact_blocker: string): JarvisBuildwikiResultIngestResult {
  return {
    ok: false,
    adapter_id: JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID,
    action: JARVIS_BUILDWIKI_RESULT_INGEST_ACTION,
    target: BUILDWIKI_TARGET_SERVICE,
    ingestion_id: null,
    ingestion_record_written: false,
    service_active: null,
    timer_active: null,
    recent_event_count: 0,
    latest_event: null,
    dispatch_completed_count: 0,
    dispatch_failed_count: 0,
    smb_touched: false,
    external_farmers_touched: false,
    other_systemd_units_touched: false,
    credential_values_exposed: false,
    raw_log_output_returned: false,
    exact_blocker,
  }
}

export async function executeJarvisBuildwikiResultIngest(input: {
  action?: string
  scope?: Record<string, unknown>
}, deps: {
  getStatus?: () => Promise<BuildwikiStatus>
  writeIngestion?: (row: JarvisBuildwikiResultIngestionRecord) => JarvisBuildwikiResultIngestionRecord
} = {}): Promise<JarvisBuildwikiResultIngestResult> {
  const scope = input.scope || {}
  if (
    input.action !== JARVIS_BUILDWIKI_RESULT_INGEST_ACTION ||
    scope.connector !== BUILDWIKI_CONNECTOR ||
    scope.operation !== 'result_ingest' ||
    scope.target !== BUILDWIKI_TARGET_SERVICE
  ) {
    return blocked('exact_scope_required_buildwiki_result_ingest')
  }

  const status = await (deps.getStatus || getBuildwikiStatus)()
  const events = status.recent_events || []
  const record = (deps.writeIngestion || writeIngestionRecord)({
    id: `bwri_${randomUUID()}`,
    at: new Date().toISOString(),
    action: JARVIS_BUILDWIKI_RESULT_INGEST_ACTION,
    target: BUILDWIKI_TARGET_SERVICE,
    service_active: status.service_active,
    timer_active: status.timer_active,
    recent_event_count: events.length,
    latest_event: status.last_event?.event || null,
    dispatch_completed_count: events.filter((event) => event.event === 'dispatch_completed').length,
    dispatch_failed_count: events.filter((event) => event.event === 'dispatch_failed').length,
    credential_values_exposed: false,
  })

  return {
    ok: true,
    adapter_id: JARVIS_BUILDWIKI_RESULT_INGEST_ADAPTER_ID,
    action: JARVIS_BUILDWIKI_RESULT_INGEST_ACTION,
    target: BUILDWIKI_TARGET_SERVICE,
    ingestion_id: record.id,
    ingestion_record_written: true,
    service_active: record.service_active,
    timer_active: record.timer_active,
    recent_event_count: record.recent_event_count,
    latest_event: record.latest_event,
    dispatch_completed_count: record.dispatch_completed_count,
    dispatch_failed_count: record.dispatch_failed_count,
    smb_touched: false,
    external_farmers_touched: false,
    other_systemd_units_touched: false,
    credential_values_exposed: false,
    raw_log_output_returned: false,
    exact_blocker: null,
  }
}
