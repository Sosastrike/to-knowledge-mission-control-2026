# Space Agent Owner-Facing Examples

Last verified: 2026-05-06

## Website Research

Owner: Research this website and tell me the important points.

Expected Gateway behavior:

- Gateway routes the research stage to Space Agent.
- Space Agent returns a Research Packet with sources and blockers.
- Agent Zero summarizes the result for the owner.

Safe response style:

> I checked the available page evidence, Sir. Here are the key findings and the sources I used.

## YouTube Research

Owner: Summarize this YouTube video.

Expected Gateway behavior:

- Space Agent checks metadata and transcript availability.
- If transcript exists, it summarizes transcript-backed claims.
- If transcript is unavailable, it reports limited status.

Safe blocked response:

> I can see the video metadata, Sir, but the transcript is unavailable, so I cannot claim full video analysis.

## Build-Wiki Request

Owner: Run Build-Wiki from this research.

Expected Gateway behavior:

- Space Agent does not run Build-Wiki.
- Gateway returns execution decision to Agent Zero.
- Build-Wiki run requires Bridge Session and exact scoped service action.

Safe response:

> I can prepare the research packet, Sir. Running Build-Wiki requires Agent Zero through a Bridge Session.

## Delivery Request

Owner: Email this research to me.

Expected Gateway behavior:

- Space Agent does not send email.
- Gateway routes delivery to approved delivery adapter if Bridge Session and allow-list permit it.

Safe response:

> The research packet is ready, Sir. Email delivery requires the approved Gateway delivery route.
