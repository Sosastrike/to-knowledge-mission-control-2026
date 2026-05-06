# Space Agent YouTube Scenario Test Report

Generated: 2026-05-06

## Scope

Phases 221-230 add read-only YouTube Research Packet tests. No live YouTube request, transcript download, browser action, frame capture, video download, Firecrawl action, external write, Zapier write, HeyGen generation, SMB, or farmer action was executed.

## Scenario Coverage

- Phase 221, YouTube URL detection: covered by extracting video URL and video ID from safe YouTube input.
- Phase 222, title extraction: covered from supplied YouTube source metadata.
- Phase 223, channel extraction: covered from supplied YouTube source metadata.
- Phase 224, description extraction: covered from supplied safe metadata input.
- Phase 225, transcript available: covered with official transcript segment handling.
- Phase 226, transcript unavailable: covered with limited packet and `youtube_transcript_unavailable`.
- Phase 227, long video summarization: covered by bounding long transcript claim extraction to 12 claims.
- Phase 228, claim extraction: covered with transcript-backed key claims.
- Phase 229, timestamps: covered for transcript segments, chapters, and blocked frame capture timestamp.
- Phase 230, no full video download by default: covered with blocked download request and removed unapproved frame reference.

## Safety

- YouTube work remains Research Packet planning only.
- Full video download is disabled by default.
- Frame capture references are removed unless tooling is explicitly approved.
- Claims are transcript-backed when transcript segments are provided.
- Missing transcript remains limited, not fake-complete.
- No secrets, auth files, tokens, `.env` values, raw local paths, external writes, or live provider calls were used.

## Validation

- Focused Space Agent YouTube scenario and research tests: passed, 2 files / 30 tests.
- `git diff --check`: passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed.
- `pnpm test`: passed, 122 files / 1,161 tests.
- Staged no-secrets scan: required before commit.
