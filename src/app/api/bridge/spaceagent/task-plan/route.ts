import { NextRequest } from 'next/server'

import { createSpaceAgentTaskPlan } from '@/lib/spaceagent-command-center'
import { spaceAgentWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return spaceAgentWrite(request, (input) => createSpaceAgentTaskPlan({
    title: String(input.title || 'SpaceAgent task plan'),
    objective: String(input.objective || input.reason || ''),
    next_safe_lane: input.next_safe_lane ? String(input.next_safe_lane) : undefined,
    visible_task_id: input.visible_task_id ? String(input.visible_task_id) : undefined,
  }))
}
