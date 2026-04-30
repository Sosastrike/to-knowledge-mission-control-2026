'use client'

import { useState, useCallback } from 'react'

interface HealthCheck {
  name: string
  category: 'api' | 'service' | 'channel' | 'security' | 'storage'
  status: 'healthy' | 'degraded' | 'down' | 'unchecked'
  message: string
  responseTime?: number
  lastChecked: number
}

interface HealthData {
  timestamp: number
  score: number
  summary: string
  checks: HealthCheck[]
}

const STATUS_ICONS: Record<string, string> = {
  healthy: '✅',
  degraded: '⚠️',
  down: '❌',
  unchecked: '⬜',
}

const STATUS_COLORS: Record<string, string> = {
  healthy: 'text-green-600 bg-green-50 border-green-200',
  degraded: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  down: 'text-red-600 bg-red-50 border-red-200',
  unchecked: 'text-gray-500 bg-gray-50 border-gray-200',
}

const CATEGORY_LABELS: Record<string, string> = {
  api: 'API Connections',
  service: 'Services',
  channel: 'Channels & Integrations',
  security: 'Security',
  storage: 'Storage & Backups',
}

const CATEGORY_ORDER = ['api', 'service', 'channel', 'security', 'storage']

export default function HealthCheckPanel() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runChecks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/health-check')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      setError(err.message || 'Failed to run health checks')
    } finally {
      setLoading(false)
    }
  }, [])

  const scoreColor = data
    ? data.score >= 90 ? 'text-green-600' : data.score >= 70 ? 'text-yellow-600' : 'text-red-600'
    : 'text-gray-400'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Health Check</h2>
          <p className="text-sm text-gray-500">
            {data
              ? `Last checked: ${new Date(data.timestamp).toLocaleTimeString()}`
              : 'Click the button to run live checks on all integrations'}
          </p>
        </div>
        <button
          onClick={runChecks}
          disabled={loading}
          className={`px-4 py-2 rounded-lg font-medium text-white transition-all ${
            loading
              ? 'bg-gray-400 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {loading ? 'Checking...' : data ? 'Run Again' : 'Run Health Check'}
        </button>
      </div>

      {/* Score Badge */}
      {data && (
        <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border">
          <div className={`text-4xl font-bold ${scoreColor}`}>
            {data.score}%
          </div>
          <div>
            <div className="font-medium">{data.summary}</div>
            <div className="text-sm text-gray-500">
              {data.checks.filter(c => c.status === 'down').length > 0
                ? `${data.checks.filter(c => c.status === 'down').length} service(s) need attention`
                : 'All systems operational'}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Checks by Category */}
      {data && CATEGORY_ORDER.map(cat => {
        const catChecks = data.checks.filter(c => c.category === cat)
        if (catChecks.length === 0) return null
        return (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="space-y-1">
              {catChecks.map((check, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between p-3 rounded-lg border ${STATUS_COLORS[check.status]}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{STATUS_ICONS[check.status]}</span>
                    <span className="font-medium">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{check.message}</span>
                    {check.responseTime !== undefined && (
                      <span className="text-gray-400">{check.responseTime}ms</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
