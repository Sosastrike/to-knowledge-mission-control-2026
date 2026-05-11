'use client'

import { HealthRow, formatUptime, type DashboardData } from '../widget-primitives'

export function RuntimeHealthWidget({ data }: { data: DashboardData }) {
  const { localOsStatus, claudeHealth, codexHealth, hermesHealth, mcHealth, memPct, systemStats, runtimeHealth } = data
  const runtimeStatus = runtimeHealth?.status === 'LIVE'
    ? 'good'
    : runtimeHealth?.status === 'SERVICE_DOWN'
      ? 'bad'
      : 'warn'
  const runtimeValue = runtimeHealth?.status || 'UNKNOWN'
  const commit = runtimeHealth?.source_commit || 'unknown'
  const bind = runtimeHealth?.bind?.expected_host && runtimeHealth?.bind?.port
    ? `${runtimeHealth.bind.expected_host}:${runtimeHealth.bind.port}`
    : 'unknown'
  const pidValue = runtimeHealth?.standalone?.pid_matches_listener
    ? `PID ${runtimeHealth.standalone.pid_from_file}`
    : runtimeHealth?.standalone?.listener_pids?.length
      ? `listener ${runtimeHealth.standalone.listener_pids[0]}`
      : 'not listening'
  const buildValue = runtimeHealth?.deployment?.last_build_at
    ? new Date(runtimeHealth.deployment.last_build_at).toLocaleString()
    : 'unknown'

  return (
    <div className="panel">
      <div className="panel-header"><h3 className="text-sm font-semibold">Local Runtime Health</h3></div>
      <div className="panel-body space-y-3">
        <HealthRow label="Local OS" value={localOsStatus.value} status={localOsStatus.status} />
        <HealthRow label="Claude Runtime" value={claudeHealth.value} status={claudeHealth.status} />
        <HealthRow label="Codex Runtime" value={codexHealth.value} status={codexHealth.status} />
        <HealthRow label="Hermes Runtime" value={hermesHealth.value} status={hermesHealth.status} />
        <HealthRow label="MC Core" value={mcHealth.value} status={mcHealth.status} />
        <HealthRow label="Deployment" value={runtimeValue} status={runtimeStatus} />
        <HealthRow label="Commit" value={commit} status={commit === 'unknown' ? 'warn' : 'good'} />
        <HealthRow label="Bind" value={bind} status={runtimeHealth?.bind?.no_public_exposure_added ? 'good' : 'bad'} />
        <HealthRow label="Process" value={pidValue} status={runtimeHealth?.standalone?.pid_matches_listener ? 'good' : 'warn'} />
        <HealthRow label="Last Build" value={buildValue} status={runtimeHealth?.deployment?.last_build_at ? 'good' : 'warn'} />
        {memPct != null && <HealthRow label="Memory" value={`${memPct}%`} status={memPct > 90 ? 'bad' : memPct > 70 ? 'warn' : 'good'} bar={memPct} />}
        {systemStats?.disk && <HealthRow label="Disk" value={systemStats.disk.usage || 'N/A'} status={parseInt(systemStats.disk.usage) > 90 ? 'bad' : 'good'} />}
        {systemStats?.uptime != null && <HealthRow label="Uptime" value={formatUptime(systemStats.uptime)} status="good" />}
      </div>
    </div>
  )
}
