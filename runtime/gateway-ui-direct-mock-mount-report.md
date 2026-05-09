# Gateway UI Direct Mock Mount Report

## Objective
Confirm direct FULL v3 mock mounting remains the active rendering path.

## Route-to-Mock Mapping
- `/gateway` -> `Gateway Overview.html`
- `/gateway/agent-hub` -> `Agent Hub.html`
- `/gateway/agent-hub/paperclip` -> `Paperclip.html`
- `/gateway/routes` -> `Gateway Routes.html`
- `/gateway/registry` -> `Gateway Registry.html`
- `/gateway/policies` -> `Gateway Policies.html`
- `/gateway/health` -> `Gateway Health.html`
- `/gateway/dispatcher` -> `Dispatcher.html`
- `/gateway/token-governor` -> `Token Governor.html`
- `/gateway/bridge-session` -> `Bridge Session Flow.html`
- `/gateway/node-detail` -> `Gateway Node Detail.html`
- `/gateway/mobile-tablet` -> `Gateway Mobile Tablet.html`

## Mount Mechanism
- Component: `src/components/gateway/DesignerGatewayMockFrame.tsx`
- Source URL base: `/designer-mission-control/design/gateway/`

## Hydration Note
- Agent Hub shared data path still supports live status hydration flow through existing status endpoint wiring.
- No fake "connected" status added where backend proof is missing.

## Blocker
- Owner visual retest pending after deploy/restart.

## No-Secrets Confirmation
- No secret values printed.
- No `.env` changes.

## Next Step
Deploy current commit and ask owner to validate mounted FULL v3 pages in authenticated session.
