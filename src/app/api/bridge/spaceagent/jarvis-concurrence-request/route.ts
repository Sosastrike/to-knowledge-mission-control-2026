import { NextRequest } from 'next/server'

import { createSpaceAgentJarvisConcurrenceRequest } from '@/lib/spaceagent-command-center'
import { spaceAgentWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return spaceAgentWrite(request, (input) => createSpaceAgentJarvisConcurrenceRequest({
    request_id: input.request_id ? String(input.request_id) : undefined,
    action_type: input.action_type ? String(input.action_type) : undefined,
    affected_system: input.affected_system ? String(input.affected_system) : undefined,
    reason: input.reason ? String(input.reason) : undefined,
    exact_scope: input.exact_scope,
    rollback_path: input.rollback_path ? String(input.rollback_path) : undefined,
    audit_path: input.audit_path ? String(input.audit_path) : undefined,
    visible_task_id: input.visible_task_id ? String(input.visible_task_id) : undefined,
  }))
}
