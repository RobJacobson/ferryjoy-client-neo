/**
 * Engineering memo for the synthetic arrival-placeholder behavior in
 * VesselTimeline.
 */

# Arrival Placeholder Memo

## Summary

`VesselTimeline` currently synthesizes an arrival-placeholder dock row when a
departure event does not have an immediately preceding same-terminal arrival.

This behavior is intentional and still useful, but it serves two very
different cases:

- a legitimate product case at the start of the visible service-day window
- a degraded fallback when backend/upstream event seams are broken

Those two uses should not be conflated forever. This memo documents the current
behavior, why it exists, what risks it creates, and what future cleanup should
consider.

## Relevant Code

- [buildTimelineRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/buildTimelineRows.ts)
- [getLayoutTimelineRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/getLayoutTimelineRows.ts)
- [TimelineRowContent.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowContent.tsx)
- [TimelineRowEventTimes.tsx](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/components/timeline/timelineRow/TimelineRowEventTimes.tsx)

## Current Behavior

In [buildTimelineRows.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/pipeline/buildTimelineRows.ts),
when the pipeline sees:

- a `dep-dock` event starting a sea row
- with no immediately preceding `arv-dock` at the same terminal

it inserts a synthetic dock row before the sea row.

That placeholder row:

- uses the departure event as its base shape
- changes the synthetic start event to `EventType: "arv-dock"`
- clears:
  - `ScheduledTime`
  - `PredictedTime`
  - `ActualTime`
- marks `IsArrivalPlaceholder: true`

The UI then renders:

- an arrival label like `Arv: VAI`
- a placeholder time row with `--`

This is currently the only built-in degraded representation for “we do not
have a trustworthy arrival boundary here.”

## Why It Exists

### Legitimate case: start-of-day truncation

The service-day timeline begins at the vessel's first departure for the
requested day, not at an absolute berth-occupancy boundary from the prior
calendar period.

That means the first row can legitimately be:

- a departure from terminal `X`
- with no preceding arrival event in the bounded feed

In that case, the placeholder is appropriate. It gives the user a compact dock
context before the first visible sea segment without pretending we know the
arrival time.

### Accidental case: broken seams

The same placeholder mechanism is also triggered when the feed contains:

- a prior arrival event
- but at a different terminal than the departure that follows

This is not a legitimate bounded-window case. It is a data seam problem.

The placeholder is still useful as a graceful fallback, but it also hides the
fact that:

- the row builder encountered a broken event chain
- the backend normalization did not fully reconcile it

## Why This Needs Attention

The placeholder path is doing two jobs:

1. representing intentional service-day truncation
2. masking event inconsistency

That creates debugging and UX risks:

- a legitimate placeholder and a broken-data placeholder look the same
- engineers may misread the UI as “missing first arrival” when the real issue
  is a corrupted seam
- attempts to “improve” the placeholder can accidentally surface misleading
  times from broken rows

This happened during investigation of the CAT triangle-route anomaly:

- a temporary refactor tried to preserve `ActualTime` from a mismatched prior
  arrival row
- this produced a plausible-looking but incorrect time
- the change was reverted

That is a strong signal that the placeholder should remain conservative unless
it is backed by explicit backend truth.

## Current Safe State

As of now, the placeholder row intentionally preserves no timing fields:

- scheduled: empty
- predicted: empty
- actual: empty

The time UI can still show `--` honestly in the scheduled slot when
`showPlaceholder` is enabled.

This is the safest fallback because it avoids implying confidence in a time
whose semantics are unclear.

## What We Should Remember

### Keep

Keep the placeholder mechanism for the true start-of-day case.

It is still the right UX for:

- “the bounded day feed begins with a departure”
- “we want a small dock context before the first sea leg”

### Be careful with

Be very cautious about adding timing inheritance to placeholders.

Do not reuse:

- `ActualTime`
- `PredictedTime`
- `ScheduledTime`

from adjacent mismatched rows unless the backend explicitly marks that timing as
valid for the placeholder terminal/event.

### Prefer backend fixes for seam issues

If a placeholder appears in the middle of the day because of a broken seam, the
preferred fix is backend normalization or reconciliation, not smarter frontend
guessing.

The frontend should degrade conservatively.

## Future Cleanup Ideas

### Option A: Differentiate placeholder reasons

Potential extension:

```ts
IsArrivalPlaceholder?: boolean;
PlaceholderReason?: "start-of-day" | "broken-seam";
```

This could live on `TimelineRowEvent` or the semantic row.

Benefits:

- easier debugging
- easier future UX decisions
- avoids treating all placeholders as equivalent

### Option B: Narrow frontend placeholder creation

Possible future goal:

- keep frontend placeholder creation only for start-of-day orphan departures
- push mid-day seam repair responsibility fully to the backend

Benefits:

- clearer ownership
- fewer ambiguous degraded states

Risks:

- requires backend work before the frontend can safely narrow the rule

### Option C: Add diagnostics

If mid-day placeholders are unexpected, the row builder or backend query layer
could optionally log or count them in development.

Benefits:

- makes seam issues visible earlier
- helps distinguish “normal bounded start” from “something broke”

## Recommended Guidance For Future Agents

If you encounter the arrival-placeholder path during future work:

1. First ask whether the placeholder is at the start of the day or in the
   middle of the day.
2. If it is at the start of the day, the current behavior is probably correct.
3. If it is in the middle of the day, assume there may be a backend seam issue
   before making the frontend smarter.
4. Do not attach times to the placeholder unless the timing source is
   explicitly trustworthy for that synthetic event.

## Status

This behavior is intentionally preserved.

No additional placeholder timing inference should be reintroduced without a
clear backend-backed source of truth.
