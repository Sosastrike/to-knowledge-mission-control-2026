import { NextRequest } from 'next/server'

import { createSpaceAgentRecommendation } from '@/lib/spaceagent-command-center'
import { spaceAgentWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return spaceAgentWrite(request, (input) => createSpaceAgentRecommendation({
    title: String(input.title || 'SpaceAgent recommendation'),
    recommendation: String(input.recommendation || input.reason || ''),
    target_system: input.target_system ? String(input.target_system) : undefined,
    risk_level: input.risk_level === 'medium' || input.risk_level === 'high' ? input.risk_level : 'low',
  }))
}
