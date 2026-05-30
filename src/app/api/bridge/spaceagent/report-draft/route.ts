import { NextRequest } from 'next/server'

import { createSpaceAgentReportDraft } from '@/lib/spaceagent-command-center'
import { spaceAgentWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return spaceAgentWrite(request, (input) => createSpaceAgentReportDraft({
    title: String(input.title || 'SpaceAgent report draft'),
    summary: String(input.summary || input.reason || ''),
    findings: input.findings,
    visible_task_id: input.visible_task_id ? String(input.visible_task_id) : undefined,
  }))
}
