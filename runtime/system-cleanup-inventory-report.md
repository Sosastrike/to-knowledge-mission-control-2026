# System Cleanup Inventory Report

Generated: 2026-04-30T03:16:28.732Z
Mode: inventory only. No delete. No quarantine. No protected action.

## Summary
- Total candidates: 18
- designer_review_reference: 10
- old_backup: 1
- untracked_file: 7

## Current Candidates
- .commit-tkmc.sh
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required
- .designer-retirement-backups/
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required
- .designer-review/agent-network-2026-04-28-review.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/agent-network-2026-04-28/
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/block4-better-sqlite3-rebuild.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/bridge-providers-panel-plan.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/code-design-latest-2026-04-28-review.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/code-design-latest-2026-04-28/
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/draft-components/
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/path-a-nextjs-port-plan.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/path-a-reference-material-refinement.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .designer-review/path-a-section-2-agent-network-refinement.md
  - category: designer_review_reference
  - git status: ??
  - risk: low
  - recommended action: keep_reference
  - tracked: no
  - route/service evidence: none detected
  - rollback: none
- .tkmc-commit-msg.txt
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required
- public/Voice-Biometrics-Executive-Report.pdf
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required
- public/lu-ai-collab-v2.mp4
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required
- scripts/mc-create-owner.cjs
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required
- src/app/login/page.tsx.bak-designer-login-20260428-071138
  - category: old_backup
  - git status: ??
  - risk: medium
  - recommended action: quarantine_after_checks
  - tracked: no
  - route/service evidence: route
  - rollback: cp -a runtime/archive/system-cleanup/<batch>/src/app/login/page.tsx.bak-designer-login-20260428-071138 src/app/login/page.tsx.bak-designer-login-20260428-071138
- start-mc.sh.DISABLED
  - category: untracked_file
  - git status: ??
  - risk: low
  - recommended action: review_before_action
  - tracked: no
  - route/service evidence: none detected
  - rollback: owner-approved rollback plan required

## Safe To Remove Later
- src/app/login/page.tsx.bak-designer-login-20260428-071138 (quarantine_after_checks)

## Must Quarantine First
- .commit-tkmc.sh (untracked_file)
- .designer-retirement-backups/ (untracked_file)
- .designer-review/agent-network-2026-04-28-review.md (designer_review_reference)
- .designer-review/agent-network-2026-04-28/ (designer_review_reference)
- .designer-review/block4-better-sqlite3-rebuild.md (designer_review_reference)
- .designer-review/bridge-providers-panel-plan.md (designer_review_reference)
- .designer-review/code-design-latest-2026-04-28-review.md (designer_review_reference)
- .designer-review/code-design-latest-2026-04-28/ (designer_review_reference)
- .designer-review/draft-components/ (designer_review_reference)
- .designer-review/path-a-nextjs-port-plan.md (designer_review_reference)
- .designer-review/path-a-reference-material-refinement.md (designer_review_reference)
- .designer-review/path-a-section-2-agent-network-refinement.md (designer_review_reference)
- .tkmc-commit-msg.txt (untracked_file)
- public/Voice-Biometrics-Executive-Report.pdf (untracked_file)
- public/lu-ai-collab-v2.mp4 (untracked_file)
- scripts/mc-create-owner.cjs (untracked_file)
- src/app/login/page.tsx.bak-designer-login-20260428-071138 (old_backup)
- start-mc.sh.DISABLED (untracked_file)

## Must Never Touch Without Explicit Owner Approval
- None from current dirty tree.

## Production Risk Assessment
- No production files were deleted or moved by this pass.
- Current dirty tree is mostly reference material, temporary commit helpers, inactive backups, and two unreferenced public artifacts.
- The owner/admin creator script is potentially useful but writes DB records when run; keep it uncommitted until a separate credential/onboarding decision.

## Recommended Cleanup Order
1. Keep current production source clean; do not stage reference/design review material into release commits.
2. Quarantine old backups and disabled helper files only after route/service/reference scans pass.
3. Decide whether unreferenced media/PDF files belong in designer assets, docs, or an archive.
4. Keep `.designer-review/` reference material out of production release unless the owner asks for a design-audit commit.
5. Do not delete anything until owner approves destructive cleanup.
