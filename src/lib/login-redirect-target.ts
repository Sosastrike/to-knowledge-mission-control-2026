export const DEFAULT_LOGIN_TARGET = '/designer-mission-control/Mission%20Control.html?page=mission'

const PAGE_TARGETS: Record<string, string> = {
  'brain-sync': '/designer-mission-control/Mission%20Control.html?page=brain-sync',
  'gbrain-sync': '/designer-mission-control/Mission%20Control.html?page=gbrain-sync',
  gateway: '/gateway',
  mission: DEFAULT_LOGIN_TARGET,
}

export function normalizeInternalPath(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null

  try {
    const parsed = new URL(trimmed, 'http://mission-control.local')
    if (parsed.origin !== 'http://mission-control.local') return null
    if (parsed.pathname.startsWith('/api/')) return null
    if (parsed.pathname === '/login' || parsed.pathname === '/setup') return null
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

export function getPostLoginTarget(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const next = params.get('next')
  if (next) {
    const normalized = normalizeInternalPath(next)
    if (normalized) return normalized
  }

  const page = params.get('page') || ''
  const mappedPage = PAGE_TARGETS[page]
  if (mappedPage) return mappedPage

  return DEFAULT_LOGIN_TARGET
}
