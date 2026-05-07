# Phase 3 — YouTube Transcript Connector Proof

Generated: 2026-05-07T22:34:41Z

## Result

**Status:** LIMITED / NOT LIVE-PROVEN

**Exact blocker:** `youtube_transcript_connector_not_proven`

Mission Control has the YouTube Research Packet schema and the SpaceAgent planning route, but a dedicated live transcript runtime adapter is not configured. The test did not download video content, bypass login, bypass age/region restriction, or invent transcript-backed claims.

## Connector Detection

| Check | Result |
| --- | --- |
| YouTube transcript dependency present | no |
| YouTube runtime adapter configured | no |
| YouTube transcript schema/path configured | yes |
| Gateway / Agent Hub card | yellow / limited |
| Card blocker | `youtube_transcript_connector_not_proven` |

## Route Proof

| Route | Result |
| --- | --- |
| Authenticated `GET /api/gateway/space-agent/browser/status` | HTTP 200 |
| Authenticated `GET /api/bridge/space-agent/status` | HTTP 200 |
| Authenticated `POST /api/gateway/space-agent/research` with public YouTube URL | HTTP 200 |
| Unauthenticated `POST /api/gateway/space-agent/research` | HTTP 401 |

## YouTube Research Packet Test

Public test URL: `https://www.youtube.com/watch?v=jNQXAC9IVRw`

Request wording used metadata/transcript-only inspection language and did not request video download.

| Field | Value |
| --- | --- |
| Mode | `space_agent_research_packet_planning` |
| Research performed | no |
| Execution enabled | no |
| Writes enabled | no |
| Packet status | `ready` |
| Operation | `youtube_video_inspection` |
| YouTube status | `research_packet_only` |
| YouTube source count | 0 |
| Citation count | 0 |
| No secrets exposed | yes |
| Raw paths exposed | no |

## Interpretation

The route can classify a YouTube inspection request and prepare a planning packet, but it cannot prove title, channel, publish date, transcript availability, transcript-backed claims, or timestamps yet because the live transcript connector is absent. Therefore YouTube Research must remain **yellow / limited**, not green.

## Security / Governance Confirmation

- No video file was downloaded.
- No login, age restriction, region restriction, paywall, or copyright boundary was bypassed.
- No transcript was fabricated.
- No external write occurred.
- No Zapier, HeyGen, SMB, Farmer, upload, email, or connector write occurred.
- No secrets, tokens, auth files, or `.env` values were printed.
- No `.env` file was modified.

## Required Owner/Admin Action

1. Approve or provide a safe YouTube transcript connector path.
2. Wire the connector into SpaceAgent/Gateway as read-only first.
3. Re-run the public transcript-available video test.
4. Promote the UI card from limited/pending only after real metadata/transcript evidence is returned.

## Updated Percentages

| System | Previous | Current | Notes |
| --- | ---: | ---: | --- |
| YouTube Research | 45% | 45% | Schema/planning exists; live transcript connector missing. |
| SpaceAgent Browser Automation | 66% | 66% | Playwright MCP proven; Firecrawl and YouTube still blocked/limited. |
| Gateway / Agent Hub | 72% | 72% | Truthful card state is exposed; owner-authenticated visual proof remains pending. |

## Phase 3 Decision

YouTube Research stays **LIMITED** with `youtube_transcript_connector_not_proven`. No fake transcript, title, channel, timestamp, or claim extraction was reported.
