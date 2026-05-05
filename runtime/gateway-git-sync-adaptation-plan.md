# Gateway Git Sync Adaptation Plan

## Source Pattern

The Gateway storage model borrows the useful parts of Kong Insomnia's storage options, especially Git Sync.

Relevant pattern from the Kong documentation:

- Local-first storage can keep project data off cloud services.
- Git Sync can use a third-party Git repository for project data.
- Git gives version tracking, branches, rollback, and collaboration through normal Git workflows.
- MCP client configuration can be stored as part of the project.
- Secret protection is not automatic, so private environments, external vaults, or scanners are required.

This Mission Control adaptation does not install KongHQ software and does not depend on Insomnia. It adapts the storage architecture pattern.

Reference: https://developer.konghq.com/insomnia/storage/#git-sync

## Gateway Adaptation

Gateway should treat safe configuration as a local-first project that can optionally sync through Git.

Syncable Gateway artifacts:

- Gateway registry
- Gateway route contracts
- Gateway policies
- Capability registry
- Skill manifests
- Model catalog
- MCP client configuration
- API collections
- Event contracts
- Brain adapter manifests
- Report templates

Blocked from Git Sync:

- API keys
- OAuth tokens
- Auth files
- `.env` files
- systemd credentials
- raw memory dumps
- raw vault notes
- delivery attachments
- runtime logs that may contain secrets

## Storage Modes

| Mode | Use |
| --- | --- |
| `local_vault` | Default safe mode. Project data stays local and secrets stay in secret stores. |
| `scratchpad` | Temporary unsynced experimentation. Useful for draft Gateway specs or mock routes. |
| `git_sync` | Safe project artifacts sync through a Git remote with versioning, branches, rollback, and review. |

## Policy

Gateway Git Sync must be safe-by-default:

- `sync_secrets=false`
- secret references are names only
- external vault or secret file remains the source for credentials
- scanner is required before commit/push
- auth files are never committed
- `.env` files are never committed
- runtime logs and raw memory are never committed

## Implementation Added

Added `src/lib/gateway-storage-model.ts`:

- `GatewayStorageMode`
- `GatewaySyncState`
- `GatewayStorageProject`
- `GatewayStorageResource`
- `GatewayGitRemote`
- `GatewaySecretSyncPolicy`
- `GatewayGitSyncPlan`
- syncable and blocked resource kind lists
- helpers to normalize modes, states, resources, and Git Sync plans

Added `src/lib/gateway-storage-model.test.ts`:

- verifies local/Git storage modes
- verifies syncable Gateway artifacts
- verifies blocked secret/runtime artifacts
- verifies Git remote/auth blockers
- verifies safe commit/push decisions

## Current Boundary

This phase defines the storage/sync model only.

It does not:

- create a new remote repository
- push project artifacts to a new destination
- sync secrets
- modify `.env`
- alter Mission Control authentication
- enable connector execution
- run external writes

## Next Steps

1. Add a Gateway Registry export route that emits only safe project artifacts.
2. Add a dry-run "Gateway Git Sync readiness" route that reports configured/missing/blocked states.
3. Add UI status for local vault versus Git Sync mode.
4. Add a pre-commit scanner for Gateway project exports.
5. Add an owner-approved sync action later, scoped to safe artifacts only.
