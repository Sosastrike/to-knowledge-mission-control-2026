# Phase 5 - Pi Gateway / Agent Hub Proof Report

## Result

**PARTIAL GO / SHADOW.** Gateway and Agent Hub expose Pi truthfully as Pi-mono / Dispatcher Candidate. Owner-auth visual proof still requires an owner session.

## Route Proof

| Route | Unauthenticated result | Expected |
|---|---:|---|
| /api/gateway/nodes/pi | 401 | protected |
| /api/bridge/pi/status | 401 | protected |
| /api/gateway/agent-hub/agents/pi-mono | protected by app auth tests | protected |
| /api/gateway/agent-hub/agents/pi-mono/health | protected by app auth tests | protected |

## Node Truth

| Field | Value |
|---|---|
| Role | Dispatcher / Route Optimizer Candidate |
| Status | shadow / partial |
| Execution | disabled |
| Writes | disabled |
| Agent Hub roster | Paperclip, Agent Zero, Hermes, SpaceAgent, Pi-mono |

## Standing Governance

| Rule | Result |
|---|---|
| Secrets printed | No |
| Auth weakened | No |
| .env changed | No |
| Public local service exposure | No |
| SMB/Fork 2 | Not run |
| Zapier/HeyGen writes | Not run |
| External farmers | Not run |
| Architecture naming | OpenClaw+ used as runtime layer; literal legacy service name retained only where required |

## Pi Inclusion

| Field | Current truth |
|---|---|
| Role | Dispatcher / Route Optimizer Candidate |
| Authority | Advisory only; Agent Zero remains commander |
| Execution | Disabled |
| Writes | Disabled |
| Baseline from owner | 35% DESIGN / PENDING / SHADOW |
| Current evidence-based status | 72% PARTIAL GO / SHADOW after Gateway route and recommendation tests |
| Current blocker | Standalone Pi runtime session not proven; in-process Gateway shadow dispatcher is proven |
