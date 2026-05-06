# Space Agent YouTube Adapter

Last verified: 2026-05-06

## Purpose

The Space Agent YouTube adapter handles video research requests through Gateway. It extracts public metadata, available transcripts, captions, chapter lists, and transcript-backed claims when those sources are available.

## Source Priority

1. Official metadata and page information.
2. Transcript or captions when available.
3. Description, chapters, and public metadata when transcript is unavailable.

The adapter must report limited or blocked status when transcript access is unavailable. It must not invent claims from an unavailable transcript.

## Supported Fields

- video URL
- title
- channel
- publish date
- description summary
- chapter list
- transcript availability
- transcript-backed claims
- evidence snippets
- citations
- blockers

## Prohibited Behavior

- Do not download full videos by default.
- Do not bypass paywalls, account restrictions, regional restrictions, or copyright controls.
- Do not use owner credentials unless explicitly approved.
- Do not present metadata-only inspection as full video analysis.
- Do not perform external writes or delivery.

## Output Contract

The adapter returns a YouTube Research Packet:

- packet id
- original request
- assigned supervisor
- source URL
- metadata
- transcript summary or limited status
- key claims with evidence
- confidence
- blockers
- recommended next agent

## Handoff

Space Agent returns the packet to Gateway. Gateway then routes it back to Agent Zero, Hermes, Pi, or another responsible specialist. Space Agent does not retain ownership of the final task unless Gateway assigns a new research step.
