import { redirect } from 'next/navigation'

const DESIGNER_BASE = '/designer-mission-control/Mission%20Control.html'

type PageProps = {
  params: Promise<{ panel?: string[] }>
}

export default async function Home({ params }: PageProps) {
  const resolved = await params
  const firstPanel = resolved.panel?.[0] || 'mission'
  const page = firstPanel === 'agents' ? 'agent-network' : 'mission'
  redirect(`${DESIGNER_BASE}?page=${page}`)
}
