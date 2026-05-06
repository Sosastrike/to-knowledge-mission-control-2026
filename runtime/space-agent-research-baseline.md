# Space Agent Research Baseline

Generated: 2026-05-06

## Scope

Discovery-only baseline for integrating Space Agent as the Gateway browser, web, YouTube, and Firecrawl research specialist.

No production install, service wiring, package install, Gateway code change, external write, Firecrawl execution, browser execution, YouTube execution, SMB action, Zapier action, HeyGen action, or farmer action was performed.

## Phase status

- Phase 001: Space Agent checkout found and inspected safely.
- Phase 002: Not installed into production.
- Phase 003: Repo branch, package manager, scripts, license, and runtime identified.
- Phase 004: README, AGENTS.md, package.json, server, app, commands, and space.js inspected.
- Phase 005: Server mode, desktop mode, browser runtime, CLI, and skill system identified.
- Phase 006: Firecrawl references checked.
- Phase 007: Browser automation references checked.
- Phase 008: YouTube/video support checked.
- Phase 009: This baseline report created.
- Phase 010: No code changes made.

## Repository identity

- Source repository: https://github.com/Sosastrike/To-Knowledge-space-agent.git
- Local checkout inspected: existing server-side Space Agent checkout
- Branch: main
- Commit inspected: 9c26f9f
- Git status: clean at inspected checkout.
- License: MIT License.

## Package manager and runtime

- Package manager: npm, indicated by package-lock.json.
- Root package: space-agent.
- Version: 0.36.0.
- Node engine: >=20.
- Root main entry: packaging/desktop/main.js.
- Primary start script: npm start -> node space serve.
- Development script: npm run dev -> node server/dev_server.js.
- Desktop scripts: desktop:dev, desktop:pack, desktop:dist, desktop:dist:mac, and package:desktop variants.
- Root dependencies: archiver, electron-updater, isomorphic-git.
- Packaging dependencies: electron, electron-builder.

## Top-level architecture readout

Space Agent is a browser-first AI agent runtime. The browser app is the primary runtime. The Node.js side is intentionally thin infrastructure for page shells, APIs, routing, auth/session handling, fetch proxying, file access, local development, and optional desktop hosting.

Key top-level surfaces:

- space: root CLI router that discovers command modules dynamically.
- space.js: CLI implementation that loads project env files, discovers commands, imports the selected command module, and calls execute().
- commands: CLI commands such as serve, supervise, user, group, get, set, update, version, and help.
- server: thin Node infrastructure runtime.
- app: browser runtime and layered customware model.
- packaging: Electron desktop host and release packaging.

## CLI and server mode

Server mode exists.

Evidence:

- commands/serve.js defines `serve` as “Start the local Space Agent server.”
- Usage includes `node space serve`, `node space serve HOST=0.0.0.0 PORT=3000`, `node space serve PORT=0`, and worker/runtime parameter variants.
- The serve command calls startServer() from server/server.js.
- server/app.js creates the HTTP server bootstrap, runtime params, auth service, customware directories, file watching, job runner, and request handler.

Production-like supervisor mode exists.

Evidence:

- commands/supervise.js exists.
- README documents `node space supervise HOST=0.0.0.0 PORT=3000` for production.
- commands/AGENTS.md says supervise runs a public reverse-proxy supervisor in front of replaceable private loopback `space serve` child processes.

## Desktop mode

Desktop mode exists.

Evidence:

- Root package main is packaging/desktop/main.js.
- package.json includes desktop:dev, desktop:pack, desktop:dist, platform-specific package scripts, and Electron packaging dependencies.
- packaging/desktop contains main.js, preloads, browser preload files, webview preload files, and server storage helpers.
- Browser automation docs distinguish ordinary browser sessions from packaged native app runs.

## Browser runtime and browser automation

Browser runtime exists and is the primary runtime.

Browser automation references are strong and first-class.

Important browser surfaces:

- app/L0/_all/mod/_core/web_browsing/AGENTS.md
- browser-element.js
- browser-surface.js
- browser-frame-bridge.js
- browser-frame-inject.js
- browser-page-content.js
- browser-webview.js
- browser-webview-bridge.js
- browser-native-bridge.js
- browser-guest-runtime.js
- store.js

Capabilities documented in Space Agent:

- Floating browser windows.
- Inline `<x-browser>` surfaces.
- Native desktop webview surfaces.
- Browser ids exposed through `space.browser`.
- `space.browser.open`, create, close, closeAll, list, ids, count, has, and state.
- Navigation helpers: navigate, reload, back, forward.
- Inspection helpers: dom, content, detail, evaluate.
- Interaction helpers: click, type, submit, typeSubmit, scroll.
- Readable content extraction with typed refs such as link, button, image, and input refs.
- Last-interacted browser prompt context.
- Browser-control and browser-manager skills.

Important limitation:

- In ordinary browser sessions, guarded browser calls return a structured warning because full browser functionality is currently implemented in native desktop app mode.
- Browser action helpers can interact with pages, so Gateway must keep Space Agent research-only by default and require Bridge Session scope before live browser action.

## Skill system

Skill system exists.

Evidence:

- Skills are `SKILL.md` files discovered under `ext/skills` folders.
- app/L0/_all/mod/_core/skillset/AGENTS.md owns the first-party reusable skill packs and shared browser-side skill discovery helper.
- Root/app docs state skill files can use metadata.when, metadata.loaded, and metadata.placement.
- Browser-related skills include browser-manager and browser-control.
- Other observed skills include development, file-download, pdf-report, screenshots, user-management, documentation, memory, spaces, and space-widgets.

