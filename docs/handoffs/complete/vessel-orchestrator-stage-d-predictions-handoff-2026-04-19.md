# Handoff: Vessel orchestrator Stage D predictions pipeline

**Date:** 2026-04-19  
**Audience:** engineer or agent implementing Stage D of the idempotent
four-pipeline refactor  
**Status:** actionable handoff for the next implementation pass

## Primary reference

Read this PRD first and treat it as the source of truth for Stage D:

- [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/vessel-orchestrator-idempotent-four-pipelines-prd.md)

Read these as active constraints:

- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`/.cursor/rules/code-style.mdc`](../../.cursor/rules/code-style.mdc)

Optional background, only if needed:

- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md)
- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)

## What Stages A through C already landed

Stage A froze the public predictions contract and established the target
boundary:

- [updateVesselPredictions/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/contracts.ts)
- [updateVesselPredictions/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/index.ts)

Stage B moved locations to the proper domain-owned boundary, which is relevant
mainly because predictions should no longer need raw-location-driven trip
recompute once Stage D is done.

Stage C landed the canonical trips boundary:

- [runUpdateVesselTrips.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/runUpdateVesselTrips.ts)
- [contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselTrips/contracts.ts)

`runUpdateVesselTrips(input) -> { activeTrips, completedTrips, tripComputations }`
is now the canonical trip handoff. Stage D should consume that handoff instead
of recomputing trips from raw orchestration inputs.

## Stage D goal

Make `updateVesselPredictions` the real domain owner of prediction computation
under the already-frozen plain-data public contract.

This means:

- `runUpdateVesselPredictions(input) -> output` remains the canonical public
  entrypoint
- predictions consumes `tripComputations`
- predictions consumes a plain-data `predictionContext`
- predictions emits:
  - `vesselTripPredictions`
  - `predictedTripComputations`
- the functions layer owns Convex queries, compare/dedupe rules, and mutation
  ordering

Stage D is where the predictions concern stops being a thin wrapper around
query-backed prediction access and stopgap trip recompute.

## Current state

Right now, [orchestratorPredictionWrites.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/orchestratorPredictionWrites.ts)
is still a transitional runner:

- it accepts `VesselTripsComputeBundle`
- it accepts `VesselTripPredictionModelAccess`
- it derives ML overlay from bundle-shaped lifecycle outputs
- it still explains the prediction stage through legacy apply shapes rather than
  the Stage A public prediction contract

On the functions side, [actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)
still recomputes trips for the predictions phase using
`computeVesselTripsWithClock(...)` and query-backed prediction access.

That was acceptable before Stage C. It is not the desired Stage D end state.

## Desired Stage D end state

### Public domain story

The predictions concern should present this single public story:

- `runUpdateVesselPredictions(input) -> { vesselTripPredictions, predictedTripComputations }`

The public contracts in [contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/contracts.ts)
should remain stable unless a very strong reason appears. Preserve the Stage A
surface if at all possible.

### Domain ownership

`updateVesselPredictions` should own:

- ML attachment from `tripComputations`
- prediction proposal derivation
- predicted handoff data needed by timeline

The predictions concern should not require query-backed model access or raw
trip bundle recompute to explain its own output.

### Functions-layer story

The functions layer should own:

- loading the plain-data prediction preload blob
- calling `runUpdateVesselPredictions`
- deduping prediction proposal rows
- persisting prediction rows
- passing `predictedTripComputations` to Stage E

## Main implementation target

Replace the public explanation of predictions from:

- `VesselTripsComputeBundle + VesselTripPredictionModelAccess -> TripLifecycleApplyOutcome`

to:

- `tripComputations + predictionContext -> { vesselTripPredictions, predictedTripComputations }`

The most important architectural change is not the internal helper layout. It
is removing query-backed domain access and making the predictions pipeline a
plain-data consumer of the trips pipeline.

## Recommended implementation approach

### 1. Keep the public contract stable

Do not redesign the public Stage A contract unless absolutely necessary.

Preserve:

- `RunUpdateVesselPredictionsInput`
- `RunUpdateVesselPredictionsOutput`
- `PredictedTripComputation`
- `runUpdateVesselPredictions`

If `PredictedTripComputation` needs refinement, keep it minimal and additive if
possible.

