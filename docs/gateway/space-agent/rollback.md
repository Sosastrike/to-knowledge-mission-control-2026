# Space Agent Rollback and Disable Path

Last verified: 2026-05-06

## Disable Strategy

Space Agent can be disabled from Gateway routing without deleting data, reports, templates, or historical audit records.

Safe disable steps:

1. Mark the Space Agent Gateway node as blocked.
2. Set read-only research routing to disabled.
3. Leave documentation, reports, and audit records intact.
4. Keep Agent Zero, Hermes, Pi, OpenCloud, OpenClaw+, Bridge/MCP, and Brain unchanged.

## What Not To Do

- Do not delete Space Agent reports.
- Do not delete OpenCloud or Build-Wiki.
- Do not remove existing agents.
- Do not scrub Tony historical records.
- Do not remove Gateway compatibility routes.
- Do not disable Bridge/MCP or OpenClaw+.

## Git Rollback

Use targeted revert commits for Space Agent changes. Example:

```bash
git revert <space-agent-commit>
```

Do not use destructive reset commands on shared branches.

## Runtime Rollback

If a future Space Agent service is enabled, stop or disable only that service. Do not stop Mission Control, Bridge/MCP, OpenClaw+, OpenCloud, Build-Wiki/Farmer, Agent Zero, or Hermes unless a separate incident response requires it.

## Owner Communication

If Space Agent is disabled, owner-facing status should say:

> Space Agent is blocked for live research right now. Agent Zero can continue with non-web work, and Gateway will route web research after the adapter is restored.
