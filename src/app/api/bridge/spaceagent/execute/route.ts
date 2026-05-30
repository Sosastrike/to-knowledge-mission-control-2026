import { NextRequest } from 'next/server'

import { refuseSpaceAgentProductionExecution } from '@/lib/spaceagent-command-center'
import { spaceAgentWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return spaceAgentWrite(request, refuseSpaceAgentProductionExecution)
}
