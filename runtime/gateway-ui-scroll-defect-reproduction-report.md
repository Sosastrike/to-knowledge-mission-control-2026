# Gateway UI Scroll Defect Reproduction Report

## Objective
Reproduce and identify the exact scroll/container defect reported by owner on `/gateway/agent-hub`.

## Actions
1. Reviewed active Gateway route components and wrapper stack.
2. Inspected Gateway mount component and page wrappers.
3. Checked for scroll-trap patterns (`h-screen`, `overflow-hidden`, fixed viewport locking).

## Commands / Routes
- `sed -n '1,260p' src/components/gateway/DesignerGatewayMockFrame.tsx`
- `sed -n '1,220p' src/app/gateway/agent-hub/page.tsx`
- `rg -n "overflow-hidden|h-screen|100vh|position:\\s*fixed" src/app src/components`

## Exact Defect Source
- File: `src/components/gateway/DesignerGatewayMockFrame.tsx`
- Offending wrapper: `<main className='h-screen w-full overflow-hidden ...'>`
- Effect: hard viewport lock around iframe mount, causing trapped-scroll behavior in owner flow.

## Proof
- Wrapper was fixed-height (`h-screen`) and clipping (`overflow-hidden`).
- Owner symptom ("stuck/static/trapped frame") matches this lock pattern in production-style shell.

## Blocker / Status
- Status updated: `owner_visual_proof_partial_navigation_layout_defect`
- Gateway owner visual lane remains PARTIAL GO pending owner retest after deployment.

## No-Secrets Confirmation
- No secrets printed.
- No auth file contents printed.
- No `.env` changes made.

## Next Step
Apply scroll-trap removal + visible exit navigation and redeploy for owner retest.
