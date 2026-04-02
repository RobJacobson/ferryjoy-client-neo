# Vessel Timeline Resolver Handoff

## Purpose

This document is a handoff for the next agent working on the
`VesselTimeline` reliability issues uncovered on April 1, 2026.

The immediate ask is not "patch one more edge case." The real ask is to
rebuild confidence in the mental model, code structure, and data
contracts behind the timeline resolver. The current code has accumulated
too many fallback paths and special cases to be easy to reason about.

This document captures:

- what we observed in production-like Convex data
- which failures are backend vs frontend
- what narrow changes have already been made
- why the resolver likely needs a broader redesign
- a recommended mental model for a more robust system

## Short Version

The timeline system currently blends five concerns together:

1. scheduled timeline structure
2. persisted actual boundary events
3. predicted boundary events
4. live vessel location
5. UI-specific fallback behavior

That blending makes it hard to answer basic questions like:

- which trip does the vessel belong to right now?
- which row should be active?
- which signals are authoritative vs advisory?
- why did the resolver choose this row instead of another?

The April 1 investigation showed that when actual boundary events become
sparse or stop updating, the frontend resolver can attach a vessel to
the wrong same-terminal dock stay, especially during late service.

## Important Vessel Identity Clarification

Part of the early confusion was a vessel identity mixup:

- `KIS` = Kitsap
- `KIT` = Kittitas

The `VesselLocations` row that showed `FAU -> SOU` on route `f-v-s`
belonged to `KIT`, not `KIS`.

That matters because one apparent contradiction was not actually a
timeline bug. It was a different vessel entirely.

## What We Verified in Convex

All of the following was checked directly against Convex via MCP on
April 1, 2026.

### KIS Scheduled vs Actual Event State

For `KIS` on sailing day `2026-04-01`:

- `eventsScheduled` contained the expected Mukilteo/Clinton schedule
  rows after `11:00 AM`
- `eventsActual` mostly stopped after the prior `10:30 AM` trip

The last early-day actuals that were clearly present were:

- `10:30 AM CLI -> MUK dep-dock` actual at about `10:53:24 AM PDT`
- `10:30 AM CLI -> MUK arv-dock` actual at about `11:08:52 AM PDT`

After that, the scheduled rows continued, but the corresponding actual
rows for the next sequence were mostly missing.

### KIS Kept Moving Anyway

This was not a case where the vessel stopped reporting movement.

`vesselLocationsHistoric` and a reconstruction script showed that `KIS`
continued visiting `MUK` and `CLI` throughout the day. So the vessel's
physical movement was still visible in location history even while
`eventsActual` became sparse or stopped updating.

### KIT Was on the Triangle Route

For `KIT`, the reconstructed historic chronology showed normal triangle
behavior with visits to `FAU`, `VAI`, and `SOU`.

That confirmed the triangle-route live row belonged to `KIT`, not
`KIS`.

## Failures Uncovered

These failures are distinct and should not be collapsed into one bug.

### 1. Missing Actual Boundary Events After a Late Arrival

The first failure was backend-side data loss or missed derivation:

- `KIS` arrived late at Mukilteo around `11:08 AM PDT`
- subsequent actual departure and arrival events were mostly not
  recorded in `eventsActual`
- `eventsScheduled` remained present
- `vesselLocationsHistoric` showed the vessel continuing to run service

This means the system kept the schedule backbone, but lost confidence in
the actual-event overlay for much of the day.

### 2. Wrong Same-Terminal Dock Row Attribution

The main frontend failure was not that the vessel looked early.

The actual issue was:

- KIS was at Mukilteo because it had arrived late from the prior trip
- the resolver later matched the vessel to a later Mukilteo dock row
- this happened because multiple dock stays shared the same terminal
- the resolver leaned too heavily on `ScheduledDeparture`

This is a same-terminal ambiguity problem during late service.

### 3. Misleading Active Indicator Placement

Once the wrong dock row was selected, the active indicator could be
rendered at the top of a row whose scheduled arrival was still in the
future.

That did not mean the vessel was being treated as early in the domain
sense. It meant the UI was visually anchored to the wrong visit of the
same terminal.

### 4. Stale Predictions Carried Across Trip Identity Changes

Another independent issue was stale predicted times surviving into later
trip rows.

Example class of bug:

- a later scheduled departure row could display an estimated time from
  hours earlier
- a row around `3:04 PM` could show a predicted departure around
  `12:04 PM`

This is a true stale-state bug and should be fixed separately from the
resolver rewrite.

### 5. Resolver Complexity Itself Is Now a Failure Mode

The resolver code has enough edge-case handling that it is difficult to
predict behavior without stepping through multiple helpers and fallback
chains.

That means:

- bugs are hard to explain
- new fixes are hard to scope
- multiple helpers can silently overlap
- code review becomes low-confidence

