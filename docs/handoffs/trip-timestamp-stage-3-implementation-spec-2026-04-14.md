# Stage 3 Implementation Spec: Actual Projection and Timeline Reseed

Date: 2026-04-14
Parent PRD: [trip-timestamp-semantics-prd-2026-04-14.md](./trip-timestamp-semantics-prd-2026-04-14.md)
Stage 2 baseline: [trip-timestamp-stage-2-implementation-spec-2026-04-14.md](./trip-timestamp-stage-2-implementation-spec-2026-04-14.md)
Semantic baseline: [trip-timestamp-semantics-memo-2026-04-14.md](./trip-timestamp-semantics-memo-2026-04-14.md)
Timeline context: [vesseltimeline-reconciliation-memo-2026-04-14.md](./vesseltimeline-reconciliation-memo-2026-04-14.md)
Status: implementation-ready spec for Stage 3 only

## Purpose

Stage 3 makes `eventsActual` and same-day timeline reseed consume the canonical
physical trip boundaries established in Stage 2.

The goal is to keep actual-boundary projection physically honest:

- departure rows come from the canonical departure actual
- arrival rows come from the canonical destination-arrival actual
- coverage timestamps stay out of `eventsActual`
- same-day reseed can still preserve and recreate physical-only actual rows

Stage 3 does not rewrite ML readers, frontend rendering, or broader query-side
trip interpretation. Those remain Stage 4 and Stage 5 work.

## Scope

In scope for Stage 3:

- trip-driven `eventsActual` patch assembly
- current-tick timeline write gating when lifecycle branches emit actual-boundary
  messages
- same-day reseed reconstruction of physical-only actual rows from trip state
- timeline row typing needed so reseed helpers can read canonical trip actuals
- tests that prove `eventsActual` is sourced from physical boundary actuals, not
  coverage timestamps or legacy compatibility mirrors

Out of scope for Stage 3:

- ML feature updates
- prediction math changes
- frontend query or render changes
- broad live-location heuristic redesign
- renaming `LeftDockActual` storage away from legacy storage names

## Stage 3 Contract

### Physical-first projection rule

`eventsActual` must represent physical boundary facts only.

For trip-driven projection from `ConvexVesselTrip` rows:

- `dep-dock` reads `DepartOriginActual`
- `arv-dock` reads `ArriveDestDockActual`

No trip-driven actual projection path may use:

- `StartTime`
- `EndTime`
- `TripStart`
- `TripEnd`
- `AtDockActual`
- `ArriveDest`
- raw `LeftDock`

as the source of truth for persisted boundary rows.

### Legacy compatibility rule

Stage 2 may still mirror canonical values into legacy fields so older readers
keep working, but Stage 3 projection code must stop depending on those mirrors
when canonical fields already exist.

Practical meaning:

- if `DepartOriginActual` is absent, do not silently fall back to
  `LeftDockActual` or `LeftDock` in trip-driven projection
- if `ArriveDestDockActual` is absent, do not silently fall back to `ArriveDest`
- if the canonical field is absent, skip that trip-driven actual patch rather
  than fabricating one from coverage or legacy compatibility state

### Coverage separation rule

`StartTime` and `EndTime` remain valid lifecycle coverage fields, but Stage 3
must keep them out of actual-boundary projection and same-day reseed actual-row
reconstruction.

This is the core semantic wall for Stage 3:

- coverage close is not destination arrival
- coverage start is not origin departure
- actual-boundary rows should only reflect trusted physical events

### Same-day reseed rule

Same-day reseed must preserve the physical-first behavior already established by
the timeline refactor:

- schedule-aligned actual rows remain schedule-backed when physical trip context
  resolves a `TripKey`
- physical-only rows with `ScheduleKey` absent must still survive or be
  reconstructed when the trip state itself contains trusted physical boundaries
- scheduleless live-location fallback remains allowed where the reseed pipeline
  has to recover a physical fact from current vessel state, but that is distinct
  from trip-driven reconstruction from persisted trip rows

## File Ownership

### Primary implementation files

- [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.ts)
- [convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts](../../convex/functions/vesselTrips/updates/projection/timelineEventAssembler.ts)
- [convex/domain/timelineRows/bindActualRowsToTrips.ts](../../convex/domain/timelineRows/bindActualRowsToTrips.ts)
- [convex/domain/timelineReseed/buildReseedTimelineSlice.ts](../../convex/domain/timelineReseed/buildReseedTimelineSlice.ts)

### Secondary review surface

- [convex/domain/timelineReseed/reconcileLiveLocations.ts](../../convex/domain/timelineReseed/reconcileLiveLocations.ts)
- [convex/functions/eventsActual/schemas.ts](../../convex/functions/eventsActual/schemas.ts)

The secondary files should only change if Stage 3 correctness requires a small
typing or comment update. They should not be expanded into a broader redesign.

## Required Changes By File

### `actualBoundaryPatchesFromTrip.ts`

