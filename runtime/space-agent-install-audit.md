# Space Agent Install Audit

Generated: 2026-05-06
Scope: Phases 061-070, audit only. No production install, no dependency install, no external writes, no credentials inspected, and no `.env` changes.

## Executive Summary

Space Agent is a browser-first AI agent runtime with a thin Node.js server and optional Electron desktop packaging. It is a plausible fit for the Gateway role `space_agent` as a browser/web/YouTube/Firecrawl research specialist, but it should not be installed into production or granted execution rights until Gateway wraps it with a read-only research adapter, explicit auth, Bridge Session policy gates, and audit logging.

Current readiness for Gateway: design/integration candidate, not production-active.

## Phase 061 - Package Scripts

Root package:

- `start`: `node space serve`
- `dev`: `node server/dev_server.js`
- Desktop dev/build/distribution scripts are present for Electron packaging.
- Node engine requirement: `>=20`.
- Main desktop entry: `packaging/desktop/main.js`.

Operational meaning:

- Server mode starts through the local `space` CLI, which loads `space.js`, resolves commands from `commands/`, then dispatches `serve`.
- Desktop mode is a separate Electron packaging path and should not be treated as a required server dependency for Gateway.

## Phase 062 - NPM Dependencies

Root dependencies:

- `archiver`
- `electron-updater`
- `isomorphic-git`

Packaging dependencies:

- `electron`
- `electron-builder`

Subpackages:

- `app/package.json`, `commands/package.json`, and `server/package.json` declare ES module type where needed and do not add additional npm dependencies.

Package lock summary:

- Lockfile version: 3.
- Root dependency tree count observed: 115 packages.
- Notable dependency families: archive/ZIP handling, Electron desktop/update tooling, Git/history backend support.

## Phase 063 - Security-Sensitive Packages and Surfaces

Security-sensitive packages and areas:

- `electron`, `electron-builder`, `electron-updater`: desktop shell, preload bridges, updater flow, packaged runtime behavior.
- `isomorphic-git`: Git-backed module and history operations.
- `archiver` and ZIP helpers: archive creation/download/share flows.
- Native Node `http` server: direct request routing without Express.
- Fetch proxy: authenticated `/api/proxy` can fetch arbitrary HTTP/HTTPS targets and strips cookies plus selected hop-by-hop headers.
- File APIs: read/write/delete/copy/move are server-side mutation surfaces behind auth and app-layer permissions.
- Module install/remove APIs: Git-backed module management and destructive removal behind auth and permission checks.
- Git history rollback/revert APIs: protected mutation surfaces that can rewrite writable layer state.
- Auth key fallback storage: backend-only generated keys with restrictive file permissions if env-injected keys are absent.

Gateway implication:

- Space Agent must enter Gateway as read-only research by default.
- Browser actions, proxy fetches, module operations, file writes, and Git history changes must remain blocked unless an explicit Bridge Session scope allows them.
- Gateway should not pass raw credentials or raw filesystem access to Space Agent.

## Phase 064 - Server Startup Path

Startup chain:

1. `node space serve`
2. `space` loads `space.js`.
3. `space.js` loads command modules from `commands/`.
4. `commands/serve.js` parses runtime parameter overrides.
5. `server/server.js` calls `startServer`.
6. `server/app.js` builds the HTTP server, API registry, auth service, watchdog, temp watcher, mutation sync, job runner, and request router.
7. `server/router/router.js` handles pages, API modules, `/api/proxy`, `/mod/...`, and app-file fetches.

Runtime controls:

- Host, port, workers, customware path, login behavior, guest behavior, Git backend, and Git history are runtime parameters.
- `WORKERS>1` starts a clustered runtime with a primary state owner.
- Packaged desktop mode forces a local loopback server and single-user app behavior through the desktop host.

## Phase 065 - Browser/Desktop App Behavior

Browser-first behavior:

- The browser app is the primary runtime.
- The Node server provides local infrastructure, authenticated APIs, fetch proxying, file access, and module/customware support.
- Browser modules are served through `/mod/...` and layered app files.

Desktop behavior:

- Electron desktop host exists in `packaging/desktop/`.
- Desktop preload exposes a limited launcher bridge on `/enter` and `/login`.
- Ordinary app routes receive `spaceDesktop.browser` for browser embedding metadata, host events, navigation, reload, focus, and envelope transport.
- Desktop browser surfaces can navigate remote pages and use webview/browser helper bridges for DOM/content/detail/evaluate/action operations.
- Packaged desktop binds backend runtime locally and stores writable runtime/auth data outside the installed bundle.

Gateway implication:

- Space Agent browser capabilities are real, but they are primarily part of the app/desktop runtime, not a proven headless Gateway adapter yet.
- Gateway should use a safe wrapper that returns Research Packets rather than exposing the desktop browser bridge directly.

## Phase 066 - Auth/User System

Auth model:

