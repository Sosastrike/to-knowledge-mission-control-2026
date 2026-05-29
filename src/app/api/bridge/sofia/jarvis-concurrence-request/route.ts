import { NextRequest } from 'next/server'

import { createSofiaJarvisConcurrenceRequest } from '@/lib/sofia-deputy-dispatcher'
import { sofiaWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return sofiaWrite(request, (input) => createSofiaJarvisConcurrenceRequest({
    request_id: input.request_id ? String(input.request_id) : undefined,
    action_type: input.action_type ? String(input.action_type) : undefined,
    affected_system: input.affected_system ? String(input.affected_system) : undefined,
    risk_level: input.risk_level ? String(input.risk_level) : undefined,
    exact_scope: input.exact_scope,
    reason: String(input.reason || ''),
    expected_benefit: input.expected_benefit ? String(input.expected_benefit) : undefined,
    rollback_path: input.rollback_path ? String(input.rollback_path) : undefined,
    audit_path: input.audit_path ? String(input.audit_path) : undefined,
    visible_task_id: input.visible_task_id ? String(input.visible_task_id) : undefined,
  }), true)
}