Update trip-driven patch builders so they read canonical physical boundary
fields only:

- departure patch reads `trip.DepartOriginActual`
- arrival patch reads `trip.ArriveDestDockActual`
- comments and parameter docs must describe canonical physical semantics, not
  legacy mirrors

This file is the clearest expression of the Stage 3 semantic cutover for
trip-driven actual projection.

### `timelineEventAssembler.ts`

Align current-trip actual patch gating with the Stage 2 lifecycle writer:

- require `finalProposed.DepartOriginActual` before building a departure patch
- require `finalProposed.ArriveDestDockActual` before building an arrival patch

This keeps post-upsert projection assembly consistent with the already-reviewed
write-side lifecycle path and prevents a stale legacy-field gate from masking or
misstating actual-boundary semantics.

### `bindActualRowsToTrips.ts`

Expand the minimal trip type used for same-day physical reconciliation so it can
carry canonical fields:

- add `DepartOriginActual?: number`
- add `ArriveDestDockActual?: number`

Keep the type narrow. Stage 3 does not need a larger trip DTO.

### `buildReseedTimelineSlice.ts`

When reconstructing physical-only actual rows from trip state:

- read departure from `DepartOriginActual`
- read arrival from `ArriveDestDockActual`
- stop reading `LeftDockActual`, `LeftDock`, or `ArriveDest` for trip-driven
  physical-only row reconstruction

Rationale:

- this reconstruction path is no longer “read raw feed hints from a trip row”
- it is “rebuild normalized actual rows from the canonical physical boundaries
  already established by lifecycle ownership”

### `reconcileLiveLocations.ts`

No semantic rewrite is required for Stage 3 as long as this file continues to:

- derive physical-only fallback patches from live physical evidence
- avoid using trip `StartTime` or `EndTime` as actual-boundary substitutes

Reviewer task:

- spot-check the file to confirm Stage 3 changes elsewhere do not accidentally
  reintroduce coverage-time projection

## Implementation Order

1. Add the Stage 3 spec document.
2. Update trip-driven actual patch builders to read canonical fields.
3. Update timeline event assembly gating to match canonical trip actuals.
4. Extend the physical-reconcile trip type with canonical fields.
5. Update same-day reseed physical-only reconstruction to read canonical trip
   actuals.
6. Update or add focused tests that prove the canonical field sources.
7. Run focused tests and targeted repo checks before marking Stage 3 complete.

## Acceptance Criteria

Stage 3 is complete when all of the following are true:

- trip-driven departure projection reads `DepartOriginActual`
- trip-driven arrival projection reads `ArriveDestDockActual`
- current-tick timeline assembly does not gate on `LeftDock`, `LeftDockActual`,
  or `ArriveDest`
- physical-only actual row reconstruction during reseed reads canonical trip
  physical actuals, not legacy compatibility mirrors
- reviewer can trace the Stage 3 code path without seeing `StartTime` or
  `EndTime` used to emit `dep-dock` or `arv-dock`
- tests cover both trip-driven projection and same-day reseed reconstruction

## Review Checklist

Reject the Stage 3 implementation if any of these are true:

- `eventsActual` patch builders still read `ArriveDest` or raw `LeftDock`
  directly from trip rows
- same-day reseed reconstructs actual rows from `StartTime`, `EndTime`,
  `TripStart`, or `TripEnd`
- a patch is emitted from a legacy mirror when the canonical field is absent
- Stage 3 scope expands into ML feature math or frontend contract changes
- live-location fallback behavior is rewritten in a way that changes broader
  timeline reconciliation semantics without explicit Stage 3 justification

## Suggested Tests and Verification

Suggested checks:

- update
  [convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.test.ts](../../convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.test.ts)
  so departure and arrival assertions prove canonical field sourcing
- update
  [convex/domain/timelineReseed/tests/buildReseedTimelineSlice.test.ts](../../convex/domain/timelineReseed/tests/buildReseedTimelineSlice.test.ts)
  so physical-only reconstruction reads canonical trip actuals
- optional focused assertion through
  [convex/functions/vesselTrips/updates/tests/processVesselTrips.test.ts](../../convex/functions/vesselTrips/updates/tests/processVesselTrips.test.ts)
  if needed to prove current-tick gating still emits arrival/departure patches
  after the canonical switch
- grep verification that the Stage 3 files no longer read `ArriveDest` or
  `LeftDockActual ?? LeftDock` for trip-driven `eventsActual` projection
- `bun test convex/functions/vesselTrips/updates/projection/actualBoundaryPatchesFromTrip.test.ts`
- `bun test convex/domain/timelineReseed/tests/buildReseedTimelineSlice.test.ts`
- `bun run type-check`

## Notes for Stage 4

After Stage 3, the write side and timeline actual-boundary projection will both
be aligned to the canonical physical contract.

Stage 4 should then update ML and query-side readers intentionally instead of
letting legacy mirror fields keep semantic ownership by accident.
