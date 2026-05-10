import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

type GatewayOverviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const DESIGNER_GATEWAY_SHELL = '/designer-mission-control/Mission%20Control.html?page=gateway'

function first(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export default async function GatewayOverviewPage({ searchParams }: GatewayOverviewPageProps) {
  const params = searchParams ? await searchParams : {}
  const tab = first(params.tab)
  const suffix = tab ? `&tab=${encodeURIComponent(tab)}` : ''

  redirect(`${DESIGNER_GATEWAY_SHELL}${suffix}`)
}
