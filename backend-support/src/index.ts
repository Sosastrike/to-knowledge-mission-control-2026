// Public surface CloudCode hands to Codex.
// All inputs are loose / nullable; all outputs are canonical and safe to render.
export * from './types'
export {
  normalizeStatusLabel,
  rollupStatuses,
} from './label-map'
export {
  redactString,
  redactObject,
  redactOrigin,
} from './redact'
export {
  normalizeGatewayStatus,
} from './status-normalizer'
export type {
  RawStatusInput,
  RawComponent,
  RawBridge,
  RawBuildWiki,
  RawBlocker,
} from './status-normalizer'
export {
  ROUTE_SMOKE_TARGETS,
  runRouteSmoke,
  buildRouteSmokeReport,
} from './route-smoke'
export type { PrefetchedRouteResult } from './route-smoke'
export {
  AGENT_ROSTER,
  buildAgentHealth,
} from './agent-probes'
export type { AgentId, AgentProbeInput } from './agent-probes'
export {
  ROUTE_METADATA,
  getRouteMetadata,
  getBreadcrumbTrail,
} from './route-metadata'
export {
  BUILDWIKI_TARGET_SERVICE,
  BUILDWIKI_FORK1_FORBIDDEN,
  buildBuildWikiStatus,
  evaluateRunNowGate,
} from './buildwiki-status'
export type {
  BuildWikiRawInput,
  BuildWikiRawTelegramApproval,
  BuildWikiRawSystemd,
  RunNowGateInput,
  RunNowGateOutput,
} from './buildwiki-status'
export {
  classifyError,
  classifyErrors,
} from './error-classifier'
export type { ClassifierInput } from './error-classifier'
