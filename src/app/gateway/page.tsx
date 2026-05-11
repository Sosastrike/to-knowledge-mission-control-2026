import type { Metadata } from 'next'
import GatewayShell from '@/components/gateway/GatewayShell'

// The /gateway route is the single canonical owner-facing Gateway surface.
// All deep links (/gateway/agent-hub, /gateway/dispatcher, ...) rewrite to
// this same page; GatewayShell reads usePathname() to pick the active tab.
// Do NOT add a parallel route under /gateway/<segment>/page.tsx — that
// would defeat the iframe-mount pattern and re-introduce drift.

export const metadata: Metadata = {
  title: 'Gateway · Mission Control',
}

export default function GatewayPage() {
  return <GatewayShell />
}
