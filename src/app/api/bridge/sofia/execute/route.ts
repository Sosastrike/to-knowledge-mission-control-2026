import { NextRequest } from 'next/server'

import { refuseSofiaProductionExecution } from '@/lib/sofia-deputy-dispatcher'
import { sofiaWrite } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return sofiaWrite(request, refuseSofiaProductionExecution, true)
}
