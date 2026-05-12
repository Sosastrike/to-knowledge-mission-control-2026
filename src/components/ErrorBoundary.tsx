'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { createClientLogger } from '@/lib/client-logger'
import { Button } from '@/components/ui/button'
import { classifyToolError } from '@/lib/tool-error-classifier'

const log = createClientLogger('ErrorBoundary')

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const t = useTranslations('errorBoundary')
  const tc = useTranslations('common')
  const classified = classifyToolError({
    message: error?.message || null,
    technical_detail: error?.stack || null,
  })

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-8 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-destructive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{t('somethingWentWrong')}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        {classified.owner_message || t('unexpectedError')}
      </p>
      <p className="text-xs text-muted-foreground mb-4 max-w-md">
        Blocker: {classified.kind}. Next: {classified.next_action}
      </p>
      <Button
        onClick={onRetry}
        className="rounded-lg"
      >
        {tc('tryAgain')}
      </Button>
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    log.error('Panel error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: null })}
        />
      )
    }

    return this.props.children
  }
}
