export type GatewayAiExtractionProxyState = 'READ_ONLY' | 'OWNER_GATED'

export type GatewayAiExtractionProxyStatus = {
  ok: true
  mode: 'gateway_ai_extraction_proxy_read_only'
  generated_at: string
  endpoint: '/api/gateway/extraction/ai'
  proxy_present: true
  browser_cors_solution: 'server_side_proxy_only'
  browser_api_key_exposure_allowed: false
  api_key_exposure_prevented: true
  canonical_gateway_node: 'ocr_specialist'
  canonical_capability: 'ocr_specialist.structured_extraction'
  supported_inputs: string[]
  supported_outputs: string[]
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  owner_approval_required_for_execution: true
  jarvis_concurrence_required: true
  state: GatewayAiExtractionProxyState
  blockers: string[]
  next_action: string
  no_secrets_exposed: true
}

export type GatewayAiExtractionProxyAttempt = {
  mode: 'gateway_ai_extraction_proxy_owner_gated'
  generated_at: string
  endpoint: '/api/gateway/extraction/ai'
  requested_action: 'ai_extraction'
  request_summary: string | null
  document_type: string | null
  output_contract: 'structured_json'
  execution_enabled: false
  writes_enabled: false
  external_writes_enabled: false
  owner_approval_required: true
  jarvis_concurrence_required: true
  approval_request_created: false
  audit_record_written: false
  blocked_reason: 'jarvis_concurrence_required_for_ocr_direct_line'
  blockers: string[]
  safe_browser_contract: {
    browser_calls_mission_control_only: true
    provider_keys_in_browser: false
    cors_to_ai_provider_required: false
    server_side_provider_call_required: true
  }
  next_action: string
  no_secrets_exposed: true
}

const BLOCKERS = [
  'jarvis_concurrence_required_for_ocr_direct_line',
  'ai_extraction_runner_not_enabled',
  'approval_audit_persistence_required_before_execution',
]

const SECRETISH_PATTERN = /(sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)\s*[:=]\s*[^,\s}]+)/gi
const RAW_PATH_PATTERN = /(?:\/home\/tony|\/a0\/|\/tmp|\/var\/folders)[^\s`'"\])}]*/gi

export function buildGatewayAiExtractionProxyStatus(generatedAt = new Date().toISOString()): GatewayAiExtractionProxyStatus {
  return {
    ok: true,
    mode: 'gateway_ai_extraction_proxy_read_only',
    generated_at: generatedAt,
    endpoint: '/api/gateway/extraction/ai',
    proxy_present: true,
    browser_cors_solution: 'server_side_proxy_only',
    browser_api_key_exposure_allowed: false,
    api_key_exposure_prevented: true,
    canonical_gateway_node: 'ocr_specialist',
    canonical_capability: 'ocr_specialist.structured_extraction',
    supported_inputs: ['plain_text', 'public_url_reference', 'pdf_or_image_file_reference', 'ocr_text'],
    supported_outputs: ['structured_json', 'evidence_summary', 'field_confidence_map'],
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    owner_approval_required_for_execution: true,
    jarvis_concurrence_required: true,
    state: 'READ_ONLY',
    blockers: [...BLOCKERS],
    next_action: 'Request Jarvis concurrence for OCR direct-line activation, then wire a scoped server-side extraction runner behind approval/audit persistence.',
    no_secrets_exposed: true,
  }
}

export function buildGatewayAiExtractionProxyAttempt(
  input: Record<string, unknown> = {},
  generatedAt = new Date().toISOString(),
): GatewayAiExtractionProxyAttempt {
  return {
    mode: 'gateway_ai_extraction_proxy_owner_gated',
    generated_at: generatedAt,
    endpoint: '/api/gateway/extraction/ai',
    requested_action: 'ai_extraction',
    request_summary: sanitizeText(input.request || input.prompt || input.summary),
    document_type: sanitizeText(input.document_type || input.type),
    output_contract: 'structured_json',
    execution_enabled: false,
    writes_enabled: false,
    external_writes_enabled: false,
    owner_approval_required: true,
    jarvis_concurrence_required: true,
    approval_request_created: false,
    audit_record_written: false,
    blocked_reason: 'jarvis_concurrence_required_for_ocr_direct_line',
    blockers: [...BLOCKERS],
    safe_browser_contract: {
      browser_calls_mission_control_only: true,
      provider_keys_in_browser: false,
      cors_to_ai_provider_required: false,
      server_side_provider_call_required: true,
    },
    next_action: 'Do not call an AI provider from the browser. Use this backend proxy after Jarvis concurrence and approval/audit persistence are wired.',
    no_secrets_exposed: true,
  }
}

function sanitizeText(value: unknown): string | null {
  const text = String(value || '')
    .replace(SECRETISH_PATTERN, '[redacted-secret]')
    .replace(RAW_PATH_PATTERN, '[redacted-path]')
    .trim()
  return text ? text.slice(0, 500) : null
}
