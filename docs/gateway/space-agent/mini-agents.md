# Space Agent Mini-Agent Guidance

Last verified: 2026-05-06

## Purpose

Space Agent can request web research mini-agents for bounded research fan-out. Mini-agents remain subordinate workers and never become commander, owner-facing authority, or unrestricted tool users.

## Supported Templates

- Web Research mini-agent
- YouTube Summary mini-agent
- Crawl Mapper mini-agent
- Competitive Research mini-agent
- Source Verifier mini-agent

## Required Definition

Each mini-agent must include:

- id
- name
- purpose
- parent supervisor
- assigned scope
- allowed tools
- forbidden tools
- memory TTL
- output contract
- kill or expire condition
- audit trail

## Scope Rules

- URL scope is mandatory.
- Memory TTL defaults to 24 hours.
- Short task TTL is 30 minutes.
- Project TTL extension requires owner-approved promotion.
- Mini-agents cannot browse outside assigned scope.
- Mini-agents cannot access secrets, Docker socket, root shell, direct credential files, or broad connector execution.
- Mini-agents cannot talk to the owner unless routed through Agent Zero or an approved owner channel.

## Output Contract

Mini-agents return sub-Research Packets. Gateway validates and merges sub-results into the parent Research Packet.

## Promotion

Temporary research memory can be promoted to Brain only after Agent Zero review and Gateway audit. Facts and assumptions must remain separate.
