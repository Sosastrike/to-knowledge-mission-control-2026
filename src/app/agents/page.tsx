import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Agent Network · To-Knowledge Mission Control',
  description: 'Redirects to the official designer Mission Control Agent Network surface.',
}

export default function AgentsPage() {
  redirect('/designer-mission-control/Mission%20Control.html?page=agent-network')
}