The complexity is no longer just an implementation detail. It is itself
a reliability problem.

## Root-Cause Diagnosis

### Backend Root Cause Class

The backend trip/event derivation appears too brittle when the live feed
gets messy around turnarounds.

Based on code inspection and observed behavior, likely triggers include:

- arrival happens after the next scheduled departure
- `LeftDock` is missing or inconsistent
- `AtDock` flips noisily
- terminal fields change abruptly or temporarily disagree
- route transitions are compressed into a short window

The likely result is that the trip pipeline fails to emit coherent
actual departure and arrival boundaries even though raw vessel-location
data still shows continued movement.

### Frontend Root Cause Class

The frontend resolver is trying to make a row-selection decision from a
mix of:

- live location
- scheduled rows
- actual boundaries
- predicted boundaries
- terminal placeholders
- terminal tails
- ad hoc fallback rules

That makes it easy for the resolver to choose a plausible-looking but
wrong same-terminal dock row when service is running late and actual
boundary data is incomplete.

## Files Relevant to the Audit

### Frontend Resolver / Rendering

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/rowEventTime.ts`

### Backend Trip / Event Derivation

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripDerivation.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/eventDetection.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/baseTripFromLocation.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/buildTrip.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/mutations.ts`

### Investigation Support

- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/scripts/reconstruct-vessel-terminal-chronology.ts`
- `/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselLocationsHistoric/queries.ts`

## Changes Already Made

These changes are already in the working tree and should be treated as
baseline context for the next agent.

### 1. Added a Historic Chronology Debug Tool

A reusable TypeScript script was added to reconstruct terminal visits
from `vesselLocationsHistoric` for a given vessel and sailing day.

Key behavior:

- arrival heuristic: within `0.2` miles of a terminal
- departure heuristic: beyond `0.3` miles from that terminal
- intended as debugging ground truth, not authoritative business logic

This tool was used to confirm:

- `KIT` was on `FAU/VAI/SOU`
- `KIS` remained on `MUK/CLI`

### 2. Changed Active Trip Rollover to Delete + Insert

When an active trip becomes completed, the active row is no longer
overwritten in place. The code now:

1. inserts the completed trip
2. deletes the prior active trip row
3. inserts a fresh active trip row

This aligns the persistence model with the domain idea that a new trip
should be a blank slate.

### 3. Added a Resolver Guardrail for Future-Start Dock Rows

A narrow resolver fix was added so an at-dock vessel does not bind to a
schedule-matched dock row when that row's arrival display time is still
in the future.

This is a useful safety rail, but it should not be mistaken for a full
solution to same-terminal ambiguity.

### 4. Added a Defensive Dock-Indicator Fallback

A narrow rendering fix was added so the dock indicator does not pin
itself to the top of a future-start dock row if such a row somehow still
gets selected.

This is a defensive UI fallback, not the core architectural fix.

## Why a Rewrite Is Recommended

The resolver currently mixes together:

- source-of-truth selection
- row candidate generation
- row ranking
- placeholder handling
- terminal-tail fallback
- UI-oriented indicator assumptions

That is too many responsibilities in one place.

The rewrite goal should be:

- make precedence explicit
- make candidate selection explainable
- separate physical vessel state from timeline row choice
- keep schedule as structure, not authority

## Recommended Mental Model

The system should answer two different questions separately.

### Question 1: Where Is the Vessel Physically?

This comes from live location and, when debugging or backfilling, from
historic vessel locations.

This layer should answer:

- is the vessel at dock or at sea?
- what terminal is it currently at?
- if at sea, what terminal pair is it between?
- how reliable is that inference?

This layer should not care about schedule rows yet.

### Question 2: Which Timeline Segment Best Corresponds to That State?

This is where persisted actual events, predicted events, and schedule
rows come into play.

The resolver should match the physical state to candidate rows using an
explicit ranking policy.

## Recommended Source-of-Truth Hierarchy

This is the suggested order of authority.

1. physical vessel state from live location
2. persisted actual boundary events
3. predicted boundary events
4. scheduled timeline structure

Important rule:

Scheduled data should define the day's row geometry and possible
candidates, but should not be treated as the primary proof of which row
is active when service is late.

## Recommended Rewrite Architecture

The next agent should strongly consider a staged pipeline.

### Stage 1: Normalize Segment Metadata

For every segment, derive a normalized candidate descriptor with fields
such as:

- segment id
- segment kind
- terminal / terminal pair
- display start time
- display end time
- has actual start
- has actual end
- has predicted start
- has predicted end
- is in progress at `observedAt`
- starts in future
- distance from current time

This stage should be purely descriptive.

### Stage 2: Build a Physical Vessel Snapshot

Create a small typed snapshot from live location, for example:

- `phase: "dock" | "sea" | "unknown"`
- `currentTerminalAbbrev`
- `departingTerminalAbbrev`
- `arrivingTerminalAbbrev`
- `scheduledDeparture`
- `speed`
- `observedAt`
- `confidence`

This stage should not know how to choose rows. It should only describe
the vessel's inferred real-world state.

### Stage 3: Generate Eligible Candidates by Phase

If phase is `dock`:

- candidate rows should mostly be dock rows at the current terminal
- terminal-tail rows should be explicit fallback candidates
- future same-terminal rows should not outrank already-started rows

If phase is `sea`:

- candidate rows should mostly be sea rows matching the terminal pair
- time-nearest rows are only fallbacks

### Stage 4: Rank Candidates With Explicit Precedence

For dock rows, the ranking should likely prefer:

1. row already in progress at `observedAt`
2. row with actual-backed arrival and matching terminal
3. nearest already-started same-terminal row
4. predicted-backed same-terminal row
5. schedule-matched row as tie-breaker only
6. terminal-tail fallback

For sea rows, the ranking should likely prefer:

1. actual-backed matching terminal pair
2. live-pair row in progress
3. predicted-backed matching terminal pair
4. scheduled-window match
5. nearest time fallback

### Stage 5: Emit Structured Reasoning

The resolver output should contain structured explanation, for example:

- chosen segment id
- ranking rule that won
- rejected candidate list
- rejection reasons
- confidence tier

Without this, future debugging will keep requiring code spelunking.

## Recommended Invariants

The rewrite should explicitly enforce these invariants.

### Invariant 1

`ScheduledDeparture` alone must never choose the active dock row when
multiple same-terminal dock rows are nearby.

### Invariant 2

For an at-dock vessel, a row that has already started should outrank a
same-terminal row that starts in the future.

### Invariant 3

Predicted times may refine timing on a selected row, but should not be
allowed to define trip identity on their own.

### Invariant 4

If the system cannot confidently attribute a vessel to a dock row, it
should prefer a conservative terminal-tail or low-confidence state over
a confidently wrong future row.

### Invariant 5

The indicator renderer should reflect a resolved row choice. It should
not need to rescue resolver mistakes except as a defensive fallback.

## Backend Recommendations

The frontend rewrite should be paired with a backend audit.

### Revisit Event Derivation Robustness

The trip/event derivation pipeline needs review around noisy or missing
feed fields, especially:

- `LeftDock`
- `AtDock`
- terminal transitions
- late arrival past next scheduled departure

### Add Fallback Evidence Rules

If the official feed fields are inconsistent, fallback evidence could be
derived from:

- leaving a terminal geofence and gaining speed
- arriving within terminal geofence and dwelling briefly
- stable terminal transition after transit

### Invalidate Predictions on Trip Identity Change

When trip identity changes, inherited prediction fields should be
cleared or regenerated. A later trip must not carry over stale predicted
times from an earlier trip.

### Consider Repair / Backfill Tooling

The historic chronology script suggests a path for reconstructing missed
actual boundaries from `vesselLocationsHistoric`. That could become a
repair tool for days where `eventsActual` are sparse.

## Testing Recommendations

The replacement should be scenario-tested, not just helper-tested.

At minimum, add regression cases for:

### Case 1: Late Arrival Overlaps Next Scheduled Cycle

- vessel arrives after the next scheduled departure time
- vessel remains at same terminal
- resolver must select the correct same-terminal stay

### Case 2: Missing Actuals but Continued Location History

- `eventsActual` become sparse
- `vesselLocationsHistoric` still shows clear service movement
- resolver must not jump to a future same-terminal row

### Case 3: Missing `LeftDock`

- trip derivation should remain coherent or degrade gracefully

### Case 4: Same-Terminal Ambiguity

- multiple dock rows exist at the same terminal
- a future same-terminal row must not outrank an already-started one

### Case 5: Prediction Sanity

- predicted times that are absurdly stale or inconsistent with the
  current trip should not be displayed normally

### Case 6: Start-of-Day and Terminal-Tail Behavior

- placeholder and terminal-tail logic should continue to work, but under
  explicit rules rather than accidental ordering

## Suggested Deliverables for the Next Agent

1. audit the current resolver path and document all branch precedence
2. design a smaller staged resolver API
3. rewrite row selection around explicit candidate ranking
4. preserve schedule as day structure, not trip identity authority
5. audit backend event derivation separately
6. add scenario-driven regression coverage using the April 1 KIS case

## Bottom Line

This should be treated as a resolver-design problem, not just a bug-fix
problem.

The timeline can only become robust if the code clearly separates:

- physical vessel state
- trip identity
- row selection
- displayed times
- UI fallbacks

The likely right next step is a deliberate rewrite of the resolver with
explicit precedence, smaller responsibilities, and structured reasoning.
