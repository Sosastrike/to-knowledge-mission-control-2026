# Agent Zero Hermes Build-Wiki / OpenCloud Dependency Proof

Date: 2026-05-04

## Scope

This report covers Phases 61-70 of the Agent Zero plus Hermes live-proof plan:

- Build-Wiki status proof.
- Hermes Build-Wiki suggestion proof.
- Agent Zero Build-Wiki execution rule proof.
- Build-Wiki no-execution prompt proof.
- Exact-scope adapter check.
- Approved execution decision.
- Fork 1 and Fork 2/SMB status.
- OpenCloud dependency map.

No secrets, API keys, auth files, or `.env` values were printed or committed.

## Safety Result

- Farmer execution: not run.
- Zapier writes: not run.
- HeyGen generation: not run.
- SMB mount: not attempted.
- External farmers: not run.
- Bridge Session execution: not used in this phase.
- `.env` changes: none.
- Raw secret reads: none.

## Build-Wiki / Farmer Status

Agent Zero can see Build-Wiki/Farmer status through Mission Control read-only context.

Production service proof:

- `opencloud-docs-farmer.timer`: active.
- `opencloud-docs-farmer.service`: inactive after a successful oneshot timer run.
- Build-Wiki status route: authenticated 200.
- Build-Wiki status route without auth: 401.
- Build-Wiki status payload: read-only, healthy, connected, and scoped to `opencloud-docs-farmer.service`.

Phase 61 status: completed.

## Agent Zero Build-Wiki Rule Proof

Agent Zero was asked to prepare Build-Wiki Run Now without executing it. The response correctly stated that Run Now is prepared but not executed, requires owner-approved Bridge Session approval, and remains scoped only to `opencloud-docs-farmer.service`.

Agent Zero was also asked whether Build-Wiki Run Now needs Bridge Session approval. The response correctly repeated the Bridge Session requirement.

Phase 63 status: completed.
Phase 64 status: completed.

## Hermes Build-Wiki Suggestion Proof

Hermes Build-Wiki suggestion proof is blocked in production.

Production POST to the Hermes test-chat route still returned 405, so Mission Control did not prove `hermes_called:true` for the Build-Wiki suggestion prompt.

Result:

- Hermes can remain shown as lieutenant/read-only context pending.
- Hermes must not be marked live-integrated for Build-Wiki suggestions yet.
- No Hermes execution occurred.

Phase 62 status: blocked by stale production POST route.

## Exact-Scope Adapter Check

Source and tests prove that Build-Wiki Run Now execution is scoped only to:

```text
systemctl --user start opencloud-docs-farmer.service
```

The adapter path records:

- action: `buildwiki.run_now`.
- target service: `opencloud-docs-farmer.service`.
- no broad external farmers.
- no SMB/Fork 2 execution.
- audit/report events are required.
- active Bridge Session is required before dispatch.

The dispatch implementation uses `systemctl` with fixed arguments and no arbitrary shell command expansion.

Targeted tests passed:

- `src/lib/agent-zero-execution-gateway.test.ts`
- `src/lib/hermes-bridge.test.ts`

Result: 30 tests passed.

Phase 65 status: completed.

## Approved Execution Decision

Approved execution was not performed in this phase because no active Bridge Session with the required owner scope was used.

Expected behavior remains:

- no Bridge Session: block with active Bridge Session required.
- active scoped Bridge Session: run only `systemctl --user start opencloud-docs-farmer.service`.
- unavailable or out-of-scope connectors: remain blocked.

Phase 66 status: blocked by no active Bridge Session.

## Fork 1 Status

Fork 1 is the available safe path.

Fork 1 means:

- Mission Control can read Build-Wiki/Farmer status.
- Build-Wiki Run Now is scoped to the local farmer service.
- Agent Zero can prepare the run and explain the approval requirement.
- Actual execution remains Bridge Session gated.

Phase 67 status: completed.

## Fork 2 / SMB Status

Fork 2 / SMB remains blocked.

No SMB mount was attempted. No SMB farmer was run. No credentials were requested, guessed, printed, or written.

Current blocker:

- SMB mount and safe prerequisite approval have not been proven for this phase.

Phase 68 status: completed as blocked.

## OpenCloud Dependency Map

OpenCloud still provides important live substrate for the Build-Wiki path.

OpenCloud currently provides:

- Build-Wiki content refresh and freshness substrate.
- The user timer and service backing the farmer.
- Raw/wiki/archive source content used by the Build-Wiki path.
- Brain Sync `build_wiki` source freshness.
- Mission Control Build-Wiki/Farmer status.
- The exact Run Now target used by Agent Zero and legacy workflows.

Agent Zero currently replaces or adds:

- Owner-facing command, planning, and reporting.
- Mission Control live visibility.
- Build-Wiki status explanation.
- Bridge Session gated Run Now preparation.
- Adapter-scoped execution model.
- Honest blocked-state reporting for Fork 2/SMB and missing connectors.

Agent Zero does not yet replace:

- The OpenCloud-backed content substrate.
- The Build-Wiki/Farmer data source.
- The active farmer timer/service dependency.
- Any SMB/Fork 2 farmer path.

If OpenCloud were destroyed now, likely breakage includes:

- Build-Wiki freshness.
- Brain Sync `build_wiki` freshness.
- Mission Control Build-Wiki/Farmer status confidence.
- Run Now target availability.
- Agent Zero's live Build-Wiki visibility.

Recommendation:

- Keep OpenCloud.
- Do not destroy or delete OpenCloud yet.
- Only consider reversible disable/archive later after replacement coverage, backups, rollback, and owner approval are proven.

Phase 69 status: completed.

## Phase Status Table

| Phase | Result | Notes |
| --- | --- | --- |
| 61 | Completed | Agent Zero sees timer/service status through Build-Wiki status route. |
| 62 | Blocked | Hermes POST test-chat returned 405; no `hermes_called:true`. |
| 63 | Completed | Agent Zero explains Bridge Session / approval requirement. |
| 64 | Completed | Agent Zero prepared Run Now without execution. |
| 65 | Completed | Source/tests prove exact service-only command scope. |
| 66 | Blocked | No active Bridge Session was used; no execution performed. |
| 67 | Completed | Fork 1 is the available safe path. |
| 68 | Completed as blocked | Fork 2/SMB remains blocked; no mount attempted. |
| 69 | Completed | OpenCloud dependency map says keep; destroy is not safe. |
| 70 | Completed by commit | This report records the proof. |

## Final Status

Build-Wiki/OpenCloud status: PARTIAL GO.

Reason:

- Agent Zero can see Build-Wiki/Farmer status.
- Agent Zero correctly blocks or prepares Run Now without execution.
- Exact-scope adapter tests pass.
- Fork 1 is available.
- Fork 2/SMB remains blocked.
- Hermes live Build-Wiki suggestion proof remains blocked by the stale production POST route.
- OpenCloud destruction is not safe.

Rollback for this proof commit:

```text
git revert <commit>
```