- Protected APIs require an authenticated `space_session` cookie unless an endpoint explicitly exports `allowAnonymous = true`.
- Login uses a challenge/response flow and server-issued session cookie.
- Session cookie is HTTP-only, SameSite=Strict, and has a 30-day TTL.
- Login challenge TTL is 5 minutes.
- Password records are backend-sealed SCRAM-style verifier envelopes, not plaintext passwords.
- Backend auth keys come from injected environment variables or a local gitignored fallback store.
- Public endpoints include health/login/guest/share-related endpoints by explicit `allowAnonymous = true`.

Gateway implication:

- Do not bypass Space Agent auth.
- If Mission Control calls Space Agent, use a Gateway-held service identity or approved local adapter, never owner-visible credentials.

## Phase 067 - Admin Mode

Admin behavior:

- `/admin` is an authenticated admin shell that clamps module/extension resolution to firmware layer 0 with `maxLayer=0`.
- `_admin` group membership grants elevated write capability across writable L1/L2 paths.
- Single-user packaged mode treats the implicit user as a virtual admin.
- Admin UI and admin skills still derive authority from normal server/user/group permission checks.
- Destructive module/file actions are enabled only when server-returned permissions say the current user can write.

Gateway implication:

- Gateway must not treat admin mode as automatic authority.
- Space Agent should not get admin mode unless explicitly scoped and supervised through Agent Zero/Gateway.

## Phase 068 - Git-Backed History / Time Travel

History behavior:

- `CUSTOMWARE_GIT_HISTORY` controls optional local Git history and defaults to enabled.
- Writable L1 group roots and L2 user roots can become per-owner local Git repositories.
- APIs exist for listing, diffing, previewing, rollback, and revert.
- Rollback hard-resets a writable owner history repository to a commit, preserves ignored auth files, and preserves forward-travel refs when possible.
- Revert creates a new inverse commit rather than moving history back.
- `.git` metadata is reserved and should not be exposed through app-file APIs or path indexes.
- Git backend can be native or isomorphic via `GIT_BACKEND`.

Gateway implication:

- History preview/listing can be read-only research if scoped.
- Rollback/revert must be treated as protected actions requiring Bridge Session and explicit owner scope.

## Phase 069 - Plugin/Skill System

Skill system:

- Skills are plain-text `SKILL.md` files under module-owned `ext/skills/...` paths.
- Discovery pattern includes readable `mod/*/*/ext/skills/*/SKILL.md` entries.
- Top-level skills can auto-load based on metadata and live context tags.
- Nested skills are explicit-load routing targets.
- Runtime APIs expose `space.skills.load(...)` for onscreen and admin agent surfaces.
- Admin has an alias `space.admin.loadSkill(...)` and mirrors it into `space.skills.load(...)`.
- Current first-party skills include browser-manager, browser-control, development, documentation, memory, pdf-report, screenshots, spaces, space-widgets, file-download, and admin user-management.

Plugin/module system:

- Modules live in layered `mod/<author>/<repo>` structure.
- Module install supports Git-backed install into writable layers and accepts a token field in request payload.
- Module removal is destructive and must stay permission-gated.

Gateway implication:

- Space Agent can be a strong research specialist because it already has browser-control/browser-manager skill surfaces.
- Gateway should expose skill discovery read-only first.
- Any module install/remove or skill write/activation must require Bridge Session.

## Phase 070 - Install Audit Decision

Recommended status: do not install into production yet.

Reasons:

- The repo is browser-first and desktop-capable, but a safe Mission Control/Gateway live adapter has not been proven.
- Browser interaction can include remote page navigation and in-page evaluation; Gateway must constrain this to research-only mode before live use.
- The authenticated fetch proxy is powerful and should be policy-gated.
- File, module, Git history, and admin actions are mutation-capable and must stay disabled for the Space Agent Gateway node by default.
- Firecrawl-specific package/runtime integration was not found in package dependencies during this audit; Space Agent can coordinate Firecrawl research conceptually, but Mission Control should continue to source actual Firecrawl status from Gateway/Bridge registry.

Safe next implementation steps:

1. Add a Gateway Space Agent install status node that reports `not_installed_production`, `read_only_default`, and `live_adapter_missing`.
2. Build a read-only Research Packet adapter contract before starting Space Agent server integration.
3. Add policy tests for web research, browser interaction, YouTube inspection, and Firecrawl routing.
4. Block file/module/Git/admin/proxy mutation paths unless Bridge Session scope explicitly allows them.
5. Add no-secrets and no-raw-path tests around all Space Agent owner-facing output.

## No-Secrets Confirmation

- No token, API key, auth file, or `.env` value was printed or copied into this report.
- No dependency install was run.
- No production service was changed or restarted.
- No external write was executed.
- No SMB, Zapier, HeyGen, farmer, Drive, OneDrive, AgentMail, or OpenCloud action was executed.
