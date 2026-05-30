import { NextRequest } from 'next/server'

import { buildSpaceAgentPipelineStatus } from '@/lib/spaceagent-command-center'
import { spaceAgentRead } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return spaceAgentRead(request, buildSpaceAgentPipelineStatus)
}