Gateway implication:

- Space Agent has an internal skill mechanism that may be useful later, but Gateway should not activate Space Agent skill execution until read-only routing, policy checks, and Bridge Session enforcement are implemented.

## Firecrawl baseline

No direct Firecrawl references were found in the inspected Space Agent checkout.

Gateway implication:

- Space Agent can become the research-stage owner for Firecrawl-style requests, but Firecrawl itself should remain a Gateway/Bridge connector dependency.
- If Firecrawl credentials or adapter are missing, Gateway must report the blocker and let Space Agent produce only a research packet/fallback plan.
- Do not claim native Firecrawl support inside Space Agent from this baseline.

## YouTube/video baseline

YouTube/video references exist, but they appear to be examples/widgets and public README links, not a dedicated YouTube research connector or transcript engine.

Observed examples:

- README has YouTube/channel links and a video thumbnail link.
- spaces onboarding examples include YouTube list/player widgets.
- Documentation mentions YouTube embed rules and IFrame API handling.
- Vendor Hugging Face browser runtime contains generic video-related helper code, but that is vendored model runtime material, not a Space Agent YouTube research workflow.

Gateway implication:

- Space Agent can be routed for browser/YouTube inspection planning and public page/video metadata inspection through browser surfaces.
- No dedicated YouTube transcript extraction capability is proven from this baseline.
- Any YouTube/video support must be marked research-only or blocked unless a concrete connector/adapter is later added.

## Server/API mutation surfaces to protect

Space Agent includes server APIs that can mutate files and module state, including file_write, file_delete, file_move, file_copy, module_install, module_remove, git history rollback/revert, user/group commands, and cloud-share endpoints.

Gateway implication:

- Space Agent must not receive raw write access through Gateway.
- Space Agent must not get raw root shell, Docker socket, direct secret reads, uncontrolled filesystem writes, or broad app-file mutation access.
- Research mode should expose only owner-safe summaries and read-only packet planning until a Bridge Session explicitly scopes a safe action.

## Integration recommendation

Initial Gateway integration should remain exactly as planned:

- Node type: specialist_agent.
- Role: browser/web/YouTube/Firecrawl research specialist.
- Default mode: read-only research packet.
- Supervisor: Agent Zero.
- Hermes relation: may request research context for skill/workflow design.
- Pi relation: may recommend Space Agent as research route in shadow mode.
- Returns to: Agent Zero or requesting supervising route.
- Execution: disabled by default.
- Bridge Session required for live browser actions, private/login/paywall boundaries, external writes, downloads, uploads, or any protected connector action.

## Open questions / blockers

- No live Space Agent adapter has been activated in production.
- No Firecrawl-native Space Agent integration exists in the inspected repo.
- No dedicated YouTube transcript connector exists in the inspected repo.
- Native browser automation appears tied to packaged desktop/native app mode, not ordinary browser mode.
- A safe Gateway adapter must be designed before live Space Agent browser execution.

## No-secrets confirmation

No API keys, auth tokens, credential files, secret values, or environment-file contents were printed, copied, or committed during this discovery pass.


## Phases 011-020 role lock-in

- Phase 011: Space Agent defined as the Gateway web, browser, YouTube, Firecrawl, crawl, scrape, search, extraction, and page-inspection research specialist.
- Phase 012: Space Agent defined as subordinate to Gateway routing and policy control.
- Phase 013: Agent Zero defined as commander over Space Agent research routing and final owner-facing responsibility.
- Phase 014: Hermes defined as the workflow and skill builder for Space Agent research skills and workflow designs.
- Phase 015: Pi defined as dispatcher candidate that can recommend Space Agent for web research in shadow/recommendation mode.
- Phase 016: Mini-agents defined as subordinate workers under Agent Zero, Hermes, and Pi routes; they do not replace Space Agent or act independently.
- Phase 017: OpenCloud and OpenClaw+ defined as worker/runtime systems under Gateway control, not deletion targets.
- Phase 018: Tony defined as retired/archive only with no active command authority.
- Phase 019: Space Agent added to the Gateway role matrix and mini-agent operating-system role layer.
- Phase 020: Added explicit Space Agent not-commander policy metadata.

## Gateway role matrix outcome

- Owner: final authority.
- Gateway: routing, policy, documentation, memory, and audit hub.
- Agent Zero: commander and supervisor for Space Agent research stages.
- Hermes: lieutenant and workflow/skill builder for Space Agent skills.
- Pi: dispatcher candidate that can recommend Space Agent for web/browser research.
- Space Agent: research specialist that returns structured Research Packets through Gateway.
- Mini-agents: subordinate scoped workers with supervisor, TTL, scope, and audit requirements.
- OpenCloud/OpenClaw+: retained worker/runtime systems.
- Tony: historical archive only.

## Space Agent not-commander policy

Space Agent cannot replace Agent Zero, cannot become commander, cannot bypass Gateway, cannot perform external writes by default, and cannot directly own owner-facing decisions. Research output returns to Agent Zero or the requesting Gateway-supervised route.

## Additional blockers after role lock-in

- Production Space Agent live adapter is not activated.
- Firecrawl-native Space Agent integration is not proven.
- Dedicated YouTube transcript connector is not proven.
- Live browser actions remain Bridge Session scoped and blocked until a safe adapter exists.
