
import { describe, expect, it } from 'vitest'
import { buildModelRouteSelectionPayload, groupModelRoutes, normalizeModelRouteCatalog } from './agent-platform-model-routes'

describe('agent platform model route client contract', () => {
  it('normalizes direct, aggregator, local, and disabled routes without credentials', () => {
    const catalog = normalizeModelRouteCatalog({
      ok: true,
      catalog_version: 'model_route_catalog.v1',
      routes: [
        { route_id: 'google_direct/gemini-2.5-pro', provider_id: 'google_direct', provider_display_name: 'Google Direct', provider_model_id: 'gemini-2.5-pro', model_display_name: 'Gemini 2.5 Pro', access_path: 'direct', deployment_type: 'cloud', data_destination: 'cloud:google', capabilities: ['text', 'tools'], context_limit: 100, output_limit: 10, streaming_support: true, tool_support: true, structured_output_support: true, image_support: false, reasoning_support: true, cost_class: 'standard', latency_class: 'interactive', health_state: 'healthy', circuit_state: 'closed', enabled: true, available: true, selectable_scopes: ['THIS_JOB'], fallback_support: ['STRICT'], credential_present: true },
        { route_id: 'openrouter/openai/gpt-4o', provider_id: 'openrouter', provider_display_name: 'OpenRouter', provider_model_id: 'openai/gpt-4o', model_display_name: 'GPT-4o via OpenRouter', access_path: 'aggregator', deployment_type: 'cloud', data_destination: 'cloud:openrouter', capabilities: ['text'], context_limit: 100, output_limit: 10, streaming_support: true, tool_support: false, structured_output_support: false, image_support: false, reasoning_support: true, cost_class: 'standard', latency_class: 'interactive', health_state: 'healthy', circuit_state: 'closed', enabled: true, available: true, selectable_scopes: ['THIS_JOB'], fallback_support: ['STRICT'] },
        { route_id: 'local_vllm/qwen3', provider_id: 'local_vllm', provider_display_name: 'Local vLLM', provider_model_id: 'qwen3', model_display_name: 'Qwen3', access_path: 'local', deployment_type: 'local', data_destination: 'local:self-hosted', capabilities: ['text'], context_limit: 100, output_limit: 10, streaming_support: true, tool_support: false, structured_output_support: false, image_support: false, reasoning_support: true, cost_class: 'fixed', latency_class: 'local', health_state: 'healthy', circuit_state: 'closed', enabled: true, available: true, selectable_scopes: ['THIS_JOB'], fallback_support: ['STRICT'] },
        { route_id: 'google_direct/gemini-disabled', provider_id: 'google_direct', provider_display_name: 'Google Direct', provider_model_id: 'gemini-disabled', model_display_name: 'Gemini disabled', access_path: 'direct', deployment_type: 'cloud', data_destination: 'cloud:google', capabilities: [], context_limit: 0, output_limit: 0, streaming_support: false, tool_support: false, structured_output_support: false, image_support: false, reasoning_support: false, cost_class: 'unknown', latency_class: 'unknown', health_state: 'disabled', circuit_state: 'closed', enabled: false, available: false, disabled_reason: 'credential unavailable', selectable_scopes: [], fallback_support: ['STRICT'], credential_present: false },
      ],
    })

    expect(catalog.routes).toHaveLength(4)
    const groups = groupModelRoutes(catalog.routes || [])
    expect(groups.map((group) => group.label)).toEqual(['Local / Self-hosted', 'Google Gemini Direct', 'OpenRouter'])
    expect(JSON.stringify(catalog)).not.toContain('credential_present')
    expect(catalog.routes?.find((route) => route.route_id === 'google_direct/gemini-disabled')?.disabled_reason).toBe('credential unavailable')
  })

  it('builds canonical selection payload with strict fallback by default', () => {
    expect(buildModelRouteSelectionPayload({ requested_route_id: 'google_direct/gemini-2.5-pro' })).toMatchObject({
      requested_route_id: 'google_direct/gemini-2.5-pro',
      selection_scope: 'THIS_JOB',
      fallback_policy: 'STRICT',
    })
  })
})
