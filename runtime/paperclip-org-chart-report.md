# Paperclip Gateway Org Chart Report

Date: 2026-05-06
Scope: Paperclip phases 091-100

## Summary

Defined the sandbox Paperclip org chart for the To Knowledge Gateway workforce. Owner/Board is the root authority, Gateway is the non-executing control layer below Owner/Board, Agent Zero is the commander below Gateway/Owner, and the rest of the workforce reports through Agent Zero or Gateway policy as appropriate.

This was completed in the Paperclip sandbox embedded database only. No production service was persisted and no public access was opened.

## Phase Results

| Phase | Result |
| --- | --- |
| 091 - Define org chart root: Owner/Board | Passed |
| 092 - Gateway under Owner as control layer | Passed |
| 093 - Agent Zero reports to Gateway/Owner | Passed |
| 094 - Hermes reports to Agent Zero | Passed |
| 095 - Pi reports to Gateway/Agent Zero for dispatch recommendations | Passed |
| 096 - SpaceAgent reports to Agent Zero/Pi route | Passed |
| 097 - Mini-agents report to assigned supervisor | Passed as Mini-Agent Workforce policy node |
| 098 - OpenCloud workers report to Gateway policies | Passed |
| 099 - OpenClaw+ skills report to Gateway registry | Passed |
| 100 - Tony archived, no active reporting line | Passed |

## Org Chart

Root authority:
- Owner/Board

Control layer:
- Gateway Control Layer, non-executing, reports to Owner/Board

Command layer:
- Agent Zero, commander / CEO-equivalent, reports to Gateway Control Layer and Owner/Board

Workforce reporting lines:

| Node | Role | Active status | Reports to | Notes |
| --- | --- | --- | --- | --- |
| Gateway Control Layer | Gateway / control layer | idle | Owner/Board | Non-executing policy, routing, registry, audit, documentation, and Bridge Session control layer |
| Agent Zero | Commander / CEO-equivalent | idle | Gateway Control Layer / Owner Board | Final operational commander below owner authority |
| Hermes | Lieutenant / skills lead | idle | Agent Zero | Skill, workflow, automation, and mini-agent design lead |
| Pi | Dispatcher / operations advisor | idle | Gateway Control Layer / Agent Zero review | Shadow dispatcher and route advisor |
| SpaceAgent | Web research specialist | idle | Agent Zero, routed by Pi/Gateway when selected | Browser/web/YouTube/Firecrawl research specialist |
| Mini-Agent Workforce | Scoped mini-agent pool | idle | Gateway Control Layer, assigned supervisor per mini-agent | Each mini-agent needs supervisor, scope, memory TTL, output contract, kill condition, and audit trail |
| OpenCloud | Worker / runtime engine | idle | Gateway Control Layer policies | Retained worker/runtime layer; not a deletion target |
| OpenClaw+ | Runtime / skills engine | idle | Gateway Control Layer registry | Runtime, skills, adapters, reports, and governance support |
| Existing Specialist Workforce | Retained specialists | idle | Agent Zero or assigned supervisor | Existing agents retained, not deleted or replaced |

Archived-only record:

| Node | Status | Reports to | Notes |
| --- | --- | --- | --- |
| Tony Historical Archive | terminated | none | Historical archive only; no active reporting line and no active commander authority |

## Validation Checks

- To Knowledge Gateway company is active: yes
- Active owner board membership exists: yes
- Gateway Control Layer exists as root control node under Owner/Board: yes
- Agent Zero reports to Gateway Control Layer: yes
- Hermes reports to Agent Zero: yes
- Pi reports to Gateway Control Layer with Agent Zero review metadata: yes
- SpaceAgent reports to Agent Zero with Pi/Gateway routing metadata: yes
- Mini-Agent Workforce policy node exists: yes
- OpenCloud reports to Gateway policy: yes
- OpenClaw+ reports to Gateway registry: yes
- Tony appears in active workforce list: no
- Tony archive record has active reporting line: no
- Paperclip sandbox stopped after validation: yes

## Policy Metadata

The org chart records include policy metadata for:

- no external writes by default
- Bridge Session required for protected execution
- no direct secret access
- no raw shell/root access
- no Docker socket access
- no autonomous owner-facing authority for workforce nodes
- mini-agent assigned-supervisor requirement
- Tony archive-only state

## Safety Confirmation

- Secrets printed: no
- Auth files printed: no
- API keys printed: no
- Tokens printed: no
- .env files modified: no
- Production Mission Control database used: no
- OpenCloud production data modified: no
- Build-Wiki/Farmer modified or run: no
- SMB mounted: no
- Zapier writes: no
- HeyGen generation: no
- Public Paperclip exposure: no
- Persistent Paperclip service created: no

## Remaining Blockers

- Paperclip owner login through an authenticated owner account is still not proven; this remains sandbox local-trusted setup.
- Gateway-to-Paperclip production integration is still pending.
- Individual mini-agent creation remains policy-defined, not live execution-enabled.
- Existing specialist agents are represented as an aggregate until Gateway registry import expands them individually.

## Rollback

Report rollback:

    git revert <commit>

Sandbox data rollback should use Paperclip company/agent archive tooling after explicit owner approval. No production deletion or disablement occurred.
