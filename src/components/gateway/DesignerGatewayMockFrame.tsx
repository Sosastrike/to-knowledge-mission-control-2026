type DesignerGatewayMockFrameProps = {
  page: string
  title: string
}

const BASE_PATH = '/designer-mission-control/design/gateway/'
const EXIT_LINKS: Array<{ href: string; label: string }> = [
  { href: '/tkmc', label: 'Mission Control Home' },
  { href: '/gateway', label: 'Gateway Overview' },
  { href: '/gateway/agent-hub', label: 'Agent Hub' },
]

function toMockUrl(page: string): string {
  return BASE_PATH + encodeURIComponent(page)
}

export function DesignerGatewayMockFrame({ page, title }: DesignerGatewayMockFrameProps) {
  return (
    <main className='flex h-full min-h-0 w-full flex-col bg-[#070912]'>
      <header className='sticky top-0 z-20 border-b border-white/10 bg-[#0b1118] px-4 py-3 backdrop-blur sm:px-6'>
        <div className='mx-auto flex w-full max-w-[1480px] flex-wrap items-center justify-between gap-3'>
          <nav aria-label='Gateway exits' className='flex flex-wrap items-center gap-2'>
            {EXIT_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className='rounded-md border border-white/15 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-cyan-300/40'
              >
                {link.label}
              </a>
            ))}
          </nav>
          <nav aria-label='Breadcrumb' className='text-xs text-slate-300'>
            <a href='/tkmc' className='font-semibold text-cyan-200 hover:text-cyan-100'>Mission Control</a>
            <span className='px-1.5 text-slate-500'>/</span>
            <a href='/gateway' className='font-semibold text-cyan-200 hover:text-cyan-100'>Gateway</a>
            <span className='px-1.5 text-slate-500'>/</span>
            <span className='font-semibold text-white'>{title}</span>
          </nav>
        </div>
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        <iframe
          title={title}
          src={toMockUrl(page)}
          className='block h-[calc(100vh-3.9rem)] min-h-[760px] w-full border-0'
          loading='eager'
          scrolling='yes'
        />
      </div>
    </main>
  )
}
