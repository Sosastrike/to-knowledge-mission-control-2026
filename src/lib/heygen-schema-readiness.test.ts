import { describe, expect, it } from 'vitest'
import {
  evaluateHeyGenSchemaReadiness,
  type HeyGenSchemaZapierInput,
} from './heygen-schema-readiness'

function bridge(overrides: Partial<HeyGenSchemaZapierInput> = {}): HeyGenSchemaZapierInput {
  return {
    canonical_status: 'READY',
    blocker_class: 'NONE',
    blocker: null,
    heygen_found: true,
    exact_heygen_tool_name: 'mcp__zapier__heygen_create_a_video_from_template',
    required_fields: ['template_id', 'script'],
    heygen_tools: [
      {
        tool_name: 'mcp__zapier__heygen_create_a_video_from_template',
        description: 'Create a HeyGen video from a template.',
        category: 'heygen',
        write_classification: 'write',
        required_fields: ['template_id', 'script'],
        execution_enabled: false,
      },
    ],
    execution_enabled: false,
    writes_enabled: false,
    no_zapier_writes: true,
    ...overrides,
  }
}

describe('HeyGen schema readiness', () => {
  it('reports schema ready when the Zapier HeyGen tool and required fields are visible', () => {
    const result = evaluateHeyGenSchemaReadiness({ zapier: bridge() })

    expect(result).toMatchObject({
      ok: true,
      canonical_status: 'READY',
      blocker_class: 'NONE',
      schema_available: true,
      payload_valid: null,
      accepted_for_generation: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
      bridge_session_required: true,
      approval_required_for_generation: true,
    })
    expect(result.required_fields).toEqual(['template_id', 'script'])
  })

  it('validates a payload without enabling HeyGen generation', () => {
    const result = evaluateHeyGenSchemaReadiness({
      zapier: bridge(),
      payload: { template_id: 'tpl_123', script: 'Short approved script' },
    })

    expect(result).toMatchObject({
      canonical_status: 'READY',
      schema_available: true,
      payload_valid: true,
      missing_fields: [],
      accepted_for_generation: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
    })
  })

  it('blocks invalid payloads with exact missing fields and no fake generation', () => {
    const result = evaluateHeyGenSchemaReadiness({
      zapier: bridge(),
      payload: { template_id: 'tpl_123' },
    })

    expect(result).toMatchObject({
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      blocker: 'heygen_payload_missing_required_fields',
      schema_available: true,
      payload_valid: false,
      missing_fields: ['script'],
      accepted_for_generation: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
    })
  })

  it('keeps HeyGen blocked when the Zapier schema is not visible', () => {
    const result = evaluateHeyGenSchemaReadiness({
      zapier: bridge({
        canonical_status: 'BLOCKED',
        blocker_class: 'BLOCKED',
        blocker: 'MCP server zapier is not present in the Claude MCP configuration.',
        heygen_found: false,
        exact_heygen_tool_name: null,
        required_fields: null,
        heygen_tools: [],
      }),
    })

    expect(result).toMatchObject({
      canonical_status: 'BLOCKED',
      blocker_class: 'BLOCKED',
      blocker: 'MCP server zapier is not present in the Claude MCP configuration.',
      schema_available: false,
      payload_valid: null,
      accepted_for_generation: false,
      execution_enabled: false,
      writes_enabled: false,
      no_heygen_generation: true,
    })
  })
})
