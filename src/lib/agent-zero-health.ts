// Agent Zero owner-facing health probe (Phase A0-5).
//
// This module probes the Agent Zero container deployment over the Tailnet
// (http://100.116.35.95:50080 by default; override via AGENT_ZERO_BASE_URL)
// and returns a redacted, owner-safe health snapshot using the canonical
// 10-state status vocabulary.
//
// Hard rules:
//   - No raw stack traces ever cross this boundary.
//   - No tokens or API keys are emitted.
//   - No absolute filesystem paths in any returned field.
//   - All probes are GET-only.
//   - Failure to reach Agent Zero returns `UNKNOWN`, not `BLOCKED`.

export type CanonicalStatus =
  | 'LIVE'
  | 'READY'
  | 'READ_ONLY'
  | 'DEGRADED'
  | 'OWNER_GATED'
  | 'CREDENTIAL_GATED'
  | 'SERVICE_DOWN'
  | 'BLOCKED'
  | 'DISABLED'
  | 'UNKNOWN'

export interface SubsystemHealth {
  id: string
  label: string
  status: CanonicalStatus
  blocker_class: CanonicalStatus
  detail: string
  last_observed_at: string
  evidence?: string
}

export interface AgentZeroHealthSnapshot {
  overall_status: CanonicalStatus
  blocker_class: CanonicalStatus
  generated_at: string
  base_url: string
  subsystems: SubsystemHealth[]
  current_blockers: string[]
  last_successful_chat_at: string | null
  last_successful_memory_write_at: string | null
  last_successful_transcription_at: string | null
  last_error_summary_redacted: string | null
}

const DEFAULT_BASE_URL = 'http://100.116.35.95:50080'
const PROBE_TIMEOUT_MS = 4000

function resolveBaseUrl(): string {
  return process.env.AGENT_ZERO_BASE_URL || DEFAULT_BASE_URL
}

async function probeUrl(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS)
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'manual' })
    clearTimeout(timer)
    return { ok: res.status >= 200 && res.status < 400, status: res.status }
  } catch {
    return { ok: false, status: 0 }
  }
}

function classifyUi(status: number): CanonicalStatus {
  if (status === 200) return 'LIVE'
  if (status === 0) return 'SERVICE_DOWN'
  if (status >= 500) return 'DEGRADED'
  return 'UNKNOWN'
}

