import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildAgentMessageEnvelope,
  resolveAgentRoutingLine,
} from './agent-routing-lines';
import { buildAgentHubStatusPayload } from './gateway-agent-hub';
import { buildPiDispatcherStatus } from './bridge-dispatcher-registry';
import { buildPiDispatcherStatusPayload } from './gateway-pi-dispatcher';
import { createGatewayRegistryFromAgentNetwork } from './gateway-model';

const registry = createGatewayRegistryFromAgentNetwork({
  generatedAt: '2026-05-29T20:40:00.000Z',
});

describe('Pi full-access Gateway pipeline identity', () => {
  it('registers Pi as a full-access Gateway agent with a direct Nuclear Gateway line', () => {
    const piLine = resolveAgentRoutingLine('pi');
    expect(piLine).not.toBeNull();
    if (!piLine) throw new Error('pi direct line missing');

    expect(piLine).toMatchObject({
      agent_id: 'pi',
      display_name: 'Pi',
      system_type: 'gateway_full_access_agent',
      direct_line_active: true,
      gateway_route: '/api/bridge/pi/*',
      conversation_owner: 'pi',
      reports_to: 'agent-zero-jarvis',
      openclaw_allowed_role: 'supporting_tool_only',
      opencloud_intermediary_allowed: false,
    });
    expect(piLine.allowed_tools).toEqual(
      expect.arrayContaining([
        'gateway.tools.full_access',
        'gateway.skills.full_access',
        'mcp.registry.full_access',
        'provider.model.full_access',
        'certified_exact_scope_adapters',
        'pipeline.run.request',
        'jarvis.concurrence.request',
      ]),
    );
    expect(piLine.execution_policy).toBe(
      'full_brokered_gateway_access_jarvis_gated_for_production',
    );

    const envelope = buildAgentMessageEnvelope({ target_agent: 'pi' }, piLine);
    expect(envelope.route_trace).toEqual([
      'owner',
      'mission-control',
      'nuclear-gateway',
      'pi',
    ]);
    expect(envelope.direct_line_used).toBe(true);
    expect(envelope.conversation_owner).toBe('pi');
    expect(envelope.opencloud_used).toBe(false);
    expect(envelope.opencloud_role).toBe('not_used');
    expect(envelope.intermediaries).not.toContain('opencloud');
  });

  it('reports Pi Gateway access without dispatcher or read-only language', () => {
    const status = buildPiDispatcherStatusPayload(registry);

    expect(status).toMatchObject({
      mode: 'pi_full_access_gateway_status',
      canonical_gateway_node: 'pi',
      role: 'Full Access Gateway Agent',
      authority: 'gateway_brokered_full_access_under_jarvis',
      status: 'full_access',
      direct_line_active: true,
      tools_enabled: true,
      full_access_to_tools: true,
      full_access_to_skills: true,
      full_access_to_mcp: true,
      execution_enabled: true,
      writes_enabled: true,
      external_writes_enabled: false,
      credential_values_exposed: false,
      production_execution_requires_jarvis_concurrence: true,
      opencloud_intermediary_allowed: false,
    });
    expect(JSON.stringify(status)).not.toContain('Dispatcher / Route Optimizer Candidate');
    expect(JSON.stringify(status)).not.toContain('advisory_only');
    expect(JSON.stringify(status)).not.toContain('pi_runtime_session_not_proven');

    const routeStatus = buildPiDispatcherStatus();
    expect(routeStatus.label).toBe('Pi');
    expect(routeStatus.status).toBe('FULL ACCESS / DIRECT GATEWAY PIPELINE');
    expect(routeStatus.execution_enabled).toBe(true);
    expect(routeStatus.writes_enabled).toBe(true);
    expect(routeStatus.credential_values_exposed).toBe(false);
    expect(routeStatus.pi_full_access_contract).toMatchObject({
      role: 'Full Access Gateway Agent',
      execution_enabled: true,
      writes_enabled: true,
      protected_execution_enabled: true,
    });
    expect(JSON.stringify(routeStatus)).not.toContain('pi_advisory_contract');
  });

  it('shows Pi as a first-class full-access agent in Agent Hub', () => {
    const hub = buildAgentHubStatusPayload(registry);
    const pi = hub.agents.find((agent) => agent.id === 'pi-mono');

    expect(pi).toMatchObject({
      name: 'Pi',
      role: 'Full Access Gateway Agent',
      status: 'full_access_delegated',
      called_true_proven: true,
      routes: { bridge_status: '/api/bridge/pi/status' },
      policy: {
        bridge_session_required_for_writes: true,
        external_writes_enabled: false,
        no_secrets: true,
      },
    });
    expect(pi?.blocked_reason).toBe('production_execution_requires_jarvis_concurrence');
    expect(hub.production_truth.pi_mono).toBe('full_access_gateway_pipeline_agent');

    const serialized = JSON.stringify({ pi, production_truth: hub.production_truth });
    expect(serialized).not.toContain('PI Dispatcher');
    expect(serialized).not.toContain('Dispatcher / Route Optimizer Candidate');
    expect(serialized).not.toContain('read-only dispatcher');
  });

  it('updates owner-facing Pi UI copy away from dispatcher/read-only labels', () => {
    const root = join(__dirname, '..', '..');
    const uiFiles = [
      join(root, 'src/components/gateway-agent-hub/AgentHubControlCenter.tsx'),
      join(root, 'src/components/gateway/GatewayShell.tsx'),
      join(root, 'public/design/gateway/shared/agent-data.js'),
    ];

    for (const file of uiFiles) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toContain('PI Dispatcher');
      expect(source).not.toContain('Dispatcher · Route Optimizer');
      expect(source).not.toContain('READ-ONLY / DISPATCHER REGISTERED');
      expect(source).toContain('Full Access Gateway Agent');
      expect(source).toContain('FULL ACCESS / DIRECT GATEWAY PIPELINE');
    }
  });

  it('keeps Pi API routes named as full-access Gateway surfaces, not dispatcher/advisory surfaces', () => {
    const root = join(__dirname, '..', '..');
    const capabilityMatrix = readFileSync(join(root, 'src/app/api/bridge/capability-matrix/route.ts'), 'utf8');
    const piRecommendRoute = readFileSync(join(root, 'src/app/api/bridge/pi/recommend/route.ts'), 'utf8');
    const dispatcherStatusRoute = readFileSync(join(root, 'src/app/api/bridge/dispatcher/status/route.ts'), 'utf8');

    expect(capabilityMatrix).toContain("label: 'Pi'");
    expect(capabilityMatrix).toContain("role: 'full_access_gateway_agent'");
    expect(capabilityMatrix).toContain('pi_gateway_agent');
    expect(capabilityMatrix).not.toContain("label: 'PI Dispatcher'");
    expect(capabilityMatrix).not.toContain('pi_advisory_contract');

    expect(piRecommendRoute).toContain("mode: 'pi_full_access_gateway_recommendation_route'");
    expect(piRecommendRoute).toContain('full_access_to_tools');
    expect(piRecommendRoute).toContain('pipeline_request_enabled');
    expect(piRecommendRoute).not.toContain('read_only_dispatcher_recommendation');

    expect(dispatcherStatusRoute).toContain("pi_role: 'Full Access Gateway Agent'");
    expect(dispatcherStatusRoute).toContain('pi_full_access_contract');
    expect(dispatcherStatusRoute).toContain('pi_gateway_agent_status');
    expect(dispatcherStatusRoute).not.toContain('pi_advisory_contract');
    expect(dispatcherStatusRoute).not.toContain('pi_dispatcher_status');
  });
});
