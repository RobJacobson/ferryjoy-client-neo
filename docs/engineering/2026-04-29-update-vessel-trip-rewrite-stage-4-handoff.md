# updateVesselTrip Rewrite - Stage 4 Handoff

Date: 2026-04-29

Branch: `rewrite-update-vessel-trips`

## Read First

- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-prd.md`
- `docs/engineering/2026-04-29-update-vessel-trip-rewrite-stage-3-handoff.md`
- `convex/domain/vesselOrchestration/updateVesselTrip/updateVesselTrip.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/tripLifecycle.ts`
- `convex/domain/vesselOrchestration/updateTimeline/timelineHandoffFromTripUpdate.ts`
- `convex/domain/vesselOrchestration/updateVesselPredictions/predictionInputsFromTripUpdate.ts`
- `convex/domain/vesselOrchestration/updateVesselActualizations/deriveDepartNextActualizationIntent.ts`

Stage 3 is approved. The public `updateVesselTrip` entrypoint now uses the new
linear pipeline and all targeted tests pass.

## Goal

Audit and harden the downstream compatibility contract now that
`updateVesselTrip` no longer runs through old `tripEvents` / `tripBuilders`.

This stage is not a deletion pass. It should ensure prediction, timeline, and
actualization consumers are safely deriving lifecycle facts from the returned
rows, not relying on obsolete internal event machinery.

## Files You May Edit

Preferred:

- `convex/domain/vesselOrchestration/updateVesselTrip/tripLifecycle.ts`
- `convex/domain/vesselOrchestration/updateTimeline/tests/timelineHandoffFromTripUpdate.test.ts`
- `convex/domain/vesselOrchestration/updateVesselPredictions/tests/predictionInputsFromTripUpdate.test.ts`
- `convex/domain/vesselOrchestration/updateVesselActualizations/tests/deriveDepartNextActualizationIntent.test.ts`

Allowed if a contract issue is found:

- `convex/domain/vesselOrchestration/updateTimeline/timelineHandoffFromTripUpdate.ts`
- `convex/domain/vesselOrchestration/updateVesselPredictions/predictionInputsFromTripUpdate.ts`
- `convex/domain/vesselOrchestration/updateVesselActualizations/deriveDepartNextActualizationIntent.ts`
- `convex/domain/vesselOrchestration/updateVesselTrip/index.ts`

Avoid in Stage 4:

- Do not delete old implementation modules yet.
- Do not rewrite the schedule pipeline.
- Do not change `VesselTripUpdate` shape.
- Do not edit orchestrator persistence unless a downstream test exposes a real
  contract mismatch.

## Required Review Points

### 1. `tripLifecycle.ts`

Confirm the exported compatibility helpers are still row-diff helpers:

- `buildCompletionTripEvents(existingTrip, completedTrip)`
- `currentTripEvents(existingTrip, nextTrip)`
- `TripLifecycleEventFlags`

They should not import or depend on:

- `tripEvents.ts`
- `detectTripEvents`
- `buildUpdatedVesselRows`
- any new pass-around event DTO

If the existing implementation already satisfies this, leave it mostly alone.

### 2. Completion Handoff

Add or confirm tests where a real `VesselTripUpdate` shape with:

- `existingActiveTrip`
- `completedVesselTripUpdate`
- replacement `activeVesselTripUpdate`

produces downstream completion facts for:

- prediction input handoff
- timeline handoff

The important behavior is that terminal-change completion from the new pipeline
still produces an arrival actual via `completedVesselTripUpdate.TripEnd`.

### 3. Leave-Dock Actualization

Add or confirm a test where an active-only update with:

- previous trip `AtDock: true`
- next trip `AtDock: false`
- next trip `LeftDockActual` set from the feed `LeftDock`

produces a depart-next actualization intent when `ScheduleKey` exists.

This is the downstream proof that the Stage 3 `LeftDockActual` fix is visible to
actualization consumers.

### 4. Terminal-Change With AtDockObserved Lag

If practical, add one downstream test or small fixture that uses a trip update
representing:

- terminal abbreviation changed
- replacement active row has `AtDock: false`
- completed row still has `TripEnd`

Expected:

- completion handoff exists
- current-branch arrival event is not required

This protects the intended rule that terminal transition owns completion even
when dock phase lags.

## Verification

Run:

```sh
bun test convex/domain/vesselOrchestration/updateTimeline/tests/timelineHandoffFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselPredictions/tests/predictionInputsFromTripUpdate.test.ts
bun test convex/domain/vesselOrchestration/updateVesselActualizations/tests/deriveDepartNextActualizationIntent.test.ts
bun test convex/domain/vesselOrchestration/updateVesselTrip/tests
```

If you touch public exports, also run:

```sh
bun test convex/functions/vesselOrchestrator/tests/tripStagePolicy.test.ts
```

Expected:

- All listed tests pass.

## Return To Supervisor

Report:

- Files changed
- Tests added or confirmed
- Tests run and results
- Whether `tripLifecycle.ts` is already clean row-diff compatibility code
- Any downstream contract mismatch found

Do not proceed to deleting old modules or docs cleanup.