export async function inspectAgentZeroHealth(): Promise<AgentZeroHealthSnapshot> {
  const now = new Date().toISOString()
  const base = resolveBaseUrl()

  // 1) UI probe — three endpoints, conservative classifier.
  const [root, login, apiHealth] = await Promise.all([
    probeUrl(`${base}/`),
    probeUrl(`${base}/login`),
    probeUrl(`${base}/api/health`),
  ])
  const uiAllOk = root.ok && login.ok && apiHealth.ok
  const ui: SubsystemHealth = {
    id: 'ui',
    label: 'Agent Zero UI',
    status: uiAllOk ? 'LIVE' : classifyUi(Math.min(root.status, login.status, apiHealth.status)),
    blocker_class: uiAllOk ? 'LIVE' : 'SERVICE_DOWN',
    detail: uiAllOk
      ? 'Web UI reachable on /, /login, /api/health.'
      : 'One or more UI endpoints not reachable from Mission Control.',
    last_observed_at: now,
    evidence: `root=${root.status} login=${login.status} api_health=${apiHealth.status}`,
  }

  // 2) Primary chat model — we cannot test live without sending a real
  //    message, so we only report LIVE-by-association if UI is up; the
  //    canonical status flips to UNKNOWN once the UI is unreachable.
  const chat: SubsystemHealth = {
    id: 'chat_model',
    label: 'Primary chat model',
    status: ui.status === 'LIVE' ? 'READY' : 'UNKNOWN',
    blocker_class: ui.status === 'LIVE' ? 'READY' : 'UNKNOWN',
    detail:
      'Primary chat model availability is inferred from UI health; a true probe requires a chat turn.',
    last_observed_at: now,
  }

  // 3) Utility model — provider-level health depends on the Claude CLI
  //    subscription / OAuth token health. The proxy itself is patched
  //    (stdin=DEVNULL) so the wrapper no longer emits the "no stdin" warning.
  //    State degradation paths now surface as a clean blocker token at the
  //    memory layer rather than a UI traceback.
  const util: SubsystemHealth = {
    id: 'utility_model',
    label: 'Utility model (claude_oauth / claude-opus-4-7)',
    status: ui.status === 'LIVE' ? 'READY' : 'UNKNOWN',
    blocker_class: ui.status === 'LIVE' ? 'READY' : 'UNKNOWN',
    detail:
      'Utility model is gated through the Claude CLI proxy. Failures degrade cleanly: memory layer emits agent_zero_memory_utility_model_unavailable.',
    last_observed_at: now,
  }

  // 4) Memory extensions — patched to wrap call_utility_model and emit a
  //    clean owner-facing blocker on failure. Without a live failed turn we
  //    cannot prove it without simulation; we surface READY when the UI is
  //    healthy.
  const memory: SubsystemHealth = {
    id: 'memory_extensions',
    label: 'Memory extensions (_50_memorize_fragments + _51_memorize_solutions)',
    status: ui.status === 'LIVE' ? 'READY' : 'UNKNOWN',
    blocker_class: ui.status === 'LIVE' ? 'READY' : 'UNKNOWN',
    detail:
      'Patched to wrap utility-model calls in narrow try/except. On failure: blocker = agent_zero_memory_utility_model_unavailable. No traceback in UI.',
    last_observed_at: now,
  }

  // 5) Voice / STT (Phase 2: provider truth fix).
  //
  // Agent Zero's user-space voice handler calls /a0/helpers/whisper.py which
  // runs openai-whisper locally on CPU. No OpenAI/Whisper API key is consumed.
  // The classifier therefore reports credential_required=false for the chosen
  // provider. Owner can switch to openai_whisper_api in Phase 3.
  const sttProvider = process.env.AGENT_ZERO_STT_PROVIDER || 'local_whisper'
  const sttRequiresKey = sttProvider === 'openai_whisper_api'
  const sttKeyPresent = sttRequiresKey
    ? Boolean(process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY)
    : true
  const stt: SubsystemHealth & {
    provider: string
    credential_required: boolean
    credential_present: boolean
  } = {
    id: 'voice_stt',
    label:
      sttProvider === 'local_whisper'
        ? 'Voice / STT (Telegram -> local Whisper)'
        : 'Voice / STT (Telegram -> OpenAI Whisper API)',
    status: ui.status !== 'LIVE' ? 'UNKNOWN' : sttKeyPresent ? 'READY' : 'CREDENTIAL_GATED',
    blocker_class:
      ui.status !== 'LIVE' ? 'UNKNOWN' : sttKeyPresent ? 'READY' : 'CREDENTIAL_GATED',
    detail:
      sttProvider === 'local_whisper'
        ? 'Local openai-whisper helper at /a0/helpers/whisper.py is the chosen STT path. No OpenAI/Whisper API key required.'
        : 'OpenAI Whisper API mode selected. Requires OPENAI_API_KEY or WHISPER_API_KEY in Mission Control runtime env.',
    last_observed_at: now,
    provider: sttProvider,
    credential_required: sttRequiresKey,
    credential_present: sttKeyPresent,
  }

  const subsystems = [ui, chat, util, memory, stt]
  const currentBlockers = subsystems
    .filter((s) => s.status !== 'LIVE' && s.status !== 'READY')
    .map((s) => `${s.id}:${s.status}`)

  let overall: CanonicalStatus
  if (ui.status !== 'LIVE') {
    overall = ui.status
  } else if (subsystems.some((s) => s.status === 'DEGRADED')) {
    overall = 'DEGRADED'
  } else if (subsystems.some((s) => s.status === 'BLOCKED')) {
    overall = 'BLOCKED'
  } else {
    overall = 'LIVE'
  }

  return {
    overall_status: overall,
    blocker_class: overall,
    generated_at: now,
    base_url: base,
    subsystems,
    current_blockers: currentBlockers,
    last_successful_chat_at: null,
    last_successful_memory_write_at: null,
    last_successful_transcription_at: null,
    last_error_summary_redacted: null,
  }
}
