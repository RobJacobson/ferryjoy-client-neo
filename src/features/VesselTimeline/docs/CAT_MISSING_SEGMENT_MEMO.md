/**
 * Technical memo for the CAT / triangle-route missing-segment anomaly in
 * VesselTimeline.
 */

# CAT Missing Segment Memo

## Summary

`CAT` on the Fauntleroy / Vashon / Southworth triangle still exposes a recurring
WSF data anomaly: the schedule can imply an impossible sequence such as
`VAI -> FAU`, then again `VAI -> FAU`, with no corresponding `FAU -> VAI`
movement in between.

The current code does not special-case `CAT`. The failure mode comes from two
generic frontend behaviors:

1. segment reconstruction gracefully inserts placeholder dock rows when a sea
   segment starts without a same-terminal arrival
2. active-state fallback must choose a “best” row when live schedule context is
   incomplete

The second point was the source of the recent bad indicator placement. When WSF
omitted part of the cycle and the live feed had no `ScheduledDeparture`, the
old fallback picked the latest row at the same terminal, which could place the
indicator hours away from the vessel’s real position. The current code now
chooses the nearest matching row by time window instead.

## Current Pipeline

### Backend

Relevant code:

- [fetchAndTransform.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/scheduledTrips/fetchAndTransform.ts)
- [directSegments.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/scheduledTrips/directSegments.ts)
- [seed.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/seed.ts)
- [liveUpdates.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/liveUpdates.ts)
- [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTimeline/queries.ts)

Current high-level behavior:

1. WSF schedule data is transformed into direct physical sailings.
2. Each direct sailing becomes paired normalized boundary events:
   - `dep-dock`
   - `arv-dock`
3. Actuals and predictions are overlaid into normalized event tables.
4. The frontend reads scheduled, actual, predicted, and current location rows.

### Frontend

Relevant code:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- [buildSegmentsFromBoundaryEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts)
- [resolveActiveStateFromTimeline.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts)
- [resolveActiveSegmentIndex.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/resolveActiveSegmentIndex.ts)
- [buildActiveIndicator.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts)

Current high-level behavior:

1. The frontend merges scheduled, actual, and predicted boundary rows.
2. Adjacent event pairs become semantic segments:
   - `arv-dock -> dep-dock` at same terminal => dock
   - `dep-dock -> arv-dock` => sea
3. If a sea segment starts without a same-terminal arrival immediately before
   it, the frontend inserts an arrival-placeholder dock segment.
4. Active-state resolution happens on the frontend only.

## The CAT / Missing-Cycle Pattern

The recurring evidence still looks like:

- `06:45 SOU -> VAI`
- `07:05 VAI -> FAU`
- `07:55 VAI -> FAU`
- `08:25 FAU -> VAI`

This strongly suggests a missing physical cycle or a passenger-facing omission
in WSF’s published data, not a `VesselTimeline`-specific calculation bug.

The important point is that the timeline may receive a discontinuous chain that
does not describe a believable physical vessel path. That is why CAT keeps
surfacing this issue while other vessels are usually fine.

## Current Graceful-Degradation Behavior

### Placeholder segments

Relevant code:

- [buildSegmentsFromBoundaryEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts)

What the client does today:

- inserts a synthetic dock segment when a departure has no matching prior
  arrival at the same terminal
- marks it as `start-of-day` or `broken-seam`
- gives it zero duration and no real schedule/actual/predicted time

This does not “repair” the missing trip. It only prevents the render pipeline
from collapsing when the event chain is broken.

### Active-state fallback

Relevant code:

- [resolveActiveStateFromTimeline.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts)

Current resolution order:

1. live location anchor
2. open actual-backed row
3. scheduled window fallback
4. terminal-tail fallback
5. edge fallback

Important current degraded-data behavior:

- if live `ScheduledDeparture` is present, we anchor directly by row identity
- if it is missing, we no longer pick the latest same-terminal row
- instead, we pick the same-terminal row whose time window is nearest to `now`

