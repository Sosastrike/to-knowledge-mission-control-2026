import { NextRequest } from 'next/server'

import { createSofiaRecommendation } from '@/lib/sofia-deputy-dispatcher'
import { sofiaWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return sofiaWrite(request, (input) => createSofiaRecommendation({
    title: String(input.title || 'Sofia recommendation'),
    recommendation: String(input.recommendation || input.reason || ''),
    target_system: input.target_system ? String(input.target_system) : undefined,
    risk_level: input.risk_level === 'medium' || input.risk_level === 'high' ? input.risk_level : 'low',
  }))
}
