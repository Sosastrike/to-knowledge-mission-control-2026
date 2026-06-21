import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { buildAuthenticatedSessionPayload, buildUnauthenticatedSessionPayload } from '@/lib/auth-session'

export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) {
    return NextResponse.json(buildUnauthenticatedSessionPayload())
  }

  return NextResponse.json(buildAuthenticatedSessionPayload(user))
}
