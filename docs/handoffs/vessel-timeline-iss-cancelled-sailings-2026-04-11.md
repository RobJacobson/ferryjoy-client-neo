# Handoff: ISS VesselTimeline misalignment on cancelled Seattle departures (2026-04-11)

## Status

No code changes remain from the previous investigation attempt.

- Reverted local changes to:
  - `convex/domain/vesselTimeline/timelineEvents.ts`
  - `convex/domain/vesselTimeline/tests/viewModel.test.ts`
- Verification after revert:
  - `bun test convex/domain/vesselTimeline/tests/viewModel.test.ts`
  - `bun run type-check`

## Correct problem statement

The prior investigation misdiagnosed the event sequence.

The important distinction is:

- the **Seattle departures** at **6:45 PM** and **9:05 PM** were cancelled
- the **preceding arrivals** at **6:30 PM** and **8:55 PM** were not the cancelled events

From the bulletin:

- "This cancels the following vessel #1 sailings:"
- "Seattle 6:45 p.m. and 9:05 p.m."

That means the timeline should preserve:

- the **arrival** at Seattle that actually occurred around **6:49 PM**

And should treat as cancelled / missing actual:

- the **6:45 PM departure from Seattle**
- the **9:05 PM departure from Seattle**

## Bulletin context

User-provided notice:

- Sea/Brem - Cancelled Sailings - Bremerton 5:30pm, Seattle 6:45pm, 9:05pm
- Due to a shortage of crew, the `#2 Kaleetan` tied up early after completing the Seattle 5:30 pm to Bremerton.
- `#1 Issaquah` continued service as vessel `#2` beginning with the Bremerton **6:40 PM** to Seattle.

Cancelled vessel #1 sailings:

- Bremerton **5:30 PM** and **7:55 PM**
- Seattle **6:45 PM** and **9:05 PM**

Vessel #2 departures that sailed as scheduled:

- Bremerton **6:40 PM**, **9:00 PM**, **11:40 PM**
- Seattle **7:50 PM**, **10:30 PM**, **12:50 AM**

## Backend architecture overview

This section summarizes the backend using the docs the user pointed at plus the
Convex readmes that govern this feature.

### Docs consulted

- [README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/README.md)
- [docs/convex-mcp-cheat-sheet.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/convex-mcp-cheat-sheet.md)
- [src/features/VesselTimeline/docs/ARCHITECTURE.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md)
- [convex/domain/vesselTimeline/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md)
- [convex/functions/vesselOrchestrator/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/README.md)
- [convex/functions/vesselTrips/updates/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md)

Note:

- there is no repo-root `ARCHITECTURE.md`
- there is no repo-root `convex-mcp-cheat-sheet.md`
- the actual files are the `src/features/.../ARCHITECTURE.md` and
  `docs/convex-mcp-cheat-sheet.md` paths above

### High-level backend shape

From [README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/README.md):

- backend is Convex
- real-time vessel state is updated roughly every 5 seconds
- trip lifecycle, schedule sync, and ML predictions are separate concerns

