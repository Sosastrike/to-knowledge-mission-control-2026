'use client'

import { useEffect, useMemo, useRef } from 'react'

type DesignerGatewayMockFrameProps = {
  page: string
  title: string
  fragment?: string
}

const BASE_PATH = '/designer-mission-control/design/gateway/'

function toMockUrl(page: string, fragment?: string): string {
  const hash = fragment ? `#${encodeURIComponent(fragment)}` : ''
  return BASE_PATH + encodeURIComponent(page) + hash
}

export function DesignerGatewayMockFrame({ page, title, fragment }: DesignerGatewayMockFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const frameSrc = useMemo(() => toMockUrl(page, fragment), [page, fragment])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    let observer: ResizeObserver | null = null
    let rafId: number | null = null

    const syncHeight = () => {
      if (!iframe.contentDocument) return
      const body = iframe.contentDocument.body
      const html = iframe.contentDocument.documentElement
      const nextHeight = Math.max(
        body?.scrollHeight || 0,
        html?.scrollHeight || 0,
        window.innerHeight,
      )

      if (nextHeight > 0) iframe.style.height = `${nextHeight}px`
    }

    const syncHeightRaf = () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(syncHeight)
    }

    const onLoad = () => {
      syncHeight()
      if (!iframe.contentDocument || observer) return
      const observedNode = iframe.contentDocument.documentElement
      observer = new ResizeObserver(syncHeightRaf)
      observer.observe(observedNode)
      window.setTimeout(syncHeight, 150)
      window.setTimeout(syncHeight, 500)
      window.setTimeout(syncHeight, 1200)
    }

    iframe.addEventListener('load', onLoad)
    window.addEventListener('resize', syncHeightRaf)
    if (iframe.contentDocument?.readyState === 'complete') {
      onLoad()
    } else {
      syncHeightRaf()
    }

    return () => {
      iframe.removeEventListener('load', onLoad)
      window.removeEventListener('resize', syncHeightRaf)
      if (observer) observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [frameSrc])

  return (
    <main className='min-h-screen w-full bg-[#070912]'>
      <iframe
        ref={iframeRef}
        title={title}
        src={frameSrc}
        className='block w-full border-0'
        loading='eager'
        scrolling='yes'
      />
    </main>
  )
}
