/**
 * Technical memo for the CAT / triangle-route missing-segment anomaly in
 * VesselTimeline.
 */

# CAT Missing Segment Memo

## Summary

This memo documents a recurring data-quality issue affecting the
`VesselTimeline` for vessel `CAT` (Cathlamet) on the
Fauntleroy / Vashon / Southworth triangle.

The user-facing symptom is that the timeline can render an impossible physical
sequence such as:

- `VAI -> FAU`
- then again `VAI -> FAU`

with no intervening `FAU -> VAI` or at least no indication that the schedule
feed is discontinuous.

This is a credibility problem for the timeline UI. Even if WSF's public
schedule or API omits a segment, our timeline should not confidently display an
impossible vessel path with no caveat.

This memo explains:

- the current backend/frontend pipeline
- the specific data pattern causing the break
- why the current placeholder behavior is not sufficient
- what has already been attempted
- recommended backend and frontend directions

## Current Timeline Pipeline

### Backend flow

Relevant code:

- [fetchAndTransform.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/scheduledTrips/fetchAndTransform.ts)
- [directSegments.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/scheduledTrips/directSegments.ts)
- [estimates.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/scheduledTrips/transform/estimates.ts)
- [seed.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTripEvents/seed.ts)
- [liveUpdates.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTripEvents/liveUpdates.ts)

Current high-level behavior:

1. Raw WSF schedule segments are fetched and mapped into `ScheduledTrip`.
2. Trips are classified as direct vs indirect by vessel/day chronology.
3. Only direct physical segments are used to seed `vesselTripEvents`.
4. Each direct segment produces:
   - one `dep-dock` event
   - one `arv-dock` event
5. Live data and vessel history enrich the seeded event rows in place.
6. The timeline query returns a normalized event feed plus compact active state.

### Frontend flow

Relevant code:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)
- [buildSnapshot.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimelineSnapshots/buildSnapshot.ts)
- [getLayoutTimelineRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/getLayoutTimelineRows.ts)
- [TimelineRowEventTimes.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowEventTimes.tsx)

Current high-level behavior:

1. The frontend consumes normalized `vesselTripEvents`.
2. Adjacent event pairs become semantic rows:
   - `arv-dock -> dep-dock` at same terminal => dock row
   - `dep-dock -> arv-dock` => sea row
3. If a sea row starts with no immediately preceding same-terminal arrival, the
   frontend inserts an arrival-placeholder dock row.
4. Placeholder rows have no true times and currently rely on minimum-height
   layout fallback.

## The Specific CAT Problem

### User-facing symptom

The timeline can show two surrounding segments that both read `VAI -> FAU`,
even though the vessel must have physically reversed direction or otherwise
repositioned in between.

The impossible visual sequence is what breaks trust.

### Why this is not just a UI issue

The issue is not simply missing formatting or missing actuals. The actual
problem is that the schedule-derived event chain is discontinuous in a way that
does not represent a valid physical vessel path.

Even if WSF's published schedule omits or misclassifies a trip, the timeline
should not present that broken chain as if it were a normal day plan.

## Relevant Evidence

### 1. `vesselTripEvents` evidence

The provided event sample for `2026-03-24` includes, in order:

- `06:45 SOU -> VAI`
- `07:05 VAI -> FAU`
- `07:55 VAI -> FAU`
- `08:25 FAU -> VAI`

Important rows from the sample:

- `dep-dock` at `07:55`, `TerminalAbbrev: "VAI"`
- matching arrival row for that block carries inconsistent terminal semantics
- then `dep-dock` at `08:25`, `TerminalAbbrev: "FAU"`

This is sufficient to produce a broken timeline seam or duplicate-direction
visual story.

### 2. `CompletedVesselTrip` evidence

The provided completed-trip data for `2026-03-24` includes:

- `CAT--2026-03-24--06:45--SOU-VAI`
- `CAT--2026-03-24--07:05--VAI-FAU`
- `CAT--2026-03-24--07:55--VAI-FAU`
- `CAT--2026-03-24--08:25--FAU-VAI`

This shows that richer trip lifecycle data also contains the strange repeated
direction.

The user's product interpretation is that the `~7:30` / `7:55` gap likely
contains a missing physical reposition or unlisted trip, even if the public
schedule/API does not publish it.

