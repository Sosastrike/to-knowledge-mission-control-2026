# Agent File Handoff & Tool-Use Behavior Policy

**Status:** v1.0 — owner-directed standard
**Generated:** 2026-04-29T14:40Z
**Authority:** Luis (owner) directive 2026-04-29
**Scope:** Tony · Agent Zero · Hermes / Hermit · OpenCloud / OpenClaw agents · all future agents
**Authority hierarchy reminder:** Luis > Tony > specialists. This policy is enforced by Tony for every downstream agent it dispatches.

---

## 0 · TL;DR

When an agent is asked to **save**, **upload**, **share**, or **move** a file:

1. **Generate or locate** the artifact first; emit its concrete path or link.
2. **Identify the target destination** (Google Drive / Dropbox / GitHub / Slack / S3 / etc.).
3. **Check write access** for the destination (tool / connector / API permission).
4. **If write access exists:** perform the action and report success with the destination link.
5. **If write access is missing:** the agent must NOT stop with "I don't have permission." It must:
   - emit the file at a known local/chat path
   - state the precise blocker (which connector / scope / credential)
   - provide an explicit manual-upload runbook the owner can follow
   - **continue with the next project task without waiting for the upload**

The agent never abandons a project for a missing connector. The agent ALWAYS hands off the artifact in a recoverable state and keeps building.

---

## 1 · The problem this policy fixes

Observed failure mode (current production):

> Owner: "Save the report to my Google Drive."
> Agent: "I don't have permission to write to Google Drive."
> [agent stops; project halts; owner has no file, no manual path, no continuation]

This is wrong on three axes:

| Axis | What the agent did | What it should have done |
|------|-------------------|-------------------------|
| **Artifact integrity** | implied no file existed | emit the file at a concrete path the owner can read |
| **Diagnostic precision** | "no permission" (vague) | name the missing connector / scope / credential |
| **Project continuity** | stopped | hand off the file + provide manual steps + continue with the next task |

### Critical distinction (must be kept clear at all times)

| Surface | Description | Default agent capability |
|---------|-------------|--------------------------|
| **Local artifact** | a file written to disk (e.g. `/home/tony/...` or `/tmp/...`) | available to most agents |
| **Chat attachment / link** | a file path/URL emitted in a chat message | available to all agents |
| **External platform write** | actually creating the file inside a third-party service (Drive/Dropbox/etc.) | requires connector + credential + scope |
| **Connector / API permission** | the agent has the right OAuth scope / API key for the destination | varies per agent and per platform |
| **Owner manual upload** | owner uploads the local artifact to the destination by hand | always available as a fallback |

**Sharing a file in chat is NOT the same as writing to Google Drive.**
**Local file existence is NOT the same as cloud upload completion.**
**A connector being installed is NOT the same as having WRITE scope.**

These distinctions must appear verbatim in every blocker message.

---

## 2 · Scope and applicability

### Agents that MUST follow this policy

| Agent | Role | Notes |
|-------|------|-------|
| Tony | Conductor | enforces this policy on all downstream dispatches |
| Agent Zero | Supervisor / reviewer | applies the policy when authoring artifacts |
| Hermes / Hermit | Skill / workflow specialist | applies for any artifact handoff |
| OpenCloud / OpenClaw agents (Forge, Atlas, Builder, Echo, Growth, Loom, Operator, Pacman, QA, Researcher, Archivist) | Specialists | inherit the policy by default |
| All future agents | n/a | inherit the policy at creation |

### Out of scope (this policy does NOT change)

- Credentials in `.env` or any secret store
- Google Drive credentials / OAuth tokens
- Tony memory, voice, governance, lock state
- Cloudflare / Caddy / firewall / Docker
- Production DB migrations
- Git commits / pushes
- Routing decisions (OpenRouter / NVIDIA / Hermes wiring)

---

## 3 · The 5-step decision flow (mandatory)

Every "save/upload/share/move file" request goes through this flow without exception:

```
┌──────────────────────────────────────────────────────────────────┐
│ STEP 1 — Locate or generate the artifact                          │
│   - Determine: does the file already exist? where?                 │
│   - If not: generate it now to a concrete local or workspace path. │
│   - Output: { path: "/abs/path", size: N, sha256?: "..." }         │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 2 — Identify target destination                              │
│   - Owner-stated platform (Drive, Dropbox, S3, Slack, etc.).      │
│   - If ambiguous, choose the most likely target and ANNOUNCE it    │
│     so the owner can correct in one reply.                         │
└──────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 3 — Check write access                                        │
│   - Is the connector installed?                                    │
│   - Is the credential present and in scope (read vs write)?        │
│   - Is the destination folder/path within the allowed scope?       │
│   Output: permission = available | missing | owner_action_required │
└──────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │ available                       │ missing / owner_action_required
              ▼                                 ▼
┌───────────────────────────┐    ┌───────────────────────────────────────┐
│ STEP 4a — Perform action  │    │ STEP 4b — Manual handoff              │
│ - Execute the write.      │    │ - Emit file path/link in chat.        │
│ - Verify success.         │    │ - State the EXACT blocker.            │
│ - Emit the destination    │    │ - Provide step-by-step manual upload. │
│   link.                   │    │ - Suggest the connector/scope needed. │
└───────────────────────────┘    └───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│ STEP 5 — Continue the project                                     │
│   - Identify the next planned task.                                │
│   - Begin it without waiting for upload completion.                │
│   - Mark the file-handoff as a side track, not a blocker.          │
└──────────────────────────────────────────────────────────────────┘
```

