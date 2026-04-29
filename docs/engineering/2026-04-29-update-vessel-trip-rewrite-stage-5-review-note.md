# updateVesselTrip Rewrite - Stage 5 Review Note

Date: 2026-04-29

Reviewer: Deep Thought / supervising agent

## Summary

The Stage 5 cleanup is mostly successful. The old event/builder runtime path is
gone, the conservative decision to keep `scheduleEnrichment.ts` and `tripFields/`
is reasonable, and the focused behavior/downstream tests pass.

Before Stage 5 is approved, please address the cleanup items below.

## Requested Changes

### 1. Fix stale `shared/` ownership text in `architecture.md`

File:

- `convex/domain/vesselOrchestration/architecture.md`

The edited architecture document still says cross-module contracts live in
`domain/vesselOrchestration/shared`, mentions `isUpdatedTrip`, and references
`shared/scheduleSnapshot/`. In the current tree, that `shared/` folder does not
exist.

Please update this section to match the current code:

- `TripLifecycleEventFlags` is exported from `updateVesselTrip/tripLifecycle.ts`
  via the `updateVesselTrip` barrel.
- timeline handoff DTOs live in `updateTimeline/handoffTypes.ts`.
- projection wire helpers live in `updateTimeline/projectionWire.ts`.
- completed handoff key helper lives in `updateTimeline/completedHandoffKey.ts`.
- there is no current `isUpdatedTrip` shared helper.
- test fixtures for schedule resolution live under
  `updateVesselTrip/tripFields/tests/` and the public behavior/module tests live
  under `updateVesselTrip/tests/`.

Also update the design-rule bullet that currently says shared downstream
contracts are owned in `shared/`.

### 2. Remove the unused `storage.ts` helper or stop documenting it

Files:

- `convex/domain/vesselOrchestration/updateVesselTrip/storage.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/README.md`

`storage.ts` only exports `logTripPipelineFailure`, and there are no remaining
imports after deleting the old builder path. The README still lists it as
"pipeline-local failure logging", but the current `updateVesselTrip.ts` logs
errors inline.

Preferred fix:

- delete `storage.ts`
- remove it from the README module map
- rerun codegen so `convex/_generated/api.d.ts` drops the module

If you keep it, explain why; otherwise it is now dead surface area.

### 3. Trim old schedule-enrichment public surface if easy

File:

- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleEnrichment.ts`

This is not a blocker, but while we are cleaning old surfaces:

- `enrichActiveTripWithSchedule` is no longer imported anywhere.
- `attachNextScheduledTripFields` appears to be used only inside this file.

If this is straightforward, remove the unused exported `enrichActiveTripWithSchedule`
function and make `attachNextScheduledTripFields` private. Keep
`applyResolvedTripScheduleFields`, which is still used by
`scheduleForActiveTrip.ts`.

This keeps the conservative schedule-helper structure without leaving an old
row-builder-facing API around.

## Verification

Please re-run:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests convex/domain/vesselOrchestration/updateVesselTrip/tripFields/tests
bun test convex/domain/vesselOrchestration/updateTimeline/tests/timelineHandoffFromTripUpdate.test.ts convex/domain/vesselOrchestration/updateVesselPredictions/tests/predictionInputsFromTripUpdate.test.ts convex/domain/vesselOrchestration/updateVesselActualizations/tests/deriveDepartNextActualizationIntent.test.ts convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts
```

If `storage.ts` or any other `convex/` file is deleted, rerun codegen and include
the generated API change.
