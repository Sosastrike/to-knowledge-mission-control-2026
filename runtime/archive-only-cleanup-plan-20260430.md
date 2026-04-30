# Archive-Only Cleanup Plan

Generated: 2026-04-30 15:58 EDT

## Rule

This is a planning-only cleanup pass. Nothing is deleted. Nothing is quarantined yet. Candidates below are archive-only or review-only until the owner approves a cleanup window and rollback path.

## Current Safe Candidates

| Path | Category | Evidence | Risk | Recommended action | Rollback |
| --- | --- | --- | --- | --- | --- |
| `.commit-tkmc.sh` | untracked temporary helper | untracked in Mission Control git status | low | archive after confirming not referenced by scripts/systemd | restore from archive copy |
| `.tkmc-commit-msg.txt` | untracked temporary helper | untracked in Mission Control git status | low | archive after confirming no active release script reads it | restore from archive copy |
| `start-mc.sh.DISABLED` | disabled legacy starter | untracked and marked DISABLED | medium | keep until systemd start path is documented, then archive | move back from archive |
| `src/app/login/page.tsx.bak-designer-login-20260428-071138` | old backup | untracked backup file | medium | archive only after current login route is verified from git and production | move back from archive |
| `runtime/route-providers-before-timeout-fix-20260430.ts` | runtime backup/snapshot | untracked runtime snapshot | low | archive under `runtime/archive/` after current route-provider code is committed | move back from archive |
| `runtime/db-backups/` | database backups | untracked backup directory | high | do not delete; move only with owner approval and manifest | restore directory from archive |
| `.designer-review/code-design-latest-2026-04-28/` | reference package | untracked designer-review package; earlier marked reference-only | medium | keep reference-only until designer parity is fully signed off | restore directory from archive |
| `.designer-review/agent-network-2026-04-28/` | reference package | untracked designer-review package | medium | keep reference-only until Agent Network/Bridge Mode backend is completed | restore directory from archive |
| `public/Voice-Biometrics-Executive-Report.pdf` | loose public artifact | untracked public PDF | medium | review owner-facing purpose before archive; public path may be intentional | restore file from archive |
| `public/lu-ai-collab-v2.mp4` | loose public artifact | untracked public video | medium | review owner-facing purpose before archive; public path may be intentional | restore file from archive |

## Must Not Touch Without Explicit Owner Approval

- `.env`, `.env.*`, credentials, private keys, secrets.
- Production DB files or backup DB directories.
- Active source files imported by the app.
- Active route files under `src/app`.
- Systemd service files.
- Tony memory, Tony voice, Tony governance, routing files.
- Zapier approval/audit records.
- Obsidian/Brain/memory content.

## Required Checks Before Any Future Archive Move

1. `git status --short`
2. `rg` reference scan for each path.
3. route scan for files under active route paths.
4. systemd/service reference scan for scripts.
5. build/typecheck.
6. Mission Control smoke test.
7. secret scan.
8. confirm `.env` unchanged.
9. confirm Tony voice/routing/memory/governance unchanged.
10. confirm Zapier writes and connector execution remain locked.

## Proposed Archive Command Pattern

Use this pattern only after owner approves the cleanup window:

```bash
mkdir -p runtime/archive/cleanup-20260430
mv <candidate> runtime/archive/cleanup-20260430/
```

Rollback:

```bash
mv runtime/archive/cleanup-20260430/<candidate> <original-path>
```

## Next Safe Step

Generate a reference scan for each low-risk candidate, then present an archive batch for owner approval. Do not delete anything.