The key backend tables for this incident are:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`
- `activeVesselTrips`
- `completedVesselTrips`
- `vesselLocations`

### Public VesselTimeline contract

From [src/features/VesselTimeline/docs/ARCHITECTURE.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/docs/ARCHITECTURE.md)
and [convex/domain/vesselTimeline/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md):

The public query is:

- `functions/vesselTimeline/queries.getVesselTimelineBackbone`

It returns:

- `VesselAbbrev`
- `SailingDay`
- ordered `events`

The public timeline query reads only same-day:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

It does **not** read:

- live `vesselLocations`
- previous-day carry-in rows
- backend-owned active interval state

This matters for the bug:

- the UI is faithfully rendering the backend backbone
- if the backbone is wrong or stale, the UI will be wrong in a stable way

### How scheduled rows get there

From [convex/domain/vesselTimeline/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/README.md)
and the earlier handoff work:

- schedule sync seeds a same-day boundary-event skeleton into `eventsScheduled`
- those rows represent the structural day plan
- they are keyed by vessel + sailing day + scheduled departure minute + route terminals

For this incident, those seeded rows were stale and still reflected vessel #1's
original sequence (`5:30`, `6:45`, `7:55`, `9:05`) instead of the replacement
sequence (`6:40`, `7:50`, `9:00`, `10:30`)

### How actuals get written

From [convex/functions/vesselOrchestrator/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/README.md)
and [convex/functions/vesselTrips/updates/README.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/README.md):

The orchestrator flow is:

1. fetch WSF vessel locations once per tick
2. store current `vesselLocations`
3. run `vesselTrips/updates.processVesselTrips`
4. apply deferred timeline write intents (`TickEventWrites`)

Important consequence:

- trip lifecycle writes and timeline overlay writes are derived from live vessel
  identity as it evolves during the day
- those writes can pivot onto a new trip key even if `eventsScheduled` was
  seeded from an older schedule view

That is exactly what happened here:

- `completedVesselTrips` and `eventsActual` pivoted onto replacement keys
- `eventsScheduled` did not

### Why the current merge falls short

Current merge behavior in
[convex/domain/vesselTimeline/timelineEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/timelineEvents.ts)
is intentionally simple:

- exact-key actual rows win
- for arrivals only, there is a fallback reattachment by:
  - `TerminalAbbrev`
  - `ScheduledDeparture`

That helps with some wrong-key arrival cases, but it does **not** solve:

- cancelled scheduled departure slots
- replacement-service trip keys whose scheduled departure minute changed
- mapping later replacement departures onto the stale UI schedule skeleton

So the current backend can express:

- correct replacement trips in `completedVesselTrips`
- exact actual rows on replacement keys in `eventsActual`

while still publishing a misleading backbone because the merge layer has no
notion of "this scheduled departure was cancelled, skip it and shift to the
next surviving departure slot."

### Convex MCP context

From [docs/convex-mcp-cheat-sheet.md](/Users/rob/code/ferryjoy/ferryjoy-client-neo/docs/convex-mcp-cheat-sheet.md):

- dev deployment used in investigation:
  - `https://outstanding-caterpillar-504.convex.cloud`
- production deployment exists as read-only in MCP
- recommended MCP workflow:
  - `status`
  - inspect tables / function specs
  - query dev by default

This mattered because the incident investigation depended on comparing:

- the public backbone query result
- raw `eventsScheduled`
- raw `eventsActual`
- raw `completedVesselTrips`

and proving they disagreed in exactly the way the screenshots showed

## Screenshot-derived table

This is the UI state shown in the screenshots after the reverted experiment.

| Terminal | Kind | Label | Scheduled | Actual shown | Interpretation |
|---|---|---|---:|---:|---|
| Bremerton | Arrival | `Arv: BRE` | 5:15 PM | 5:12 PM | Looks correct |
| Bremerton | Departure | `To: P52` | 5:30 PM | — | Missing actual; this sailing actually happened as the trip that arrived Seattle at 6:49 PM |
| Seattle | Arrival | `Arv: P52` | 6:30 PM | 6:49 PM | Looks correct; normal delayed arrival |
| Seattle | Departure | `To: BRE` | 6:45 PM | 8:06 PM | Wrong; this sailing was cancelled. `8:06 PM` belongs to the later Seattle departure |
| Bremerton | Arrival | `Arv: BRE` | 7:45 PM | — | Missing actual; likely should be backfilled from later replacement-key trip evidence |
| Bremerton | Departure | `To: P52` | 7:55 PM | 9:19 PM | Wrong; this sailing was cancelled. `9:19 PM` belongs to the later Bremerton departure |
| Seattle | Arrival | `Arv: P52` | 8:55 PM | — | Missing actual; later replacement-key trip suggests an arrival around 10:23 PM on the replacement sequence |
| Seattle | Departure | `To: BRE` | 9:05 PM | 10:54 PM | Wrong; this sailing was cancelled. `10:54 PM` belongs to the later Seattle departure |
| Bremerton | Arrival | `Arv: BRE` | 10:05 PM | — | Missing actual; replacement-key trip later arrived around 11:49 PM |

## Backend data table

Data source: Convex dev deployment, vessel `ISS`, sailing day `2026-04-11`.

Relevant scheduled backbone rows after 5:15 PM:

