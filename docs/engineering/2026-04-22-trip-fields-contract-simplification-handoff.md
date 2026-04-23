# Trip Fields Contract Simplification Handoff

**Date:** 2026-04-22  
**Primary spec:** [2026-04-22-trip-fields-contract-simplification-prd.md](./2026-04-22-trip-fields-contract-simplification-prd.md)

## What This Is

Quick handoff for the next agent working on `convex/domain/vesselOrchestration/updateVesselTrips/tripFields`.

The current refactor looks behaviorally sound. The main follow-up is structural cleanup: narrow the contract, remove unnecessary transform steps, and make ownership boundaries more obvious.

## What I Reviewed

- `convex/domain/vesselOrchestration/updateVesselTrips/README.md`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/README.md`
- `convex/functions/vesselOrchestrator/README.md`
- `tripFields/*`
- `tripLifecycle/buildTrip.ts`
- `tripLifecycle/tripDerivation.ts`
- `computeVesselTripUpdates.ts`
- `calculateTripUpdateForVessel.ts`
- orchestrator persistence/tests around the trip write path

## Main Conclusion

I did **not** find a concrete correctness bug in the reviewed path.

The main issue is contract fat:

1. the resolved trip-fields object is wider than the seam actually needs
2. current-trip identity is resolved, partially applied to a location, then re-derived downstream
3. next-leg enrichment has split ownership
4. the one-vessel seam still uses a fake batch-shaped input

## Highest-Value Cleanup

### Preferred shape

Keep these as separate concerns:

1. `resolveCurrentTripFields(...)`
2. `buildTripCore(...)`
3. `attachNextScheduledTripFields(...)`

### Narrowest interface

The current-trip resolution object should likely contain only:

- `ArrivingTerminalAbbrev`
- `ScheduledDeparture`
- `ScheduleKey`
- `SailingDay`
- `tripFieldDataSource`
- `tripFieldInferenceMethod?`

If you take that route, remove:

- `NextScheduleKey`
- `NextScheduledDeparture`

from the current-trip resolution contract and let `attachNextScheduledTripFields` be the sole owner of next-leg fields.

## Specific Cleanup Targets

### 1. Remove the partial overlay step if possible

Today the flow is roughly:

1. infer/resolve trip fields
2. apply 3 fields onto a location-like object
3. build the base trip from that prepared location
4. re-derive schedule identity
5. patch `SailingDay` back afterward

Best outcome:

- stop manufacturing a location-shaped intermediate
- pass resolved current-trip fields directly into trip derivation / base-trip building

`applyInferredTripFields.ts` is the best candidate for deletion if the seam is simplified cleanly.

### 2. Narrow `InferredTripFields`

The current type is overloaded because it can represent:

- WSF-authored fields
- inferred current-trip fields
- next-leg schedule hints
- observability metadata

That is too much for one small contract.

Rename or replace it with something like:

- `ResolvedCurrentTripFields`
- `ResolvedTripFields`

Avoid keeping the name `InferredTripFields` if the object can also represent authoritative WSF output.

### 3. Narrow the one-vessel seam

`computeVesselTripUpdates.ts` currently builds a one-entry map to call `calculateTripUpdateForVessel(...)`.

Please simplify that seam to direct arguments:

```ts
calculateTripUpdateForVessel(vesselLocation, existingActiveTrip)
```

That change is small and worth doing.

## Files Most Likely To Change

- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/types.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/inferTripFieldsFromSchedule.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/buildInferredTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/getTripFieldsFromWsf.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/getFallbackTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/applyInferredTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripFields/attachNextScheduledTripFields.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/tripDerivation.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/calculatedTripUpdate.ts`
- `convex/domain/vesselOrchestration/updateVesselTrips/computeVesselTripUpdates.ts`

## Tests Already Run

I ran:

```bash
bun test convex/domain/vesselOrchestration/updateVesselTrips/tripFields/tests \
  convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTripCore.test.ts \
  convex/domain/vesselOrchestration/updateVesselTrips/tests/computeVesselTripUpdates.test.ts \
  convex/domain/vesselOrchestration/updateVesselTrips/tests/computeVesselTripsRows.test.ts \
  convex/functions/vesselOrchestrator/tests/persistVesselTripWriteSet.test.ts
```

Result: all passing at handoff time.

## Suggested Implementation Order

1. narrow the resolved current-trip type
2. update `buildTripCore` so it consumes the narrower contract directly
3. remove `applyInferredTripFields` if no longer needed
4. make next-leg enrichment ownership explicit
5. simplify the one-vessel seam
6. update docs/tests last

## Definition Of Done

- current-trip resolution contract is smaller than today
- no step creates fields that the next step silently ignores
- no more "resolve then re-derive the same thing" flow
- next-leg field ownership is obvious
- focused trip/orchestrator tests still pass

## Issue-Style Checklist

- [ ] Read the primary spec in [2026-04-22-trip-fields-contract-simplification-prd.md](./2026-04-22-trip-fields-contract-simplification-prd.md).
- [ ] Confirm the intended ownership split:
  - [ ] current-trip resolution
  - [ ] trip-row construction
  - [ ] next-leg enrichment
- [ ] Narrow the resolved current-trip contract in `tripFields/types.ts`.
- [ ] Remove `NextScheduleKey` and `NextScheduledDeparture` from the current-trip resolution contract if using the preferred split.
- [ ] Rename the contract if needed so it does not imply "inferred only" when it can also represent WSF-authored values.
- [ ] Update `inferTripFieldsFromSchedule.ts` and supporting helpers to return the narrowed contract.
- [ ] Simplify `buildInferredTripFields.ts` so it only builds the fields actually owned by current-trip resolution.
- [ ] Update `getTripFieldsFromWsf.ts` to match the narrowed contract.
- [ ] Update `getFallbackTripFields.ts` to match the narrowed contract.
- [ ] Refactor `buildTripCore` so it consumes resolved current-trip fields directly instead of:
  - [ ] overlaying a partial location-shaped object
  - [ ] re-deriving the same identity downstream
  - [ ] patching `SailingDay` back afterward
- [ ] Delete `applyInferredTripFields.ts` if it becomes unnecessary.
- [ ] If `applyInferredTripFields.ts` survives, rename/re-scope it so its purpose matches the new seam.
- [ ] Make next-leg enrichment ownership explicit:
  - [ ] either `attachNextScheduledTripFields.ts` is the sole owner
  - [ ] or a replacement helper fully owns next-leg attachment
- [ ] Do not leave next-leg fields duplicated across two ownership layers.
- [ ] Simplify `calculateTripUpdateForVessel(...)` so it takes `existingActiveTrip` directly instead of a one-entry map.
- [ ] Update `computeVesselTripUpdates.ts` to use the narrowed one-vessel seam.
- [ ] Update README/comments where the old wider contract is described.
- [ ] Update or add tests for the narrowed contract.
- [ ] Re-run the focused suite:
  - [ ] `bun test convex/domain/vesselOrchestration/updateVesselTrips/tripFields/tests`
  - [ ] `bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTripCore.test.ts`
  - [ ] `bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/computeVesselTripUpdates.test.ts`
  - [ ] `bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/computeVesselTripsRows.test.ts`
  - [ ] `bun test convex/functions/vesselOrchestrator/tests/persistVesselTripWriteSet.test.ts`
- [ ] In the final implementation summary, explicitly state:
  - [ ] which transform step(s) were removed
  - [ ] whether `applyInferredTripFields.ts` was deleted
  - [ ] who owns next-leg enrichment after the refactor
  - [ ] what the new narrow contract is
