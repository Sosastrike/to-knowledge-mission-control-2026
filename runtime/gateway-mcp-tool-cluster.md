# Gateway MCP and Tool Cluster

## Scope

Phases 131-140 added the MCP/Tool cluster to Gateway without executing external tools.

## Completed

- Added the MCP / Tool Gateway node.
- Added MCP server nodes and schema-summary details for `/api/mcp/list` and `/api/mcp/servers/:id/tools`.
- Added Gateway nodes for Zapier, HeyGen, Firecrawl, AgentMail, Google Drive, OneDrive, and n8n.
- Kept Zapier writes, HeyGen generation, uploads, and email sending session-gated.
- Added status details for credential presence, adapter reachability, schema visibility, upload connector status, AgentMail domain rules, and n8n install/runtime/API status.
- Updated route planning so tool requests route through the MCP / Tool Gateway cluster.

## Safety

- No connector writes were run.
- No Zapier writes were run.
- No HeyGen generation was run.
- No Drive or OneDrive upload was run.
- No AgentMail send was run.
- No SMB mount or farmer execution was run.
- No secrets or auth file contents were printed or committed.

## Compatibility

Bridge/MCP remains the access layer under Gateway. Existing Agent Network compatibility routes are not removed by this phase.

## Rollback

Revert the phase commit:

```bash
git revert <phase-commit>
```
