type DesignerGatewayMockFrameProps = {
  page: string
  title: string
}

const BASE_PATH = '/designer-mission-control/design/gateway/'

function toMockUrl(page: string): string {
  return BASE_PATH + encodeURIComponent(page)
}

export function DesignerGatewayMockFrame({ page, title }: DesignerGatewayMockFrameProps) {
  return (
    <main className='h-screen w-full overflow-hidden bg-[#070912]'>
      <iframe
        title={title}
        src={toMockUrl(page)}
        className='block h-full w-full border-0'
        loading='eager'
      />
    </main>
  )
}
