# CAT Missing Segment Memo

`CAT` on the Fauntleroy / Vashon / Southworth triangle still exposes a
recurring upstream schedule anomaly: the vessel-day chain can imply an
impossible sequence, usually because a physical cycle is missing from the WSF
data we receive.

`VesselTimeline` does not special-case `CAT`. The current behavior is generic
graceful degradation.

## Summary

The important point is that this is not primarily a `VesselTimeline`
calculation bug. The timeline is often being asked to render a discontinuous
or physically implausible chain.

The client currently chooses to:

- keep the timeline structurally valid
- keep the active indicator in a believable range
- avoid inventing an authoritative missing trip

## Current Pipeline

Relevant code:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- [buildSegmentsFromBoundaryEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts)
- [resolveActiveStateFromTimeline.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/resolveActiveStateFromTimeline.ts)
- [buildActiveIndicator.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/renderState/buildActiveIndicator.ts)

Current high-level behavior:

1. the client merges scheduled, actual, and predicted boundary rows
2. broken seams can create placeholder dock segments
3. active-state resolution anchors to live schedule context when possible
4. when live `ScheduledDeparture` is missing, fallback chooses the nearest
   matching row by time window instead of "latest same-terminal row"

That last point matters because it prevents degraded data from placing the
indicator many hours away from the vessel’s plausible current position.

## Typical Failure Pattern

The anomaly usually looks like a vessel/day sequence that implies repeated
same-direction travel without the return movement that would make it
physically possible.

That strongly suggests a missing cycle or passenger-facing schedule omission in
upstream data, not a UI-only issue.

## What The Current Client Solves

- the timeline does not collapse when the chain is broken
- placeholder rows preserve readability without inventing real schedule facts
- active-state fallback stays in a believable time range
- the UI avoids route-specific one-off logic

## What The Current Client Does Not Solve

- it does not reconstruct the truly missing physical sailing
- it does not determine exactly where upstream truth was lost
- it does not turn a broken chain into authoritative official schedule data

## Why We Avoid CAT-Specific Logic

Even though `CAT` surfaces this problem repeatedly, the underlying issue is a
generic data-integrity problem:

- broken seams
- missing physical cycles
- incomplete live schedule context

Hard-coding route-specific frontend behavior would make the feature harder to
reason about and easier to regress later.

## Practical Guidance

- keep the degradation generic, not `CAT`-specific
- prefer explicit placeholder semantics over hidden inference
- avoid fabricating times for a missing segment unless the backend owns that
  inference
- treat frontend placeholder rows as a readability fallback, not a truth repair

## Likely Future Direction

If we ever decide to represent the missing physical movement explicitly, the
cleanest place to do that is probably upstream of the UI:

- detect the anomaly in backend or schedule-derived chronology
- insert explicit placeholder semantics there
- let the frontend render that lower-confidence segment honestly

That would be preferable to adding increasingly clever client-side guesses.

## Design Constraint To Preserve

If a missing segment is ever added to the data model, it should not look like a
normal official sailing unless we truly have authoritative timing for it.

The important UX goal is:

- make the gap understandable
- do not hide the anomaly
- do not overstate confidence
