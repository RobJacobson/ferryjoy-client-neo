# Arrival Placeholder Memo

`VesselTimeline` inserts a synthetic dock placeholder when a departure starts a
sea segment without an immediately preceding same-terminal arrival.

Source:

- [buildSegmentsFromBoundaryEvents.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/src/features/VesselTimeline/utils/buildSegmentsFromBoundaryEvents.ts)

## Summary

This behavior is intentional and still useful, but it serves two different
cases:

- a legitimate product case at the start of the visible service-day window
- a degraded fallback when the event chain is broken

Those cases should stay distinct in our thinking even though they share the
same rendering mechanism.

## Why It Exists

### Start-of-day truncation

The timeline is a bounded service-day view, not a full vessel occupancy
history. That means the first visible event for a day can legitimately be a
departure with no preceding arrival in the returned feed.

In that case, the placeholder is the right UX:

- it gives the user some dock context before the first sea leg
- it does not pretend we know the missing arrival time

### Broken seams

The same placeholder path also handles inconsistent event chains, for example
when a departure does not line up with the prior arrival terminal.

In that case, the placeholder is not expressing a real known arrival. It is a
conservative fallback that keeps the timeline structurally readable while
signaling that the seam is not trustworthy.

## Current Behavior

The placeholder is intentionally conservative:

- it is a dock segment
- it has zero duration
- its synthetic arrival event has no scheduled, actual, or predicted time
- it carries `placeholderReason`
  - `start-of-day`
  - `broken-seam`

That means the row can honestly render dock context without implying timing
confidence we do not have.

## What It Should Mean

The placeholder means:

- "there should be dock context here"
- "the visible timeline should not jump directly into a sea leg"

It does not mean:

- "we know the missing arrival time"
- "the backend confirmed a real arrival boundary"
- "adjacent rows can safely donate timing to this synthetic event"

## Why This Needs Care

The main risk is that one mechanism is doing two jobs:

1. representing expected start-of-day truncation
2. masking inconsistent upstream data

That can blur debugging and product reasoning:

- a legitimate placeholder and a broken-seam placeholder can look similar in UI
- future refactors may be tempted to make the placeholder appear more precise
- timing inheritance can easily create plausible-looking but false information

The current conservative behavior is safer than "smart" guessing.

## Guidance For Future Changes

- Keep placeholders for true start-of-day orphan departures.
- Treat mid-day placeholders as likely seam problems first.
- Prefer backend seam repair over smarter frontend inference.
- Do not inherit scheduled, actual, or predicted times onto placeholders unless
  the backend explicitly provides a trustworthy source for that synthetic row.

## Useful Future Directions

If we revisit this area later, good directions would be:

- better diagnostics for unexpected mid-day placeholders
- clearer UI treatment if `broken-seam` needs to look distinct from
  `start-of-day`
- shifting more seam repair responsibility to the backend if we develop a
  reliable normalization rule

## Recommended Default For Future Agents

If you encounter the placeholder path during later work:

1. first ask whether the placeholder is at the start of the day or mid-day
2. if it is start-of-day, the current behavior is probably correct
3. if it is mid-day, assume seam inconsistency before making the frontend
   smarter
4. do not attach times unless the source of truth is explicit and trustworthy