| Scheduled Key | Terminal | Kind | Scheduled | Notes |
|---|---|---|---:|---|
| `ISS--2026-04-11--16:15--P52-BRE--arv-dock` | BRE | Arrival | 5:15 PM | Exact actual exists at 5:12 PM |
| `ISS--2026-04-11--17:30--BRE-P52--dep-dock` | BRE | Departure | 5:30 PM | Exact actual row exists at 6:49 PM, but UI currently shows blank after revert because earlier attempt was reverted and latest screenshots reflect deployed behavior after experimentation; see merged backbone separately |
| `ISS--2026-04-11--17:30--BRE-P52--arv-dock` | P52 | Arrival | 6:30 PM | Exact actual row does not exist |
| `ISS--2026-04-11--18:45--P52-BRE--dep-dock` | P52 | Departure | 6:45 PM | Exact actual row exists at 8:06 PM |
| `ISS--2026-04-11--18:45--P52-BRE--arv-dock` | BRE | Arrival | 7:45 PM | Exact actual row does not exist |
| `ISS--2026-04-11--19:55--BRE-P52--dep-dock` | BRE | Departure | 7:55 PM | Exact actual row exists at 9:19 PM |
| `ISS--2026-04-11--19:55--BRE-P52--arv-dock` | P52 | Arrival | 8:55 PM | Exact actual row does not exist |
| `ISS--2026-04-11--21:05--P52-BRE--dep-dock` | P52 | Departure | 9:05 PM | Exact actual row exists at 10:54 PM |
| `ISS--2026-04-11--21:05--P52-BRE--arv-dock` | BRE | Arrival | 10:05 PM | Exact actual row does not exist |

Raw `eventsActual` rows and replacement-key evidence:

| Actual Key | Terminal | Kind | ScheduledDeparture field | Actual | Why it matters |
|---|---|---|---:|---:|---|
| `ISS--2026-04-11--17:30--BRE-P52--dep-dock` | BRE | Departure | 5:30 PM | 6:49 PM | This row exists on the stale scheduled key |
| `ISS--2026-04-11--18:40--BRE-P52--dep-dock` | BRE | Departure | 6:40 PM | 6:49 PM | Replacement-sequence trip key |
| `ISS--2026-04-11--18:40--BRE-P52--arv-dock` | P52 | Arrival | 6:40 PM | 7:49 PM | Replacement-sequence arrival |
| `ISS--2026-04-11--18:45--P52-BRE--dep-dock` | P52 | Departure | 6:45 PM | 8:06 PM | Stale scheduled key currently absorbing a later actual |
| `ISS--2026-04-11--19:50--P52-BRE--dep-dock` | P52 | Departure | 7:50 PM | 8:06 PM | Replacement-sequence trip key |
| `ISS--2026-04-11--19:50--P52-BRE--arv-dock` | BRE | Arrival | 7:50 PM | 9:05 PM | Replacement-sequence arrival |
| `ISS--2026-04-11--19:55--BRE-P52--dep-dock` | BRE | Departure | 7:55 PM | 9:19 PM | Stale scheduled key currently absorbing a later actual |
| `ISS--2026-04-11--21:00--BRE-P52--dep-dock` | BRE | Departure | 9:00 PM | 9:19 PM | Replacement-sequence trip key |
| `ISS--2026-04-11--21:00--BRE-P52--arv-dock` | P52 | Arrival | 9:00 PM | 10:23 PM | Replacement-sequence arrival |
| `ISS--2026-04-11--21:05--P52-BRE--dep-dock` | P52 | Departure | 9:05 PM | 10:54 PM | Stale scheduled key currently absorbing a later actual |
| `ISS--2026-04-11--22:30--P52-BRE--dep-dock` | P52 | Departure | 10:30 PM | 10:54 PM | Replacement-sequence trip key |
| `ISS--2026-04-11--22:30--P52-BRE--arv-dock` | BRE | Arrival | 10:30 PM | 11:49 PM | Replacement-sequence arrival |

Completed trip rows after 5:15 PM:

