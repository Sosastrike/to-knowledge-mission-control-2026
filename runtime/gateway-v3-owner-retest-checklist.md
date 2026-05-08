# Gateway v3 Owner Re-Test Checklist

## Objective
Give the owner exact steps to verify the fixed Gateway/Agent Hub UI in production.

## Owner Re-Test Steps
1. Log in to Mission Control.
2. Open `/gateway`.
3. Confirm Gateway tab rail is visible:
   - Overview
   - Routes
   - Registry
   - Policies / Bridge
   - Health
   - Dispatcher
   - Token Governor
   - Agent Hub
4. Click **Agent Hub**.
5. Confirm top exit controls are visible above the fold:
   - Mission Control Home
   - Dashboard
   - Gateway Overview
   - Agent Hub
6. Confirm breadcrumb is clickable:
   - Mission Control / Gateway / Agent Hub
7. Scroll down to bottom of Agent Hub page.
8. Scroll back to top.
9. Click **Gateway Overview** and confirm page loads.
10. Click **Mission Control Home** and confirm page loads.
11. Open `/agent-network` and verify it lands on Gateway Agent Hub.
12. Open `/agents` and verify it lands on Gateway Agent Hub.
13. Confirm each alias page still exposes a clear way back to Gateway and Mission Control.
14. Confirm no fake buttons are present.
15. Confirm no raw paths or secrets are shown in UI.

## Expected Result
- Navigation is not trapped.
- Scroll behavior is natural.
- Gateway FULL v3 feels embedded in Mission Control shell.

## Blocker Mapping
- If owner cannot see exits/breadcrumbs: `owner_visual_proof_partial_navigation_layout_defect`
- If owner cannot scroll naturally: `gateway_scroll_layout_trap_persists`
- If alias routes do not land correctly: `gateway_alias_routing_regression`

## No-Secrets Confirmation
- Checklist does not request tokens or secrets.
- No auth-file actions required.

## Exact Next Step
- Owner shares pass/fail notes for each step so final UI decision can be set to GO or remain PARTIAL.
