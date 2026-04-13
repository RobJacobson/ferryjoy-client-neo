# Handoff Note: Remove Legacy-Row TripKey Compatibility After Clean-Slate Cutover

Date prepared: 2026-04-13  
Audience: next implementation agent working after PR 2  
Context: user plans to wipe existing Convex vessel-trip data before the lifecycle redesign is finalized

## Why this note exists

PR 2 was implemented under an earlier version of the spec that still allowed transitional runtime support for legacy active rows without `TripKey`.

That is no longer necessary if we are doing a clean-slate data cutover.

The goal of this cleanup is to remove migration-only code and tests that exist solely to tolerate pre-`TripKey` rows, while preserving:

- the new physical-trip lifecycle semantics
- `TripKey` as primary physical identity
- `AtDockActual` / `LeftDockActual`
- debounce behavior
- legacy `Key` dual-write where still needed for downstream compatibility before PR 3

## Expected cleanup targets

### 1. Remove legacy-row `TripKey` backfill helper

Primary target:

- [convex/shared/physicalTripIdentity.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/shared/physicalTripIdentity.ts)

Delete:

- `backfillTripKeyFromLegacyRow(...)`

Keep:

- `generateTripKey(...)`
- `buildPhysicalActualEventKey(...)`

### 2. Simplify continuing-trip identity logic

Primary target:

- [convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselTrips/updates/tripLifecycle/baseTripFromLocation.ts)

Desired end state:

- continuing trips preserve `existingTrip.TripKey`
- new trips call `generateTripKey(...)`
- runtime should not synthesize a `TripKey` for an already-persisted row that is missing one

Recommended behavior:

- treat missing `existingTrip.TripKey` on a continuing trip as invalid post-cutover state
- either fail loudly in tests or add a narrow invariant guard, but do not backfill from `TripStart` or `TimeStamp`

### 3. Remove migration-focused tests

Search for tests that exist only to verify behavior for:

- existing rows missing `TripKey`
- one-time `TripKey` backfill from legacy rows
- compatibility paths that should no longer run after the wipe

Keep tests for:

- immutable `TripKey` on new trips
- continuing ticks preserving `TripKey`
- arrival-created trips getting a fresh `TripKey`
- debounce behavior
- safe `ScheduleKey` attachment

### 4. Keep these compatibility behaviors for now

Do not remove yet:

- legacy `Key` dual-write where still needed by projection code
- schedule-attachment compatibility behavior needed before PR 3
- any `eventsActual` compatibility fields introduced in PR 1

Those are still required until the PR 3 `eventsActual` cutover lands.

## Suggested verification

At minimum, rerun:

- `bun test convex/functions/vesselTrips/updates/tests/baseTripFromLocation.test.ts`
- `bun test convex/functions/vesselTrips/updates/tests/buildTrip.test.ts`
- `bun test convex/functions/vesselTrips/updates/tests/detectTripEvents.test.ts`
- `bun test convex/functions/vesselTrips/updates/tests/processCompletedTrips.test.ts`
- `bun test convex/functions/vesselTrips/updates/tests/processVesselTrips.test.ts`
- `bun test convex/`
- `bun run type-check`
- `bun run convex:typecheck`

## Design intent after cleanup

Post-cleanup, the runtime assumption should be simple:

- every active or completed trip row written by the new lifecycle code has `TripKey`
- `TripKey` is created exactly once per physical trip instance
- missing `TripKey` is not a migration scenario to support; it is invalid state
