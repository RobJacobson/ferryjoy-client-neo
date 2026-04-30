# updateVesselTrip Rewrite - Stage 5 Handoff

Date: 2026-04-29

Branch: `rewrite-update-vessel-trips`

## Read First

- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-prd.md`
- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-4-handoff.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/README.md`
- `convex/domain/vesselOrchestration/architecture.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleForActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/`

Stages 1-4 are approved. The public entrypoint now uses:

```text
isNewTrip
  -> completeTrip?
  -> buildActiveTrip
  -> applyScheduleForActiveTrip
  -> isSameVesselTrip
  -> VesselTripUpdate | null
```

Stage 5 is the first cleanup/deletion pass.

## Goal

Remove obsolete implementation surfaces and update docs/tests so
`updateVesselTrip` no longer presents two competing architectures.

By the end of this stage:

- public behavior tests should remain
- new pipeline-module tests should remain
- downstream compatibility tests should remain
- old event/builder-path modules and tests should be removed or converted
- docs should describe the new pipeline, not `detectTripEvents` /
  `buildUpdatedVesselRows`

## Files You May Edit

Preferred:

- `convex/domain/vesselOrchestration/updateVesselTrip/README.md`
- `convex/domain/vesselOrchestration/architecture.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/index.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/`
- obsolete modules under `convex/domain/vesselOrchestration/updateVesselTrip/`

Allowed if needed:

- `convex/domain/vesselOrchestration/updateVesselTrip/scheduleForActiveTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripLifecycle.ts`

Avoid:

- Do not change `VesselTripUpdate` shape.
- Do not change orchestrator persistence or prediction/timeline production code
  unless tests reveal a real broken import after cleanup.
- Do not expand into the optional one-query schedule-access optimization. That
  is Stage 6.

## Deletion / Conversion Targets

### Definitely obsolete after Stage 3

These should be deleted once imports/tests are removed:

- `convex/domain/vesselOrchestration/updateVesselTrip/tripEvents.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripBuilders.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/basicTripRows.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripEvidence.ts` if no
  remaining imports use it

Associated old helper-shaped tests should be deleted or converted to public/new
module tests:

- `convex/domain/vesselOrchestration/updateVesselTrip/tests/detectTripEvents.test.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/buildTripCore.test.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/buildCompletedTrip.test.ts`

Do not keep tests solely to preserve deleted helper behavior.

### Schedule helper cleanup

Current Stage 3/4 code still uses:

- `scheduleForActiveTrip.ts`
  - imports `applyResolvedTripScheduleFields` from `scheduleEnrichment.ts`
  - imports WSF helpers and resolver from `activeTripSchedule/`

You have two acceptable options:

1. Keep `scheduleEnrichment.ts` and `activeTripSchedule/` for now, but update docs to
   describe them as private schedule support behind `scheduleForActiveTrip`.
2. Inline or move the small schedule helpers into `scheduleForActiveTrip.ts` and
   then delete `scheduleEnrichment.ts` / `activeTripSchedule/`.

Prefer option 1 unless option 2 is straightforward and keeps the code simpler.
Do not do a risky schedule rewrite in a cleanup stage.

If keeping them, remove stale docs inside `activeTripSchedule/README.md` that describe
the old row-builder path, or replace that README with a brief note that this
folder is private schedule-resolution support.

## Required Checks

Before deleting a file, search for imports:

```sh
rg -n "tripEvents|detectTripEvents|tripBuilders|buildUpdatedVesselRows|basicTripRows|buildBasicUpdatedVesselRows|tripEvidence|scheduleEnrichment|activeTripSchedule" convex/domain/vesselOrchestration convex/functions/vesselOrchestrator
```

After deletion/conversion, there should be no production imports of:

- `tripEvents`
- `detectTripEvents`
- `tripBuilders`
- `buildUpdatedVesselRows`
- `basicTripRows`
- `buildBasicUpdatedVesselRows`

It is acceptable for `scheduleForActiveTrip.ts` to import private schedule
helpers if you choose the conservative schedule-cleanup option.

## Docs To Update

### `updateVesselTrip/README.md`

Rewrite around the new public flow:

```text
updateVesselTrip
  -> isNewTrip
  -> completeTrip?
  -> buildActiveTrip
  -> applyScheduleForActiveTrip
  -> isSameVesselTrip
```

Mention:

- terminal abbreviation transition is the authoritative new-trip signal
- `AtDock` persists from `AtDockObserved`
- schedule lookups are new/replacement-trip gated
- continuing incomplete WSF fields do not schedule-read every tick
- compatibility helpers in `tripLifecycle.ts` exist for downstream row-diff
  handoffs only

### `architecture.md`

Update the `updateVesselTrip` and `activeTripSchedule` sections so they do not describe
the old `detectTripEvents` / `buildUpdatedVesselRows` path as current.

## Tests To Preserve

Keep and run:

- `convex/domain/vesselOrchestration/updateVesselTrip/tests/computeVesselTripUpdates.test.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tests/stage2PipelineModules.test.ts`
- downstream tests from Stage 4
- orchestrator trip-stage policy test

If old helper tests are deleted, the total number of tests in
`updateVesselTrip/tests` will drop. That is expected.

## Verification

Run:

```sh
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
bun test convex/domain/vesselOrchestration/updateTimeline/tests/timelineHandoffFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselPredictions/tests/predictionInputsFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselActualizations/tests/deriveDepartNextActualizationIntent.test.ts
bun test convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts
```

If files under `convex/` are deleted or added, run codegen if that is the local
project norm and include generated API changes when appropriate.

## Return To Supervisor

Report:

- Files deleted
- Files rewritten
- Whether schedule helper folders were kept or removed, and why
- Remaining `rg` hits for old event/builder names, if any
- Tests run and results
- Any cleanup deferred to Stage 6

Do not implement the optional consolidated schedule query in this stage.