### 3. `ScheduledTrip` evidence

The provided scheduled-trip sample from another day (`2026-03-30`) shows the
same recurring structure:

- `06:45 SOU -> VAI`
- `07:05 VAI -> FAU`
- `07:55 VAI -> FAU`
- `08:25 FAU -> VAI`

This matters because it means:

- the discontinuity appears to originate in scheduled data itself
- this is not merely a live-update pollution issue
- we can detect the anomaly in advance without relying on completed-trip truth

### 4. Public WSF webpage evidence

The public schedule screenshot also reflects the same omission/inconsistency:

- `07:05` appears in `Leave Vashon`
- `08:25` appears in `Leave Fauntleroy`
- there is no corresponding listed crossing that would reconcile the duplicate
  same-direction sequence in our vessel-specific interpretation

This supports the product assumption that the public schedule itself may omit a
segment or omit its publishable passenger-facing representation.

## Why the Current Placeholder Behavior Is Not Enough

Relevant code:

- [buildSnapshot.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimelineSnapshots/buildSnapshot.ts)
- [TimelineRowEventTimes.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowEventTimes.tsx)

Current placeholder behavior is designed for:

- start-of-day orphan departures
- generic degraded cases where a matching arrival is absent

It does not solve the deeper UX issue here because:

- the repeated-direction anomaly is not simply a missing arrival label
- the vessel path itself becomes implausible
- rendering `VAI -> FAU` followed by `VAI -> FAU` still looks unreliable even
  if one row shows `--`

### What the current `--` row really is

The current frontend placeholder row:

- is a synthetic zero-duration dock row
- is positioned by semantic adjacency, not real timing
- falls back to minimum height when times are missing

It is useful for graceful degradation, but it does not represent a missing
physical sea segment.

## What Has Already Been Changed

### Active-state refactor

Implemented earlier:

- backend-owned active row selection
- `terminalTailEventKey` contract for terminal-tail matching
- frontend no longer recomputes active-row fallback policy locally

Relevant code:

- [activeState.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTripEvents/activeState.ts)
- [activeStateSchemas.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTripEvents/activeStateSchemas.ts)
- [resolveActiveSegmentIndex.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/resolveActiveSegmentIndex.ts)
- [buildActiveIndicator.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/buildActiveIndicator.ts)

### Context simplification

Implemented earlier:

- `ConvexVesselTimelineContext` now derives its value directly from Convex
  queries instead of mirroring query data through extra local React state

Relevant code:

- [ConvexVesselTimelineContext.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/data/contexts/convex/ConvexVesselTimelineContext.tsx)

### Safe UX improvement already implemented

Implemented:

- when a row has no scheduled time but does have actual or estimated time, the
  UI shows `--` in the scheduled column and the real time in the secondary
  column

Relevant code:

- [TimelineRowEventTimes.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowEventTimes.tsx)

This is helpful for degraded rows, but it does not fix the duplicate-direction
timeline story on its own.

## Attempted Backend Seam Fix That Was Rejected

A generic attempt was made to normalize mismatched adjacent `arv-dock ->
dep-dock` seams in `normalizeScheduledDockSeams`.

That attempt was reverted because:

- it was not robust against the actual sorted event shape
- it risked incorrectly rewriting triangle-route terminals
- it was solving the wrong layer of the problem

Conclusion:

- a naive adjacent-event seam rewrite is too brittle
- the CAT anomaly should not be “fixed” by a one-line terminal overwrite in
  `vesselTripEvents` normalization

## Product Direction Agreed In Conversation

The current preferred direction is:

- do not depend on `CompletedVesselTrip` for the primary repair
- detect the discontinuity from scheduled data alone
- if scheduled data says `A -> B`, then again `A -> B`, infer a missing
  physical movement `B -> A`
- represent that inferred movement as a placeholder, not as an authoritative
  published sailing

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

- [seed.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTripEvents/seed.ts)
- [liveUpdates.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTripEvents/liveUpdates.ts)
- [queries.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTripEvents/queries.ts)
- possibly scheduled-trip transform files if choosing upstream reconciliation

Frontend candidates:

- [buildSnapshot.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselTimelineSnapshots/buildSnapshot.ts)
- [types.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/types.ts)
- [getLayoutTimelineRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/getLayoutTimelineRows.ts)
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
