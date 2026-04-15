# Stage 2 Implementation Spec: Write-Side Trip Lifecycle

Date: 2026-04-14
Parent PRD: [trip-timestamp-semantics-prd-2026-04-14.md](./trip-timestamp-semantics-prd-2026-04-14.md)
Stage 1 baseline: [trip-timestamp-stage-1-implementation-spec-2026-04-14.md](./trip-timestamp-stage-1-implementation-spec-2026-04-14.md)
Semantic baseline: [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md)
Status: implementation-ready spec for Stage 2 only

## Purpose

Stage 2 makes the write-side vessel-trip lifecycle speak the canonical
timestamp contract defined in Stage 1.

The goal is not to rewrite every consumer yet. The goal is to make the trip
writer the authoritative place where canonical boundary timestamps are
established, while keeping the legacy trip fields mirrored enough for Stage 3
and Stage 4 to land cleanly.

## Scope

In scope for Stage 2:

- trip creation, continuation, completion, and rollover writes
- same-tick chaining between completed trips and next trips
- synthetic close handling for coverage only
- lifecycle event detection and readiness checks that currently depend on
  `TripStart`, `TripEnd`, `AtDockActual`, or `LeftDockActual`
- prediction gating as it relates to lifecycle state, not ML feature formulas
- tests that prove the write-side contract and same-tick behavior

Out of scope for Stage 2:

- `eventsActual` projection rewrites
- timeline reseed/reconciliation rewrites
- ML feature math changes
- frontend render changes
- introducing a new compatibility DTO or a second adapter boundary

## Stage 2 Contract

### Canonical write rule

The trip writer must treat these canonical fields as the source of truth:

- `StartTime`
- `EndTime`
- `ArriveOriginDockActual`
- `DepartOriginActual`
- `ArriveDestDockActual`

Legacy fields may still be written as mirrors for compatibility, but they must
never be used as the input that decides the canonical values.

### Canonical source of time

All canonical lifecycle timestamps are written from the feed tick clock:
`ConvexVesselLocation.TimeStamp`.

Rules:

- do not use `Date.now()` for lifecycle meaning
- do not derive canonical boundary times from `TripStart`, `TripEnd`,
  `AtDockActual`, `ArriveDest`, or `LeftDock`
- if the feed tick is ambiguous, keep the canonical field undefined rather than
  guessing from a coverage field

### Legacy mirror rule

Legacy trip fields may remain in lockstep with the canonical fields during this
stage so the rest of the system keeps working until Stage 3 and Stage 4 land.

Target mirror behavior:

- `TripStart` mirrors `StartTime`
- `AtDockActual` mirrors the origin-arrival boundary for the current trip row
- `TripEnd` mirrors `EndTime`
- `ArriveDest` mirrors `ArriveDestDockActual`
- `LeftDockActual` mirrors `DepartOriginActual`
- `LeftDock` remains raw feed input and is not elevated into canonical meaning

The legacy fields are compatibility mirrors only. They must never be read back
to decide the canonical value for a write.

`TripStart` is the narrowest compatibility mirror in this stage. It may still
be used by downstream readers that have not yet been updated, but Stage 2 must
not treat it as physical arrival truth. In bootstrap or synthetic-close cases,
`TripStart` mirrors the coverage start timestamp only.

## Lifecycle Ownership

### `convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts`

Owns:

- lifecycle readiness derived from the new canonical contract
- event flags that decide whether a tick starts, continues, departs, or
  completes a trip
- the bridge from raw feed state to lifecycle state

### `convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts`

Owns:

- the boolean event bundle for one vessel tick
- `isTripStartReady` as a transitional name only
- completion detection that does not rely on coverage timestamps as evidence

### `convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts`

Owns:

- constructing the base trip row for a new start or continuing row
- writing canonical timestamps onto the row at birth
- carrying canonical timestamps forward unchanged on later ticks

### `convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts`

Owns:

- enriching the base trip with schedule and prediction data
- preserving canonical timestamps through all enrichment steps
- ensuring schedule transition logic never rewrites canonical boundary times

### `convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts`

Owns:

- finalizing the completed trip row
- writing the canonical destination-arrival and coverage-close timestamps
- computing durations from canonical timestamps when possible

### `convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts`

Owns:

