import type { Metadata } from 'next'
import { Suspense } from 'react'
import GatewayShell from '@/components/gateway/GatewayShell'

// The /gateway route is the single canonical owner-facing Gateway surface.
// Deep links rewrite to this same page; GatewayShell reads usePathname()
// and ?control=... to choose the designer frame or a readable owner control
// panel. Do NOT add parallel /gateway/<segment>/page.tsx routes.

export const metadata: Metadata = {
  title: 'Gateway · Mission Control',
}

export default function GatewayPage() {
  return (
    <Suspense fallback={null}>
      <GatewayShell />
    </Suspense>
  )
}