### 2. Make predictions consume `tripComputations`

Preferred direction:

- take the Stage C `tripComputations` handoff as input
- apply ML and prediction proposal derivation directly from that handoff
- stop recomputing trip compute from raw locations and active trips inside the
  predictions phase

Transitional private adapters are fine if needed, but the public story should
be based on `tripComputations`.

### 3. Make `predictionContext` real plain data

The Stage A public contract already defines:

- `predictionContext: VesselPredictionContext`

Stage D should make that real. The functions layer may preload a large blob and
normalize it before calling domain. Domain should not receive query ports,
`ActionCtx`, or Convex-backed access objects.

### 4. Keep persistence and equality rules in functions

The predictions concern should emit the full computed prediction rows every
tick. The functions layer should remain responsible for compare-then-write and
table-specific persistence decisions.

Do not move proposal dedupe semantics into domain just because the stage now
owns the compute story.

### 5. Preserve the Stage C to Stage E handoff direction

Stage D should produce the predicted handoff that timeline needs, but it should
not redesign timeline in the same pass.

Timeline should become easier after Stage D, not partially rewritten during it.

## Current likely files to touch

### Main Stage D files

- [convex/domain/vesselOrchestration/updateVesselPredictions/contracts.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/contracts.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/orchestratorPredictionWrites.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/orchestratorPredictionWrites.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/index.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/index.ts)

### Functions-layer caller

- [convex/functions/vesselOrchestrator/actions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/actions.ts)

### Prediction helpers likely involved

- [convex/domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/vesselTripPredictionProposalsFromMlTrip.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/vesselTripPredictionProposalsFromMlTrip.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/predictionCompare.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/predictionCompare.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/vesselTripPredictionPersistPlan.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/vesselTripPredictionPersistPlan.ts)

### Timeline handoff consumers to understand, but not fully redesign yet

- [convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts)
- [convex/domain/vesselOrchestration/updateTimeline/timelineEventAssembler.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateTimeline/timelineEventAssembler.ts)

## Non-goals for Stage D

Do **not** let Stage D expand into:

- Stage E timeline redesign
- a broad `shared/tickHandshake` redesign unless required for the prediction
  handoff to compile coherently
- a full prediction-model overhaul
- moving compare-then-write persistence decisions into domain
- aggressive cleanup of every transitional trip helper just because predictions
  stopped using them

Stage D is about making the predictions concern the real domain owner under the
already-frozen public contract.

## Acceptance criteria

Stage D is complete when all of the following are true:

1. `runUpdateVesselPredictions` remains the canonical public entrypoint.
2. The predictions concern consumes `tripComputations`, not raw trip recompute
   inputs.
3. The predictions concern consumes plain-data `predictionContext`, not
   query-backed access objects.
4. The public predictions story is plain data in, plain data out.
5. The functions layer still owns compare/dedupe and persistence.
6. `predictedTripComputations` is the handoff passed forward to Stage E.
7. Domain code no longer queries Convex during prediction computation.

## Test expectations

At minimum, preserve or extend coverage for:

- prediction computation from `tripComputations`
- prediction-context-driven ML attachment without query ports
- shape and stability of `predictedTripComputations`
- proposal-row derivation from the predicted handoff
- functions-layer sequencing staying coherent after the Stage D migration

Likely existing test anchors:

- [convex/domain/vesselOrchestration/updateVesselPredictions/tests/applyVesselPredictions.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/tests/applyVesselPredictions.test.ts)
- [convex/domain/vesselOrchestration/updateVesselPredictions/tests/vesselTripPredictionPersistPlan.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/domain/vesselOrchestration/updateVesselPredictions/tests/vesselTripPredictionPersistPlan.test.ts)
- [convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts](/Users/rob/code/ferryjoy/ferryjoy-client-neo/convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts)

If you add concern-local runner tests, prefer placing them under
`convex/domain/vesselOrchestration/updateVesselPredictions/tests/`.

## Validation

After implementing Stage D, run the usual checks:

- `bun run type-check`
- `bun run convex:typecheck`
- `bun run check:fix`

Add targeted Stage D tests as needed to verify the new public prediction
boundary and the updated orchestrator sequencing.