- steady-state writes for active trips
- persistence gating for unchanged rows
- leave-dock post-persist effects that should fire only when the canonical
  departure boundary has been written

### `convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts`

Owns:

- atomic complete-and-start rollover
- building the completed trip and the replacement trip on the same tick
- preserving same-tick boundary continuity between the two rows

### `convex/functions/vesselTrips/mutations.ts`

Owns:

- persisting the completed trip and the replacement trip
- enforcing that the completed trip really has a completion timestamp
- preserving the write-side atomicity of the rollover mutation

### `convex/functions/vesselTrips/updates/tripLifecycle/physicalDockSeaDebounce.ts`

Owns:

- the physical boundary evidence helpers that decide when departure or arrival
  is real enough to commit
- preferring canonical departure state over legacy departure mirrors once the
  canonical field exists

### `convex/functions/vesselTrips/updates/tripLifecycle/appendPredictions.ts`

Owns:

- the lifecycle-phase gate for when predictions should be computed
- using canonical lifecycle state to decide readiness, not `TripStart`
  truthiness alone

### `convex/functions/vesselTrips/updates/tripLifecycle/tripEventTypes.ts`

Owns:

- the event bundle shape, including the transitional `isTripStartReady` name
- comments that explain how the readiness flag maps to the canonical contract

## Canonical Write Rules By Event

### 1. Trip start

When a trip truly starts on a tick:

- set `StartTime` to `currLocation.TimeStamp`
- set `ArriveOriginDockActual` to `currLocation.TimeStamp`
- mirror `TripStart` and `AtDockActual` from the same tick
- preserve `TripKey` and schedule identity as already established by the
  lifecycle path

If the system must bootstrap a first-seen row before a trustworthy origin
boundary exists, it may create the row for state-tracking purposes, but it must
not fabricate `ArriveOriginDockActual` just because a row exists. In that
bootstrap case, `StartTime` should still be set to the first recorded tick so
coverage begins even when the origin-arrival boundary remains unknown.

### 2. Departure from origin

When the vessel truly leaves the origin dock:

- set `DepartOriginActual` to `currLocation.TimeStamp`
- mirror `LeftDockActual` from `DepartOriginActual`
- leave `LeftDock` as raw feed input only
- do not derive departure from `TripStart`, `AtDockActual`, or coverage
  timestamps

Departure is the physical boundary that starts at-sea predictions and ends the
at-dock phase. It is not coverage close.

### 3. Destination arrival and trip completion

When the vessel truly arrives at the destination dock and the trip completes:

- set `ArriveDestDockActual` to `currLocation.TimeStamp`
- set `EndTime` to `currLocation.TimeStamp`
- mirror `ArriveDest` and `TripEnd` from the same tick
- carry the same tick into the next trip as its new start boundary

This is the happy path for the canonical chain:

- previous trip destination arrival
- previous trip coverage close
- next trip coverage start
- next trip origin arrival

All of those are the same feed tick in the happy path.

The decision between this happy-path physical arrival and a synthetic close
must be made by the lifecycle completion path, not by `buildCompletedTrip`
silently upgrading every completion into a physical arrival. `buildCompletedTrip`
may prepare the completed row, but the caller or control path that owns the
complete-and-start transition must decide whether `ArriveDestDockActual` is
trusted or remains undefined.

### 4. Synthetic close

If a trip row must be closed because the lifecycle rolls over, but the pipeline
does not have a trustworthy destination-arrival fact:

- set `EndTime` to the close tick
- keep `ArriveDestDockActual` undefined
- do not backfill a fake destination arrival from coverage close
- do not backfill a fake origin arrival on the next trip from the synthetic
  close
- set the replacement trip's `StartTime` to the new row's first recorded tick
  if the new row is entering the recorded window, while keeping
  `ArriveOriginDockActual` undefined until a real origin boundary exists

This is the explicit boundary between coverage semantics and physical boundary
semantics.

### 5. Legacy mirror timing

When the canonical field is written, the legacy mirror should be written in the
same mutation so readers do not observe a partially translated row.

When the canonical field is not available, leave the legacy mirror undefined
rather than deriving a fake value from a coverage timestamp.

## Prediction-Gating Bridge

Stage 2 should keep prediction triggering intact while moving the lifecycle
contract underneath it.

Rules:

