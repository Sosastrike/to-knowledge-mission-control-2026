# System Cleanup Inventory Report

Generated: 2026-04-30T02:32:31.157Z
Mode: inventory only. No delete. No quarantine. No protected action.

## Summary
- Total candidates: 113
- protected_secret_or_env: 1
- modified_tracked_file: 24
- untracked_file: 23
- designer_review_reference: 10
- active_route_or_designer_asset: 54
- old_backup: 1

## Top 20 Highest-Value Cleanup Candidates
- .env.example
  - category: protected_secret_or_env
  - git status: M
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/Login.html
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/Mission Control.html
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/docs/
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/screenshots/
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/admin-settings.css
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/agent-mgmt-pro.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/agent-network/
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/app.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/backend-readiness.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/backend/
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/brain-sync.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/credentials-page.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/dashboard-wiring.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/dashboard.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/data.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/governance-page-2.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/governance-page.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/icons.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
  - rollback: owner-approved rollback plan required
- public/designer-mission-control/src/login-page.jsx
  - category: active_route_or_designer_asset
  - git status: ??
  - risk: high
  - recommended action: needs_owner_approval
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
- src/app/api/agents/[id]/advanced-config/ (untracked_file)
- src/app/api/auth/azure-ad/ (untracked_file)
- src/app/api/auth/callback/ (untracked_file)
- src/app/designer-mission-control/ (untracked_file)
- src/app/live-meeting/ (untracked_file)
- src/app/login/page.tsx.bak-designer-login-20260428-071138 (old_backup)
- src/app/schedule/ (untracked_file)
- src/app/settings/ (untracked_file)
- src/app/tkmc/ (untracked_file)
- src/components/dashboard/mission-control-landing.tsx (untracked_file)
- src/components/panels/HealthCheckPanel.tsx (untracked_file)
- src/components/tkmc/ (untracked_file)
- src/lib/agent-advanced-config.ts (untracked_file)
- src/lib/azure-ad-auth.ts (untracked_file)
- src/lib/claudeclaw-runtime-status.ts (untracked_file)
- src/lib/tkmc-flags.ts (untracked_file)
- src/lib/tkmc-rbac.ts (untracked_file)
- start-mc.sh.DISABLED (untracked_file)