| Completed Trip Key | Departs | Arrives | LeftDock | ArriveDest |
|---|---:|---:|---:|---:|
| `ISS--2026-04-11--18:40--BRE-P52` | 6:40 PM | P52 | 6:49 PM | 7:49 PM |
| `ISS--2026-04-11--19:50--P52-BRE` | 7:50 PM | BRE | 8:06 PM | 9:05 PM |
| `ISS--2026-04-11--21:00--BRE-P52` | 9:00 PM | P52 | 9:19 PM | 10:23 PM |
| `ISS--2026-04-11--22:30--P52-BRE` | 10:30 PM | BRE | 10:54 PM | 11:49 PM |

## Root cause

The core issue is not "arrival rows are really cancelled" and not "every too-late departure should slide to the next arrival."

The real failure mode is:

1. `eventsScheduled` is stale and still reflects vessel #1's original sequence:
   - 5:30 BRE departure
   - 6:45 SEA departure
   - 7:55 BRE departure
   - 9:05 SEA departure
2. Live trip projection / `completedVesselTrips` switched ISS onto the replacement service sequence:
   - 6:40 BRE departure
   - 7:50 SEA departure
   - 9:00 BRE departure
   - 10:30 SEA departure
3. `eventsActual` therefore contains both:
   - stale scheduled-key departure rows
   - replacement-key trip rows
4. The current `mergeTimelineEvents` fallback only reattaches **arrival** actuals by:
   - `TerminalAbbrev`
   - `ScheduledDeparture`
5. There is no corresponding semantic remapping for **departure** rows on cancelled sailings.

So the backend currently does this:

- leaves the arrival at **6:30 PM / 6:49 PM** looking reasonable
- but leaves later stale departure keys (`6:45`, `7:55`, `9:05`) carrying actual departure times that really belong to replacement departures (`7:50`, `9:00`, `10:30`)

## Important correction to prior agent attempt

The reverted attempt incorrectly treated the 6:49 PM as belonging to the prior missing departure.

That was wrong.

Correct interpretation:

- `6:49 PM` is the delayed **arrival** for the trip that should end on the **6:30 PM arrival** row
- `8:06 PM` should not stay on the **6:45 PM departure** row because that departure was cancelled
- `8:06 PM` belongs to the later **Seattle departure sequence**, which the UI wants represented against the next surviving departure slot in the stale schedule view

## Working mental model for the next agent

The user's intended mapping is:

- keep **6:30 PM arrival = 6:49 PM**
- blank **6:45 PM departure**
- show **7:55 PM departure = 8:06 PM**
- show **9:05 PM departure = 9:19 PM**

In other words:

- do **not** shift actuals from departures onto preceding arrivals
- do shift later departure actuals **forward over cancelled scheduled departures** to the next meaningful scheduled departure row in the UI's stale schedule skeleton

This is specifically about cancelled **departure** slots.

## What should likely happen next

The next agent should implement a deliberate cancelled-departure remapping heuristic, probably in the merge/read layer, not by mutating stored rows.

Possible direction:

1. Detect a stale scheduled departure row whose exact actual time likely belongs to a replacement-key departure.
2. Use bulletin-consistent evidence already present in backend data:
   - replacement-key `completedVesselTrips`
   - replacement-key `eventsActual`
   - missing exact arrival on the stale destination row may be a clue, but it is not sufficient on its own
3. Distinguish between:
   - valid delayed arrival rows that should remain attached to their arrival slot
   - cancelled departure rows whose exact actual should be skipped
   - later scheduled departure rows that should inherit the replacement departure time

One promising angle is to work from **completed replacement trips** rather than from stale exact departure rows:

- treat replacement trip departures (`18:40`, `19:50`, `21:00`, `22:30`) as the authoritative sequence
- map those onto the stale UI schedule skeleton by terminal and chronological slot, while skipping cancelled departure rows

## Files and queries examined

- `convex/domain/vesselTimeline/timelineEvents.ts`
- `convex/domain/vesselTimeline/tests/viewModel.test.ts`
- Convex query:
  - `functions/vesselTimeline/queries:getVesselTimelineBackbone`
- Convex tables:
  - `eventsScheduled`
  - `eventsActual`
  - `completedVesselTrips`

## Final note

Do not reuse the reverted heuristic that moves a departure actual onto the next arrival row. That diagnosis is incorrect for this incident because the Seattle departures, not the preceding arrivals, were cancelled.
