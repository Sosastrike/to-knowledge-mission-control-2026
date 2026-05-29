import { NextRequest } from 'next/server'

import { buildSofiaStatus } from '@/lib/sofia-deputy-dispatcher'
import { sofiaRead } from '../_shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  return sofiaRead(request, buildSofiaStatus)
}
