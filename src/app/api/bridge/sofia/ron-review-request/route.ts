import { NextRequest } from 'next/server'

import { createSofiaRonReviewRequest } from '@/lib/sofia-deputy-dispatcher'
import { sofiaWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return sofiaWrite(request, (input) => createSofiaRonReviewRequest({
    request_id: input.request_id ? String(input.request_id) : undefined,
    review_topic: String(input.review_topic || input.title || 'Ron review request'),
    reason: String(input.reason || ''),
    target_reviewer: input.target_reviewer ? String(input.target_reviewer) : undefined,
    visible_task_id: input.visible_task_id ? String(input.visible_task_id) : undefined,
  }))
}