This was added specifically to stop broken WSF CAT cycles from placing the
indicator many hours away from the expected range.

### Indicator copy

Relevant code:

- [buildActiveIndicator.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts)

Current behavior:

- terminal-tail segments show `--` instead of `0m`
- normal segments still show countdown minutes from their end boundary

## What Changed Recently

### Dead backend active-state code was removed

There is no longer a parallel backend active-state resolver kept alive only for
tests. The feature now has a single frontend resolver:

- [resolveActiveStateFromTimeline.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts)

### The off-by-hours degraded-data indicator bug was fixed

The previous implementation could choose the wrong same-terminal row when live
schedule context was incomplete. That produced obviously wrong indicators such
as a vessel appearing twelve hours away from the correct segment.

The current implementation uses nearest-time matching instead of latest-row
matching for terminal-pair fallback.

## Conclusion

There is still no trustworthy way to infer the truly missing physical trip from
WSF schedule data alone. The current code deliberately degrades instead of
inventing an authoritative segment.

The practical goal for now is:

- keep the timeline structurally valid when WSF omits a cycle
- keep the active indicator in a believable range
- avoid CAT-specific one-off logic unless the product explicitly chooses that

Preferred contract term from the user:

- `placeholder`

The intent is to communicate:

- “something happened here that the official schedule did not describe well”
- without pretending to know exact passenger-facing schedule facts

## Core Technical Question

How do we represent and render an inferred placeholder sea segment when we do
not know its exact times?

This is the main design challenge.

## Recommended Backend Options

### Option A: Insert a placeholder segment during schedule-derived reconciliation

Recommended primary direction.

Detect, per vessel/day direct-segment sequence:

- segment `A -> B`
- immediately followed by another segment `A -> B`

Inference:

- a physical vessel cannot perform two same-direction sailings in a row without
  first returning or repositioning
- therefore the sequence contains an omitted reverse movement `B -> A`

Backend action:

- synthesize one placeholder segment `B -> A` between the two repeated direct
  segments
- produce placeholder boundary events from that inferred segment
- mark them with a placeholder field

Suggested additional event metadata:

```ts
Placeholder?: "missing-segment";
```

or, if preferred at row level instead of event level:

```ts
placeholder?: "missing-segment";
```

Advantages:

- the timeline feed becomes self-consistent before it reaches the UI
- frontend stays mostly row-driven and simple
- placeholder semantics are explicit

Risks:

- generic repeated-direction logic may have false positives on routes with
  unusual operational patterns
- requires careful scoping to one vessel/day chronological direct-segment list

### Option B: Reconcile repeated-direction anomalies at the `ScheduledTrip` stage

More principled but broader.

Detect the anomaly inside the schedule transformation pipeline before
`vesselTripEvents` seeding.

Potential insertion point:

- after direct/indirect classification
- before `vesselTripEvents` seed construction

Advantages:

- fixes the issue nearer the source
- downstream consumers of schedule truth could also benefit

Risks:

- touches a more general schedule pipeline
- higher chance of side effects outside `VesselTimeline`

### Option C: Timeline-only reconciliation layer in `vesselTripEvents`

Compromise option.

Keep scheduled-trip data untouched, but add a timeline-specific reconciliation
step before returning the vessel/day event feed.

Advantages:

- scoped to `VesselTimeline`
- lower blast radius

Risks:

- timeline-specific semantics drift farther from core schedule semantics
- adds another normalization stage that future engineers must remember

## Recommended Frontend Options

### Option 1: Render placeholder sea rows with no times and minimum height

Reuse existing “missing times => minimal row” behavior.

How:

- placeholder boundary events have no scheduled/actual/predicted times
- current duration fallback returns `1`
- row gets minimum height

Advantages:

- minimal code

Disadvantages:

- too visually small for an important anomaly
- may not communicate a missing physical segment clearly enough