Stopping after Step 4b is **forbidden**. The agent always proceeds to Step 5.

---

## 4 · Standard response format (mandatory schema)

Every file-handoff response carries this six-field block, even when the upload succeeds:

```
**File handoff**
- File ready: <local path or workspace link>
- Destination requested: <platform name + folder/path if any>
- Permission status: available | missing | owner_action_required
- Next action: upload_done | manual_upload_steps | connector_needed
- Manual steps (if applicable):
    1. <step>
    2. <step>
    3. <step>
- Continue project: <next task name + ETA / status>
```

### Permission-status vocabulary

| Token | Meaning |
|-------|---------|
| `available` | agent has the connector + credential + scope; action will or did succeed |
| `missing` | connector installed but missing scope/credential, OR connector not installed |
| `owner_action_required` | needs human intervention (OAuth grant, scope upgrade, manual upload) |

### Next-action vocabulary

| Token | Meaning |
|-------|---------|
| `upload_done` | the file is now at the destination; include link |
| `manual_upload_steps` | the file is at a local path; owner uploads via the listed steps |
| `connector_needed` | install/authorize the connector first, then re-run the request |

---

## 5 · Worked examples

### Example 5.1 — Google Drive write succeeds

```
**File handoff**
- File ready: /tmp/q3-report.pdf (sha256: 2f9c…1b)
- Destination requested: Google Drive → /Reports/Q3-2026/
- Permission status: available
- Next action: upload_done → https://drive.google.com/file/d/abcd1234
- Continue project: next task — "draft Q3 ops summary email" (ETA 2 min)
```

### Example 5.2 — Google Drive write blocked by missing scope

```
**File handoff**
- File ready: /tmp/q3-report.pdf (sha256: 2f9c…1b)
- Destination requested: Google Drive → /Reports/Q3-2026/
- Permission status: owner_action_required
- Next action: manual_upload_steps
- Manual steps:
    1. Open https://drive.google.com/drive/folders/<your folder>
    2. Drag /tmp/q3-report.pdf into that folder, OR click New → File upload
    3. Confirm the new file shows in the folder
- Continue project: next task — "draft Q3 ops summary email" (ETA 2 min)
- Connector note: Google Drive connector is read-only in this agent. Owner can grant write scope at Settings → Integrations → Google Drive → Re-authorize with `drive.file` scope.
```

### Example 5.3 — Dropbox connector not installed

```
**File handoff**
- File ready: /tmp/build-log.zip (12.4 MB)
- Destination requested: Dropbox → /Builds/2026-04/
- Permission status: missing
- Next action: connector_needed
- Manual steps:
    1. Owner installs Dropbox MCP connector OR provides DROPBOX_ACCESS_TOKEN
    2. Re-run: "save build-log.zip to Dropbox /Builds/2026-04/"
- Continue project: next task — "kick off staging deploy" (ETA 3 min)
```

### Example 5.4 — Slack share

```
**File handoff**
- File ready: /tmp/screenshot.png
- Destination requested: Slack → #design-review
- Permission status: available
- Next action: upload_done → https://slack.com/files/...
- Continue project: next task — "ping QA on the regression" (ETA 30 sec)
```

### Example 5.5 — Owner asks for "a file" with no destination

```
**File handoff**
- File ready: /tmp/agent-status.json
- Destination requested: (none stated — defaulting to chat link)
- Permission status: available
- Next action: upload_done → file linked above
- Continue project: next task — proceed with prior plan (no destination requested)
- Optional: if you want this on Drive/Dropbox/Slack, reply with the target and I'll move it.
```

---

## 6 · The "do not stop" rule

The agent **must not** end a turn with any of the following alone:

- "I don't have permission to do that."
- "I cannot access Google Drive."
- "This requires a connector I don't have."
- "Please upload it manually." *(without giving the file path or steps)*

These are **incomplete responses**. Each must be paired with:

- the concrete artifact path or link, AND
- the named blocker (which scope/connector/credential), AND
- explicit manual steps (if applicable), AND
- the next project task the agent will begin.

If the agent genuinely has no artifact yet (e.g. it was asked to upload a non-existent file), it must:
1. Ask one clarifying question OR generate a placeholder artifact with what it knows
2. Still continue with the next task it can do

---

## 7 · Bridge Mode / Agent Operations note (mandatory addition)

Add the following to the Bridge Mode policy notes (read-only surface today; enforced via instructions to all agents):

