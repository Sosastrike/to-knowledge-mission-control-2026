 'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'

type DesignerGatewayMockFrameProps = {
  page: string
  title: string
}

const BASE_PATH = '/designer-mission-control/design/gateway/'

function toMockUrl(page: string): string {
  return BASE_PATH + encodeURIComponent(page)
}

export function DesignerGatewayMockFrame({ page, title }: DesignerGatewayMockFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const frameSrc = useMemo(() => toMockUrl(page), [page])

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
      if (!iframe.contentDocument) return
      const observedNode = iframe.contentDocument.documentElement
      observer = new ResizeObserver(syncHeightRaf)
      observer.observe(observedNode)
      window.setTimeout(syncHeight, 150)
      window.setTimeout(syncHeight, 500)
      window.setTimeout(syncHeight, 1200)
    }

    iframe.addEventListener('load', onLoad)
    window.addEventListener('resize', syncHeightRaf)

    return () => {
      iframe.removeEventListener('load', onLoad)
      window.removeEventListener('resize', syncHeightRaf)
      if (observer) observer.disconnect()
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [frameSrc])

  return (
    <main className='min-h-screen w-full bg-[#070912]'>
      <header className='sticky top-0 z-20 border-b border-[#182438] bg-[#0b111c]/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-[#0b111c]/85 md:px-6'>
        <nav aria-label='Gateway frame navigation' className='flex flex-wrap items-center gap-2 text-sm text-[#9aacbf]'>
          <Link className='rounded border border-[#24344d] px-2.5 py-1 text-[#d4deea] hover:border-[#3f587d]' href='/tkmc'>
            Mission Control Home
          </Link>
          <span>/</span>
          <Link className='rounded border border-[#24344d] px-2.5 py-1 text-[#d4deea] hover:border-[#3f587d]' href='/gateway'>
            Gateway Overview
          </Link>
          <span>/</span>
          <Link className='rounded border border-[#24344d] px-2.5 py-1 text-[#d4deea] hover:border-[#3f587d]' href='/gateway/agent-hub'>
            Agent Hub
          </Link>
          <span className='ml-auto text-xs text-[#7f93aa]'>{title}</span>
        </nav>
      </header>
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