### Option 2: Render placeholder sea rows with fixed illustrative duration

Recommended frontend direction if placeholder segments are added.

How:

- placeholder rows receive an explicit display mode, for example:
  or a dedicated semantic flag that the layout layer can recognize
- placeholder rows use a fixed illustrative duration, e.g. `15` or `20`
- no exact timestamps are claimed
- schedule column shows `--`
- actual/estimated column remains blank unless stronger truth becomes available

Advantages:

- understandable UI
- limited code changes
- no need to infer exact midpoint timestamps
- avoids pretending we know the real schedule time

Disadvantages:

- layout is illustrative, not temporally exact

### Option 3: Split the surrounding dock gap and place the placeholder midway

More precise-looking but not recommended initially.

How:

- use previous and next real rows
- derive inferred placement from the surrounding gap
- center the placeholder in the interval

Advantages:

- more elegant temporal positioning

Disadvantages:

- significantly more code and layout complexity
- high risk of technical debt for an isolated anomaly class

## Recommended UX

If a placeholder missing segment is introduced, it should not look like a
normal official sailing.

Recommended UX treatment:

- label as `Placeholder`, `Unlisted sailing`, or `Schedule gap`
- show terminals honestly, e.g. `FAU -> VAI`
- scheduled column: `--`
- actual/estimated column: blank unless explicitly inferred from stronger data
- visually distinct row treatment
  - lighter styling
  - dashed/altered marker styling if feasible
  - lower visual confidence than standard rows

Important UX principle:

- do not hide the anomaly
- do not render it as fully authoritative official schedule data

## Minimal-Technical-Debt Recommendation

If another agent picks this up later, the recommended implementation order is:

1. Add a placeholder-capable data contract in the timeline feed.
2. Detect repeated-direction direct segments in backend schedule-derived
   chronology.
3. Insert one inferred reverse placeholder segment between them.
4. Render placeholder sea rows with fixed display duration, not midpoint time
   inference.
5. Exclude placeholder rows from active-indicator logic.

This avoids:

- complex inferred timestamp math
- frontend-only route heuristics
- heavy dependence on completed-trip truth

## Concrete Suggested Contract

One possible low-churn approach:

Extend `VesselTripEvent` with:

```ts
Placeholder?: "missing-segment";
```

Then:

- placeholder departure event
- placeholder arrival event

can still flow through the existing frontend row builder.

The frontend can derive a placeholder sea row because:

- `dep-dock -> arv-dock` still yields a sea row
- missing timestamps already degrade safely
- a fixed display duration can be layered on top with limited changes

## Places Likely To Change

Backend candidates:

- [seed.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/seed.ts)
- [liveUpdates.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/events/liveUpdates.ts)
- [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTripEvents/queries.ts)
- possibly scheduled-trip transform files if choosing upstream reconciliation

Frontend candidates:

- [buildSnapshot.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimeline/snapshots/buildSnapshot.ts)
- [types.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/types.ts)
- [getLayoutTimelineRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/getLayoutTimelineRows.ts)
- [TimelineRowEventTimes.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowEventTimes.tsx)
- possibly row marker/body styling if placeholders need a distinct treatment

## Questions For Future Work

- Should placeholder inference be limited to the triangle route first?
- Is repeated-direction detection alone sufficient, or do we need additional
  guardrails such as minimum/maximum turnaround gaps?
- Should placeholder segments exist only in `VesselTimeline`, or in
  `vesselTripEvents` generally?
- Should placeholder rows be announced in accessibility copy as lower
  confidence?
- Should the active indicator always ignore placeholders, or only ignore them
  when they lack actual/predicted times?

## Current Status

As of this memo:

- active-state ownership refactor is implemented
- context simplification is implemented
- actual-only degraded time rendering is implemented
- no placeholder missing-segment inference has been implemented yet

The CAT anomaly remains unresolved at the timeline-data level and is a good
candidate for a later targeted backend-plus-frontend pass.