> **Agent file-handoff distinction** (v1.0 — 2026-04-29)
>
> Every agent must distinguish five surfaces when handling files:
>
> 1. **local artifact access** — file written to local disk
> 2. **chat attachment sharing** — file path/link emitted in chat
> 3. **external platform write access** — file created inside a third-party service via connector
> 4. **connector / API permission** — agent has installed connector + valid credential + correct scope
> 5. **owner manual upload** — fallback path the owner executes by hand
>
> A file at surface 1 or 2 is NOT the same as a file at surface 3.
> Missing capability at surface 3 or 4 NEVER justifies stopping the project; surface 5 is always available as the manual fallback, and the agent must keep moving.

This note will be included as a string field in the Bridge Providers status surface (added later in a separate, owner-approved change). Today it lives in this policy doc.

---

## 8 · Mission Control UI recommendation (plan-only)

When the MC UI catches up to this policy, render a **File Handoff** panel for any artifact-producing agent run:

| Field | Source | Display |
|-------|--------|---------|
| File generated | agent output `path` | clickable local-path link |
| File location | resolved absolute path or HTTPS link | copyable text + "Open" button |
| Target platform | agent output `destination` | platform icon + folder path |
| Upload status | `permission_status` + `next_action` | colored badge: green `done` / yellow `manual` / red `connector_needed` |
| Missing permission | named blocker (e.g. `drive.file scope`) | inline tooltip with "Re-authorize" link if applicable |
| Owner action needed | the manual_upload_steps list | numbered list with checkboxes |
| Continue project | next task name + ETA | small subtext under the panel |

**Where it lives in MC v2:**

- Inside any agent-run view (sidebar tab "Files & Handoffs")
- A global "Handoff inbox" page that lists every pending manual-upload across all agents
- A badge on the agent card when at least one handoff is waiting on owner action

**Backend wiring** (when approved separately):

- Each agent emits a `file_handoff` event into the trace store with the six-field schema above
- New read-only endpoint `GET /api/bridge/handoffs?agent_id=&status=` returns recent handoffs
- No DB writes from the UI (read-only); manual-upload completion is owner-driven outside MC

This is plan-only. **No UI is built today.** No DB migrations today. No new endpoints today.

---

## 9 · Per-agent implementation notes

### 9.1 Tony (conductor)

- When Tony dispatches a task to a sub-agent, Tony adds this policy to the dispatch prompt by reference: "follow Agent File Handoff & Tool-Use Behavior Policy v1.0".
- Tony is the FIRST line of defense: if a sub-agent returns "I don't have permission" without a handoff block, Tony rewrites the response into the standard schema before showing it to the owner.
- Tony never delegates the manual-upload steps; it generates them itself based on the destination platform.

### 9.2 Agent Zero

- Treat any artifact in `/workspace/`, `/tmp/`, or chat as a Surface-1 (local) artifact.
- For external write requests, Agent Zero emits the standard schema and invokes Tony for the connector decision.

### 9.3 Hermes / Hermit

- Same as the above. Hermes is sandboxed today; **all** of its destination writes are Surface-3 from a permission perspective until the owner approves bridging.
- Hermes default response: produce the file at its working dir, emit the path, and provide manual-upload steps for whichever destination was requested.

### 9.4 OpenCloud / OpenClaw specialists (Forge, Atlas, Builder, Echo, Growth, Loom, Operator, Pacman, QA, Researcher, Archivist)

- All inherit this policy via their per-agent `MEMORY.md`. (Memory edits are out of scope for today; this policy doc is the canonical reference until the next memory governance pass.)
- Each specialist may have a distinct allow-list of connectors. The decision flow is the same; only Step 3's answer differs.

### 9.5 Future agents

- This policy is included in the new-agent onboarding template.
- Adoption is automatic at agent creation.

---

## 10 · Adoption checklist

| Item | Owner | Status |
|------|-------|--------|
| Policy doc landed at this path | Tony | ✓ done with this commit |
| Tony dispatch prompt cites this policy by reference | Tony (next config edit, no memory write today) | pending owner approval |
| Agent Zero / Hermes / specialists notified via Bridge | Tony | pending — to be queued in next bridge sync |
| Bridge Mode policy-notes string updated | Tony | pending — additive read-only field, owner-approved later |
| MC UI File Handoff panel | designer + Tony | plan-only today |
| `GET /api/bridge/handoffs` endpoint | OpenClaw runtime | plan-only today |
| Trace-store `file_handoff` event schema | OpenClaw runtime | plan-only today |

Nothing on this list requires credential changes, DB migrations, or commits today. All execution items are owner-gated to the next approved cycle.

---

## 11 · Sacred invariants verified

| Invariant | State |
|-----------|-------|
| Credentials | NOT touched |
| Google Drive credentials / OAuth tokens | NOT touched |
| Tony memory | NOT touched |
| Tony voice | NOT touched |
| Governance | NOT touched |
| Cloudflare / Caddy / firewall / Docker | NOT touched |
| Production DB | NOT touched |
| Commits / pushes | NOT executed |
| `.env` | NOT modified |

---

## 12 · Sign-off

Policy v1.0 — author: Tony (on Luis's 2026-04-29 directive). Effective immediately for any new dispatch. Existing in-flight dispatches finish under prior rules; the next dispatch from Tony onward applies this policy.

End of policy.