- readiness must not depend on `TripStart` truthiness alone
- at-dock prediction readiness should come from the canonical start/origin
  boundary state
- at-sea prediction readiness should come from canonical departure state
- leave-dock post-persist hooks should trigger from canonical departure, not a
  raw coverage signal

The intent is to preserve operational behavior while the row shape changes,
not to rewrite the ML formulas yet.

## Implementation Order

1. Update trip derivation and event detection so they reason about canonical
   lifecycle state first.
2. Update base trip construction to write canonical start and origin-arrival
   timestamps.
3. Update completion handling to write canonical destination-arrival and
   coverage-close timestamps.
4. Update the rollout mutation and post-persist hooks to preserve same-tick
   chaining.
5. Update prediction gating helpers so they do not depend on `TripStart`
   truthiness as the only readiness signal.
6. Add tests that lock in the same-tick and synthetic-close behavior.

## File Ownership

### Must update

- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/buildCompletedTrip.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCurrentTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/processCompletedTrips.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/tripDerivation.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/detectTripEvents.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/physicalDockSeaDebounce.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/physicalDockSeaDebounce.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/appendPredictions.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/appendPredictions.ts)
- [convex/functions/vesselTrips/updates/tripLifecycle/tripEventTypes.ts](../../convex/functions/vesselTrips/updates/tripLifecycle/tripEventTypes.ts)
- [convex/functions/vesselTrips/mutations.ts](../../convex/functions/vesselTrips/mutations.ts)

### Review for contract drift

- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/domain/ml/prediction/vesselTripPredictions.ts](../../convex/domain/ml/prediction/vesselTripPredictions.ts)
- [convex/domain/ml/shared/features.ts](../../convex/domain/ml/shared/features.ts)
- [convex/domain/ml/prediction/predictTrip.ts](../../convex/domain/ml/prediction/predictTrip.ts)

These review-only files should not become the focus of Stage 2 unless a type
alignment forces a small comment or guard update.

## Acceptance Criteria

Stage 2 is complete when all of the following are true:

- canonical start, departure, completion, and rollover timestamps are written
  from the live feed tick clock
- `StartTime`, `EndTime`, `ArriveOriginDockActual`, `DepartOriginActual`, and
  `ArriveDestDockActual` are the source of truth on persisted trip rows
- legacy mirrors remain aligned for the transitional period
- no lifecycle writer uses `TripStart`, `TripEnd`, `AtDockActual`, or
  `ArriveDest` as the source that decides a canonical timestamp
- same-tick complete-and-start behavior is locked in by tests
- synthetic close does not fabricate destination arrival
- prediction gating still works from the lifecycle path without relying on the
  old `TripStart` meaning
- the repository type-checks after the lifecycle updates

## Review Checklist

Reject the Stage 2 spec or implementation if any of these are true:

- a coverage field is treated as a physical boundary fact
- a canonical timestamp is derived from `TripStart`, `TripEnd`,
  `AtDockActual`, `ArriveDest`, or `LeftDock` when a live tick is available
- the same-tick completion/start chain is split across different ticks without
  an explicit non-happy-path reason
- synthetic close backfills a fake destination arrival
- prediction readiness still depends on `TripStart` alone
- the patch introduces a second adapter boundary or a new compatibility DTO

## Suggested Tests and Verification

Stage 2 verification should focus on lifecycle writes and same-tick semantics.

Suggested checks:

- a unit test for `baseTripFromLocation` proving a completed trip rolls the
  next trip forward on the same tick
- a unit test for `buildCompletedTrip` proving `EndTime` and
  `ArriveDestDockActual` are written from the completion tick
- a unit test for `processCompletedTrips` proving the completed row and
  replacement row share the same boundary tick
- a unit test for `processCurrentTrips` proving a leave-dock tick writes the
  canonical departure boundary and still enqueues the right post-persist effect
- a unit test for `detectTripEvents` / `tripDerivation` proving readiness does
  not depend on `TripStart` as the only signal
- a unit test proving synthetic close does not fabricate `ArriveDestDockActual`
- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

## Notes for the Next Stage

Stage 2 should leave `eventsActual` and timeline reseed behavior intact apart
from the compatibility mirrors needed to keep them working. Stage 3 will switch
the projection and reseed readers over to the canonical fields directly.
