import { NextResponse } from 'next/server'
import { isAzureAdConfigured } from '@/lib/azure-ad-auth'

export async function GET() {
  return NextResponse.json({
    provider: 'azure-ad',
    configured: isAzureAdConfigured(),
    login_path: '/api/auth/azure-ad',
    callback_path: '/api/auth/callback/azure-ad',
  })
}
