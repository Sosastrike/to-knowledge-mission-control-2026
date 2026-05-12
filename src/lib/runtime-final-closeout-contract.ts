export const REQUIRED_RUNTIME_CLOSEOUT_LANES = [
  { id: 'deployment_pipeline', label: 'Day 63 deployment pipeline' },
  { id: 'runtime_health_dashboard', label: 'Day 64 runtime health dashboard' },
  { id: 'protected_route_smoke', label: 'Day 65 protected route smoke' },
  { id: 'authenticated_route_smoke', label: 'Day 66 authenticated route smoke' },
  { id: 'secret_scan', label: 'Day 67 secret scan' },
  { id: 'raw_path_public_exposure', label: 'Day 68 raw path / public exposure sweep' },
  { id: 'rollback_plan', label: 'Day 69 rollback plan' },
  { id: 'monitoring_failure_states', label: 'Day 70 monitoring / failure states' },
  { id: 'restart_proof', label: 'Day 71 production restart proof' },
] as const

export type RuntimeFinalCloseoutLaneId = (typeof REQUIRED_RUNTIME_CLOSEOUT_LANES)[number]['id']

type ArtifactMap = Record<RuntimeFinalCloseoutLaneId, any>

export type RuntimeFinalCloseoutReport = {
  ok: boolean
  checked_at: string
  mode: 'runtime_final_closeout'
  status: 'GO' | 'PARTIAL GO' | 'BLOCKED'
  blocker_class: 'NONE' | 'OWNER_GATED' | 'BLOCKED'
  source_commit: string
  source_branch: string
  lanes_checked: number
  owner_gated_lanes: string[]
  failures: Array<{
    lane: RuntimeFinalCloseoutLaneId
    reason: string
  }>
  no_fake_go: true
  no_fake_done: true
  no_public_exposure_added: true
  no_external_writes_executed: true
  rollback: string
  lanes: Array<{
    id: RuntimeFinalCloseoutLaneId
    label: string
    ok: boolean
    blocker_class: string
    status: string
  }>
}

function laneFailure(lane: RuntimeFinalCloseoutLaneId, reason: string) {
  return { lane, reason }
}

function artifactOk(value: any): boolean {
  return value?.ok === true
}

function blockerClass(value: any): string {
  return String(value?.blocker_class || 'NONE')
}

function buildLaneStatuses(artifacts: ArtifactMap) {
  return REQUIRED_RUNTIME_CLOSEOUT_LANES.map((lane) => ({
    id: lane.id,
    label: lane.label,
    ok: artifactOk(artifacts[lane.id]),
    blocker_class: blockerClass(artifacts[lane.id]),
    status: artifactOk(artifacts[lane.id])
      ? blockerClass(artifacts[lane.id]) === 'OWNER_GATED'
        ? 'OWNER_GATED'
        : 'PASS'
      : 'BLOCKED',
  }))
}

function validateArtifacts(artifacts: ArtifactMap): RuntimeFinalCloseoutReport['failures'] {
  const failures: RuntimeFinalCloseoutReport['failures'] = []

  if (!artifactOk(artifacts.deployment_pipeline)) failures.push(laneFailure('deployment_pipeline', 'deployment_pipeline_artifact_failed'))
  if (!artifactOk(artifacts.runtime_health_dashboard) || artifacts.runtime_health_dashboard?.status !== 'LIVE') {
    failures.push(laneFailure('runtime_health_dashboard', 'runtime_health_not_live'))
  }
  if (!artifactOk(artifacts.protected_route_smoke) || (artifacts.protected_route_smoke?.failures || []).length > 0) {
    failures.push(laneFailure('protected_route_smoke', 'protected_route_smoke_failed'))
  }
  if (!artifactOk(artifacts.authenticated_route_smoke)) {
    failures.push(laneFailure('authenticated_route_smoke', 'authenticated_route_smoke_artifact_failed'))
  }
  if (artifacts.authenticated_route_smoke?.owner_visual_proof_claimed === true && artifacts.authenticated_route_smoke?.authenticated_smoke_proven !== true) {
    failures.push(laneFailure('authenticated_route_smoke', 'owner_visual_proof_claimed_without_authenticated_smoke'))
  }
  if (!artifactOk(artifacts.secret_scan) || blockerClass(artifacts.secret_scan) !== 'NONE') {
    failures.push(laneFailure('secret_scan', 'secret_scan_failed'))
  }
  if (!artifactOk(artifacts.raw_path_public_exposure) || blockerClass(artifacts.raw_path_public_exposure) !== 'NONE') {
    failures.push(laneFailure('raw_path_public_exposure', 'raw_path_public_exposure_failed'))
  }
  if (!artifactOk(artifacts.rollback_plan) || blockerClass(artifacts.rollback_plan) !== 'NONE') {
    failures.push(laneFailure('rollback_plan', 'rollback_plan_failed'))
  }
  if (!artifactOk(artifacts.monitoring_failure_states) || artifacts.monitoring_failure_states?.no_fake_live_status !== true || artifacts.monitoring_failure_states?.no_external_writes_executed !== true) {
    failures.push(laneFailure('monitoring_failure_states', 'monitoring_failure_states_failed'))
  }
  if (!artifactOk(artifacts.restart_proof) || blockerClass(artifacts.restart_proof) !== 'NONE') {
    failures.push(laneFailure('restart_proof', 'restart_proof_failed'))
  }

  return failures
}

export function buildRuntimeFinalCloseoutReport(input: {
  checked_at: string
  source_commit: string
  source_branch: string
  artifacts: ArtifactMap
}): RuntimeFinalCloseoutReport {
  const failures = validateArtifacts(input.artifacts)
  const ownerGatedLanes = failures.length
    ? []
    : REQUIRED_RUNTIME_CLOSEOUT_LANES
        .filter((lane) => blockerClass(input.artifacts[lane.id]) === 'OWNER_GATED')
        .map((lane) => lane.id)
  const ok = failures.length === 0
  const blocker = failures.length ? 'BLOCKED' : ownerGatedLanes.length ? 'OWNER_GATED' : 'NONE'

  return {
    ok,
    checked_at: input.checked_at,
    mode: 'runtime_final_closeout',
    status: !ok ? 'BLOCKED' : ownerGatedLanes.length ? 'PARTIAL GO' : 'GO',
    blocker_class: blocker,
    source_commit: input.source_commit,
    source_branch: input.source_branch,
    lanes_checked: REQUIRED_RUNTIME_CLOSEOUT_LANES.length,
    owner_gated_lanes: ownerGatedLanes,
    failures,
    no_fake_go: true,
    no_fake_done: true,
    no_public_exposure_added: true,
    no_external_writes_executed: true,
    rollback: 'git revert <day-72-runtime-final-closeout-commit-sha> && MC_HOSTNAME=127.0.0.1 PORT=3337 bash scripts/start-standalone.sh',
    lanes: buildLaneStatuses(input.artifacts),
  }
}