## Must Never Touch Without Explicit Owner Approval
- .env.example (protected_secret_or_env)
- public/designer-mission-control/Login.html (active_route_or_designer_asset)
- public/designer-mission-control/Mission Control.html (active_route_or_designer_asset)
- public/designer-mission-control/docs/ (active_route_or_designer_asset)
- public/designer-mission-control/screenshots/ (active_route_or_designer_asset)
- public/designer-mission-control/src/admin-settings.css (active_route_or_designer_asset)
- public/designer-mission-control/src/agent-mgmt-pro.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/agent-network/ (active_route_or_designer_asset)
- public/designer-mission-control/src/app.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/backend-readiness.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/backend/ (active_route_or_designer_asset)
- public/designer-mission-control/src/brain-sync.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/credentials-page.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/dashboard-wiring.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/dashboard.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/data.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/governance-page-2.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/governance-page.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/icons.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/login-page.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/meeting-lobby.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/meeting-room.css (active_route_or_designer_asset)
- public/designer-mission-control/src/meetings-integrations.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/notification-bus.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/notifications-drawer.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/ops-intel.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/overlays.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/profile-security.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/AlertsPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/ChannelsPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/EmailProfilesPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/FireCrawlPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/MCPToolsPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/MeetingsHubPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/MiroFishPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/N8NPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/SkillsRegistryPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/WorkspaceRail.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/ZapierPage.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/brain-sync.css (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/mirofish.css (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/mockApi.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/replicas/new-sections.css (active_route_or_designer_asset)
- public/designer-mission-control/src/schedule.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/search-command.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/search-notifications.css (active_route_or_designer_asset)
- public/designer-mission-control/src/settings-pages.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/settings.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/shell.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/skills-page.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/surfaces.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/tkmc-live-adapter.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/ui.jsx (active_route_or_designer_asset)
- public/designer-mission-control/src/web-ops.jsx (active_route_or_designer_asset)
- public/designer-mission-control/styles.css (active_route_or_designer_asset)

## Production Risk Assessment
- High risk items include active designer route assets, env examples, production route files, and anything under active app paths.
- Medium risk items include modified tracked source files and old backups that need release grouping or quarantine proof.
- Low risk items can be marked reference-only or quarantined only after the required cleanup checks pass.

## Recommended Cleanup Order
1. Keep current code/reports stable and do not delete active routes.
2. Review modified tracked files by release group.
3. Mark duplicate docs/reference packages as historical.
4. Quarantine old backups/generated reports only after build/typecheck/health checks.
5. Delete only after owner approval and rollback proof.

## Full Inventory JSON
```json
{
  "ok": true,
  "mode": "inventory_only_no_delete_no_quarantine",
  "generated_at": "2026-04-30T02:32:31.157Z",
  "total": 113,
  "by_category": {
    "protected_secret_or_env": 1,
    "modified_tracked_file": 24,
    "untracked_file": 23,
    "designer_review_reference": 10,
    "active_route_or_designer_asset": 54,
    "old_backup": 1
  },
  "protected_actions_taken": false,
  "deletion_performed": false,
  "quarantine_performed": false,
  "items": [
    {
      "path": ".env.example",
      "git_status": "M",
      "category": "protected_secret_or_env",
      "reason": "protected_secret_or_env detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "next.config.js",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- next.config.js (only after owner confirms it is unrelated)"
    },
    {
      "path": "pnpm-lock.yaml",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- pnpm-lock.yaml (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/[[...panel]]/page.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/[[...panel]]/page.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/agents/page.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/agents/page.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/api/agents/route.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/api/agents/route.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/api/auth/access-requests/route.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/api/auth/access-requests/route.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/api/integrations/route.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/api/integrations/route.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/api/skills/registry/route.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/api/skills/registry/route.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/api/skills/route.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/api/skills/route.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/layout.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/layout.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/app/login/page.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/app/login/page.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/agent-network/agent-network.module.css",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/agent-network/agent-network.module.css (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/auth/designer-login-shell.module.css",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/auth/designer-login-shell.module.css (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/auth/designer-login-shell.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/auth/designer-login-shell.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/layout/header-bar.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/layout/header-bar.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/panels/github-sync-panel.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/panels/github-sync-panel.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/panels/integrations-panel.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/panels/integrations-panel.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/panels/skills-panel.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/panels/skills-panel.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/components/panels/task-board-panel.tsx",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/components/panels/task-board-panel.tsx (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/lib/auth.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/lib/auth.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/lib/scheduler.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/lib/scheduler.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/lib/secret-scanner.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/lib/secret-scanner.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/lib/validation.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/lib/validation.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": "src/proxy.ts",
      "git_status": "M",
      "category": "modified_tracked_file",
      "reason": "modified_tracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": true,
        "imported_by_code": true,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "medium",
      "recommended_action": "review_release_group",
      "rollback_plan": "git checkout -- src/proxy.ts (only after owner confirms it is unrelated)"
    },
    {
      "path": ".commit-tkmc.sh",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": ".designer-retirement-backups/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": ".designer-review/agent-network-2026-04-28-review.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/agent-network-2026-04-28/",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/block4-better-sqlite3-rebuild.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/bridge-providers-panel-plan.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/code-design-latest-2026-04-28-review.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/code-design-latest-2026-04-28/",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/draft-components/",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/path-a-nextjs-port-plan.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/path-a-reference-material-refinement.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".designer-review/path-a-section-2-agent-network-refinement.md",
      "git_status": "??",
      "category": "designer_review_reference",
      "reason": "designer_review_reference detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "keep_reference",
      "rollback_plan": "none"
    },
    {
      "path": ".tkmc-commit-msg.txt",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/Voice-Biometrics-Executive-Report.pdf",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/Login.html",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/Mission Control.html",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/docs/",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/screenshots/",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/admin-settings.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/agent-mgmt-pro.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/agent-network/",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/app.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/backend-readiness.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/backend/",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/brain-sync.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/credentials-page.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/dashboard-wiring.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/dashboard.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/data.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/governance-page-2.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/governance-page.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/icons.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/login-page.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/meeting-lobby.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/meeting-room.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/meetings-integrations.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/notification-bus.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/notifications-drawer.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/ops-intel.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/overlays.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/profile-security.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/AlertsPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/ChannelsPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/EmailProfilesPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/FireCrawlPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/MCPToolsPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/MeetingsHubPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/MiroFishPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/N8NPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/SkillsRegistryPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/WorkspaceRail.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/ZapierPage.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/brain-sync.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/mirofish.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/mockApi.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/replicas/new-sections.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/schedule.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/search-command.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/search-notifications.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/settings-pages.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/settings.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/shell.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/skills-page.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/surfaces.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/tkmc-live-adapter.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/ui.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/src/web-ops.jsx",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/designer-mission-control/styles.css",
      "git_status": "??",
      "category": "active_route_or_designer_asset",
      "reason": "active_route_or_designer_asset detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "high",
      "recommended_action": "needs_owner_approval",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "public/lu-ai-collab-v2.mp4",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "scripts/mc-create-owner.cjs",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/api/agents/[id]/advanced-config/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/api/auth/azure-ad/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/api/auth/callback/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/designer-mission-control/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/live-meeting/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/login/page.tsx.bak-designer-login-20260428-071138",
      "git_status": "??",
      "category": "old_backup",
      "reason": "old_backup detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "medium",
      "recommended_action": "quarantine_after_checks",
      "rollback_plan": "cp -a runtime/archive/system-cleanup/<batch>/src/app/login/page.tsx.bak-designer-login-20260428-071138 src/app/login/page.tsx.bak-designer-login-20260428-071138"
    },
    {
      "path": "src/app/schedule/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/settings/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/app/tkmc/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": true
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/components/dashboard/mission-control-landing.tsx",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/components/panels/HealthCheckPanel.tsx",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/components/tkmc/",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/lib/agent-advanced-config.ts",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/lib/azure-ad-auth.ts",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/lib/claudeclaw-runtime-status.ts",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/lib/tkmc-flags.ts",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "src/lib/tkmc-rbac.ts",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    },
    {
      "path": "start-mc.sh.DISABLED",
      "git_status": "??",
      "category": "untracked_file",
      "reason": "untracked_file detected from live git status",
      "current_usage_evidence": {
        "exists": true,
        "git_tracked": false,
        "imported_by_code": false,
        "referenced_by_docs": false,
        "referenced_by_service": false,
        "referenced_by_route": false
      },
      "production_risk": "low",
      "recommended_action": "review_before_action",
      "rollback_plan": "owner-approved rollback plan required"
    }
  ],
  "next_action": "Review medium/high-risk items, then quarantine only after owner-approved checks. Do not delete in the first pass."
}
```
