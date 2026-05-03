# OpenCloud / Agent Zero Replacement Readiness Decision

Date: 2026-05-03

## Decision

Do not destroy OpenCloud yet.

OpenCloud can be considered for a reversible staged disable only after a replacement Build-Wiki source/farmer is live, tested, and running in parallel. Agent Zero is now strong enough to see, report, plan, and route Build-Wiki actions, but it does not yet replace the OpenCloud docs farmer itself.

## Evidence Checked

Live service status:

- `mission-control.service`: active
- `claudeclaw.service`: active
- `opencloud-docs-farmer.timer`: active
- `opencloud-docs-farmer.service`: inactive between runs, which is normal for the oneshot farmer
- Agent Zero container: running
- Agent Zero health: HTTP 200, version M v1.9

Live Mission Control route checks:

- `/api/bridge/brain-sync/build-wiki/status`: HTTP 200
- `/api/bridge/brain-sync/status`: HTTP 200
- `/api/bridge/brain-context`: HTTP 200
- `/api/bridge/providers`: HTTP 200, 9 providers visible
- `/api/bridge/agent-zero/status`: HTTP 200

Live Build-Wiki status:

- Build-Wiki sync state: active
- Health: healthy
- Backend status: live
- Active farmer: `opencloud-docs-farmer`
- Timer: active and enabled
- Last run: success, exit code 0
- Run Now scope: `opencloud-docs-farmer.service`
- Controls: Run Now remains owner-approval gated
- External farmer / SMB Fork 2: still blocked until SMB is mounted and verified

Live Brain status:

- Brain Sync is read-only available.
- Build-Wiki is a live Brain Sync source.
- Obsidian is visible/read-only with 1,108 markdown files.
- MemPalace is visible/read-only/status-safe with 676 entries.
- Graphify is visible/read-only/status-safe.
- Direct shared brain writes and MemPalace writes remain disabled from this layer.

## What OpenCloud Provides Today

OpenCloud currently provides the Build-Wiki substrate:

- Scheduled local docs farmer through `opencloud-docs-farmer.timer`
- One-shot farmer execution through `opencloud-docs-farmer.service`
- Build-Wiki raw/wiki/archive content used by Mission Control status surfaces
- Source material for Brain Sync `build_wiki`
- Owner-approved Run Now target for Tony and Agent Zero Bridge Session workflows
- Last-run status, timer status, logs, and content counts for Mission Control

## What Agent Zero Replaces

Agent Zero now replaces or covers the orchestration/visibility layer:

- Can see Mission Control through Bridge context.
- Can see Bridge/MCP, tools, integrations, models, skills, and agents.
- Can see Build-Wiki/Farmer status read-only.
- Can see Brain Sync, Obsidian, MemPalace, and Graphify status/read adapters.
- Can create Mission Control reports without raw local path exposure.
- Can report blockers honestly.
- Can plan Google Drive and OneDrive delivery without fake upload claims.
- Can request/reuse a Bridge Session approval without spam.
- Can run scoped Build-Wiki action only if an active owner-approved Bridge Session exists.

Agent Zero does not yet replace the farmer that produces or refreshes Build-Wiki content.

## What Still Depends On OpenCloud

These are still OpenCloud-dependent:

- Build-Wiki content refresh
- `opencloud-docs-farmer.timer`
- `opencloud-docs-farmer.service`
- Build-Wiki Run Now dispatch target
- Build-Wiki raw/wiki/archive counts
- Brain Sync `build_wiki` source freshness
- Mission Control Build-Wiki status route accuracy
- Tony / Agent Zero run-now workflows that target the current farmer service
- Existing owner reports and audit records that refer to the OpenCloud docs farmer

## What Breaks If OpenCloud Is Destroyed

Destroying OpenCloud now would likely cause:

- Build-Wiki timer and service target to disappear.
- Run Now to fail because the scoped service would no longer exist.
- Build-Wiki status to degrade or go stale.
- Brain Sync `build_wiki` source to stop refreshing.
- Agent Zero to lose current Build-Wiki/Farmer visibility.
- Tony and Agent Zero Build-Wiki run workflows to become blocked or failed.
- OpenCloud wiki/raw/archive material to be unavailable unless archived first.
- Existing reports and audit records to reference a retired system without a live rollback surface.

## Safe Disable Plan

Do not run these steps until the owner approves the disable phase.

1. Snapshot evidence:
   - Export current Build-Wiki status JSON.
   - Archive OpenCloud raw/wiki/archive content.
   - Archive farmer logs.
   - Record current systemd timer/service state.
   - Record latest Brain Sync counts and last-sync timestamps.

2. Prepare replacement:
   - Build an Agent Zero or Mission Control native farmer that does not depend on OpenCloud.
   - Wire the replacement as a new Build-Wiki provider/adapter.
   - Keep old OpenCloud farmer active while the replacement runs in parallel.

3. Parallel proof:
   - Run old and new Build-Wiki paths side by side for at least one full schedule window.
   - Compare raw/wiki counts, freshness, errors, and Mission Control display.
   - Verify Brain Sync sees the replacement source.
   - Verify Agent Zero can see the replacement status.
   - Verify Run Now targets the replacement service and remains Bridge Session/owner-approval gated.

4. Reversible disable:
   - Stop the timer first, not the data.
   - Leave the service, content, logs, and reports in place.
   - Confirm Mission Control shows a paused/disabled state rather than a false healthy state.
   - Confirm Brain Sync warns when Build-Wiki source becomes stale.

5. Destructive removal:
   - Only after owner approval, backup verification, replacement proof, and rollback rehearsal.

## Rollback Plan

If the disable phase causes regressions:

1. Re-enable the OpenCloud docs farmer timer.
2. Start the scoped farmer service once.
3. Verify Build-Wiki status returns to active/healthy.
4. Verify Brain Sync sees fresh Build-Wiki source timestamps.
5. Repoint Run Now to `opencloud-docs-farmer.service` if any route was changed.
6. Restore archived OpenCloud raw/wiki/archive content if needed.
7. Re-run Agent Zero Build-Wiki visibility test.

## Final Recommendation

OpenCloud is not ready to destroy.

The safest next step is not destruction. The safest next step is a replacement-farmer design and parallel-run proof. After that, OpenCloud can be disabled reversibly. Destruction should be treated as a later owner-approved cleanup phase.
