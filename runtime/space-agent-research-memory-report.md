# Space Agent Research Memory Report

Date: 2026-05-06

## Scope

This report covers Space Agent phases 161-170:

- Create `SpaceResearchMemory` schema.
- Default TTL is 24 hours.
- Short task TTL is 30 minutes.
- Project research TTL extension requires owner approval.
- Store source URL and evidence summary.
- Store no secrets.
- Store no raw cookies or session tokens.
- Mark assumptions separately from facts.
- Promote useful research to Brain only after review.
- Expire task memory automatically.

## Implementation

Added a dedicated `SpaceResearchMemory` contract for Space Agent research memory. It is separate from permanent Brain memory and stays temporary unless Agent Zero or the owner reviews and approves promotion to the Brain review queue.

The schema stores:

- Source URL
- Source ID
- Evidence summary
- Facts
- Assumptions
- Blockers
- TTL mode and expiration
- Brain-promotion review status
- Audit trail

## TTL Rules

- Default task memory: 24 hours.
- Short task memory: 30 minutes.
- Project research memory: extended TTL only when owner approval is recorded.
- Unapproved project TTL requests fall back to default-safe TTL and carry an explicit blocker.

## Safety

Space Research memory blocks secret-shaped values, raw cookies, and session token material before memory creation.

No permanent Brain write occurs during creation or promotion request. Promotion creates a reviewed state only after Agent Zero or owner approval.

## Validation

Tests cover:

- Default 24-hour TTL
- Short 30-minute TTL
- Automatic expiration
- Project TTL owner-approval requirement
- Facts separated from assumptions
- Source URL and evidence summary storage
- Secret blocking
- Raw cookie/session-token blocking
- Brain promotion request and Agent Zero review

## No-Secrets Confirmation

No secrets, tokens, auth files, cookies, session values, credentials, or environment values were added.
