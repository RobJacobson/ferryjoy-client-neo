# updateVesselTrip Rewrite - Stage 3 Handoff

Date: 2026-04-29

Branch: `rewrite-update-vessel-trips`

## Read First

- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-prd.md`
- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-2-handoff.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/lifecycleSignals.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/completeTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/buildActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleForActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripComparison.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts`

Stage 2 is approved. The new modules exist and pass their focused tests. The
only known public-suite failure is:

- `updateVesselTrip > stamps LeftDockActual from LeftDock on dock-to-sea transition`

Stage 3 should make that test pass by wiring the new pipeline.

## Goal

Rewrite the public `updateVesselTrip.ts` entrypoint to use the new Stage 2
pipeline modules while preserving the public API and downstream contract.

The final entrypoint should read as a short linear reducer:

```text
isNewTrip
  -> completeTrip?
  -> buildActiveTrip
  -> applyScheduleForActiveTrip
  -> compare active row for no-op suppression
  -> return VesselTripUpdate | null
```

Do not delete old modules in this stage. Stage 5 will remove obsolete files once
downstream contracts are audited.

## Files You May Edit

Preferred:

- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts`

Allowed if needed:

- `convex/domain/vesselOrchestration/updateVesselTrip/buildActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/completeTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleForActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/lifecycleSignals.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripComparison.ts`

Avoid in Stage 3:

- Do not delete `tripEvents.ts`, `tripBuilders.ts`, `basicTripRows.ts`,
  `scheduleEnrichment.ts`, or `activeTripSchedule/` yet.
- Do not rewrite prediction, actualization, timeline, or orchestrator
  persistence modules.
- Do not change `VesselTripUpdate` shape.

## Required Implementation Shape

`updateVesselTrip.ts` should import:

- `isNewTrip` from `lifecycleSignals`
- `completeTrip`
- `buildActiveTrip`
- `applyScheduleForActiveTrip`
- `isSameVesselTrip`

Suggested structure:

```ts
const updateVesselTrip = async (
  vesselLocation,
  existingActiveTrip,
  dbAccess
): Promise<VesselTripUpdate | null> => {
  try {
    const hasNewTripSignal = isNewTrip(existingActiveTrip, vesselLocation);
    const completedVesselTrip =
      hasNewTripSignal && existingActiveTrip
        ? completeTrip(existingActiveTrip, vesselLocation)
        : undefined;

    const baseActiveTrip = buildActiveTrip({
      previousTrip: existingActiveTrip,
      completedTrip: completedVesselTrip,
      location: vesselLocation,
      isNewTrip: hasNewTripSignal,
    });

    const activeVesselTrip = await applyScheduleForActiveTrip({
      activeTrip: baseActiveTrip,
      previousTrip: existingActiveTrip,
      completedTrip: completedVesselTrip,
      location: vesselLocation,
      isNewTrip: hasNewTripSignal,
      dbAccess,
    });

    if (
      completedVesselTrip === undefined &&
      isSameVesselTrip(existingActiveTrip, activeVesselTrip)
    ) {
      return null;
    }

    return {
      vesselAbbrev: vesselLocation.VesselAbbrev,
      existingActiveTrip,
      activeVesselTripUpdate: activeVesselTrip,
      completedVesselTripUpdate: completedVesselTrip,
    };
  } catch (error) {
    // Preserve current error isolation behavior.
    log and return null;
  }
};
```

Exact local names can differ. The important part is that the entrypoint is
linear and does not depend on the old `detectTripEvents` / `buildUpdatedVesselRows`
path.

## Behavioral Requirements

After this stage:

- `computeVesselTripUpdates.test.ts` should pass completely.
- The public `updateVesselTrip` path should:
  - not stamp `TripStart` for first-seen rows
  - suppress timestamp-only churn
  - emit ETA-only active updates
  - stamp `LeftDockActual` from `location.LeftDock` when present
  - fall back `LeftDockActual` to `location.TimeStamp` when `LeftDock` is absent
  - complete prior trips on terminal abbreviation change
  - trust terminal abbreviation change even when `AtDockObserved` is false
  - avoid DB reads for continuing incomplete WSF fields
  - infer replacement schedule fields when allowed
  - skip schedule lookup for out-of-service and non-passenger replacements

## Watchouts

- Completion rollover should always return both completed and active rows; do
  not suppress it just because the replacement active row compares equal by
  accident.
- `isSameVesselTrip` ignores `TimeStamp`, so ensure the built candidate does not
  introduce accidental derived-field churn in the timestamp-only fixture.
- `applyScheduleForActiveTrip` currently reuses old schedule helpers. That is
  acceptable in Stage 3; do not expand the cleanup scope.
- Keep existing catch/log/return-null behavior in `updateVesselTrip.ts`.

## Verification

Run:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests/stage2PipelineModules.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
```

Also run downstream contract tests:

```sh
bun test convex/domain/vesselOrchestration/updateTimeline/tests/timelineHandoffFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselPredictions/tests/predictionInputsFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselActualizations/tests/deriveDepartNextActualizationIntent.test.ts
```

Expected:

- All listed tests pass.

If old implementation-shaped tests fail because they directly import old
helpers, do not immediately rewrite them. Report the failure and the obsolete
helper dependency so the supervisor can decide whether it belongs in Stage 4 or
Stage 5.

## Return To Supervisor

Report:

- Files changed
- Whether `updateVesselTrip.ts` no longer imports old event/builder modules
- Tests run and results
- Any downstream contract failures
- Any behavior differences that required adjusting Stage 1 tests

Do not proceed to deleting old modules or docs cleanup.
