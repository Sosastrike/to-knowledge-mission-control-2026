# OpenCloud Safe Disable Proof

Date: 2026-05-03

## Decision

OpenCloud / Build-Wiki was not disabled in this pass.

The previous readiness decision concluded that OpenCloud is still the live Build-Wiki substrate. Agent Zero can see, report, plan, and route Build-Wiki work through Mission Control, but it does not yet replace the current OpenCloud docs farmer that refreshes Build-Wiki content.

Because the disable gate still depends on replacement proof or explicit owner waiver, no service was stopped and no timer was disabled.

## Disable Action Status

- Data deletion: not performed.
- OpenCloud data removal: not performed.
- `opencloud-docs-farmer.timer` stop/disable: not performed.
- `opencloud-docs-farmer.service` stop: not needed; service was already inactive between oneshot runs.
- Mission Control: preserved.
- Agent Zero: preserved.
- Bridge/MCP: preserved.
- ClaudeClaw: preserved.
- Build-Wiki data and reports: preserved.

## Live Evidence

Service state before the gated disable decision:

- `mission-control.service`: active
- `claudeclaw.service`: active
- `opencloud-docs-farmer.timer`: active
- `opencloud-docs-farmer.service`: inactive between scheduled/approved runs
- Agent Zero container: running
- Agent Zero health: previously verified HTTP 200, version M v1.9

Authenticated Mission Control route checks:

- `/api/bridge/agent-zero/status`: HTTP 200
- `/api/bridge/brain-sync/build-wiki/status`: HTTP 200

Current Build-Wiki state remains active, so disabling the timer now would intentionally pause the current live content refresh path.

## What Would Break If Disabled Today

Stopping or disabling OpenCloud / Build-Wiki farmer before a replacement farmer is stable would risk:

- Build-Wiki source freshness becoming stale.
- Brain Sync `build_wiki` source no longer refreshing.
- Mission Control Build-Wiki status degrading from live to paused/stale.
- Agent Zero losing the live Build-Wiki/Farmer status it currently reports.
- Owner-approved Run Now targeting a disabled service/timer surface.
- Existing Tony and Agent Zero Build-Wiki workflows becoming blocked until a replacement target is wired.

## Safe Disable Plan

When owner explicitly approves a reversible disable after replacement proof or waiver:

1. Preserve data first:
   - Archive current Build-Wiki raw/wiki/archive content.
   - Preserve farmer logs and latest run status.
   - Preserve Mission Control reports and audit evidence.

2. Pause scheduling, not data:
   - Stop the timer.
   - Disable the timer.
   - Leave content, logs, routes, reports, Agent Zero, Mission Control, Bridge/MCP, and ClaudeClaw intact.

3. Verify expected paused state:
   - Mission Control should show Build-Wiki as paused/stale, not falsely healthy.
   - Brain Sync should show stale source warnings when freshness expires.
   - Agent Zero should still answer through Mission Control and report the disabled Build-Wiki state honestly.

4. Keep destruction out of this phase:
   - Do not remove OpenCloud data.
   - Do not remove services or unit files.
   - Do not delete reports, logs, or archives.

## Commands For A Future Approved Reversible Disable

These commands were not run in this pass:

```bash
systemctl --user stop opencloud-docs-farmer.timer
systemctl --user disable opencloud-docs-farmer.timer
systemctl --user stop opencloud-docs-farmer.service || true
systemctl --user is-active opencloud-docs-farmer.timer || true
systemctl --user is-enabled opencloud-docs-farmer.timer || true
```

## Rollback Plan

If a future disable causes regressions:

```bash
systemctl --user enable opencloud-docs-farmer.timer
systemctl --user start opencloud-docs-farmer.timer
systemctl --user start opencloud-docs-farmer.service
systemctl --user is-active opencloud-docs-farmer.timer
```

Then verify:

- Build-Wiki status returns through Mission Control.
- Brain Sync sees the Build-Wiki source again.
- Agent Zero still answers through Mission Control.
- Run Now remains scoped to `opencloud-docs-farmer.service` and approval/Bridge Session gated.

## Sensitive Data Confirmation

No sensitive values were printed, committed, or written into this report. No `.env` files were modified. No data was deleted. No external writes were executed.

## Final Result

OpenCloud remains preserved and active. The safe disable phase is ready as a reversible procedure, but the actual stop/disable action remains blocked until the owner explicitly approves pausing the live Build-Wiki refresh dependency or a replacement farmer has been proven stable.
