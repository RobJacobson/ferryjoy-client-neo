# Vessel Orchestrator pipeline

This document defines the single-ping runtime contract for the orchestrator
hot path in `convex/functions/vesselOrchestrator`.

## Entry point

- Action: `updateVesselOrchestrator` in `actions.ts`
- Core flow: `runOrchestratorPing`
- Mutations per ping:
  - `bulkUpsertVesselLocations` (locations only)
  - `persistTripAndPredictionWrites` (trips + predictions)
  - `persistTimelineEventWrites` (timeline rows only)

## Single-ping stages

1. **Load baseline read model**
   - Function: `loadOrchestratorSnapshot`
   - Reads: `vesselsIdentity`, `terminalsIdentity`, `activeVesselTrips`
   - Output: `{ vesselsIdentity, terminalsIdentity, activeTrips }`

2. **Fetch and normalize live locations**
   - Function: `loadVesselLocationUpdates`
   - External input: WSF vessel locations
   - Output: `ConvexVesselLocation[]` (normalized batch)

3. **Persist normalized locations**
   - Mutation: `bulkUpsertVesselLocations`
   - Payload: full normalized `locations[]`
   - Behavior: mutation-side dedupe (`VesselAbbrev` + unchanged `TimeStamp`)
   - Failure policy: per-vessel upsert failures are logged and do not abort
     writes for other vessels in the same batch

4. **Build schedule continuity access**
   - Function: `createScheduleContinuityAccess`
   - Behavior: targeted, memoized schedule lookups for this ping
   - Output: `ScheduleContinuityAccess` with optional sanity metrics summary

5. **Compute trip stage for changed normalized rows**
   - Function: `computeTripStageForLocations`
   - Loop policy: only changed location rows returned by
     `bulkUpsertVesselLocations` after timestamp dedupe
   - Output:
    - `tripWrites` (`completedTripWrites`, `activeTripUpserts`, `actualDockWrites`, `predictedDockWrites`)
     - `predictionInputs` (changed-facts gate for prediction stage)

6. **Run prediction stage (gated)**
   - Function: `runPredictionStage`
   - Gate: no-op when both active and completed prediction inputs are empty
   - Output:
     - `predictionRows`
     - `mlTimelineOverlays`

7. **Persist trip/prediction writes**
   - Mutation: `persistTripAndPredictionWrites`
   - Writes in order:
     1. trip writes (`persistVesselTripWrites`)
        - leave-dock actualization intents are derived during persist from
          `actualDockWrites` for vessels whose active upsert succeeded
     2. prediction upserts (`batchUpsertProposalsInDb`) when non-empty
   - Output: persisted trip handoff for timeline assembly

8. **Assemble and persist timeline rows**
   - Action assembly: `updateTimeline` runs in action memory
     using `tripHandoffForTimeline` + `mlTimelineOverlays`
   - Mutation: `persistTimelineEventWrites`
   - Writes: `upsertActualDockRows`, `projectPredictedDockWriteBatchesInDb`

## Invariants

- One WSF fetch per ping.
- One baseline orchestrator read-model query per ping.
- Three mutation calls per ping:
  - one locations-only upsert mutation
  - one trip/prediction mutation
  - one timeline-rows-only mutation
- Trip compute runs against changed location rows returned by location-upsert
  dedupe.
- Schedule continuity reads are targeted and memoized per ping.
- Prediction model loading is gated by changed durable trip facts.
- Timeline projection consumes persisted trip handoff plus same-ping ML overlays.
- Location dedupe is mutation-side in `bulkUpsertVesselLocations`
  (`VesselAbbrev` + `TimeStamp` skip).

## Failure behavior

- Fatal ping failures are logged and rethrown by `updateVesselOrchestrator`.
- Per-vessel trip-stage failures are isolated inside the loop and do not stop
  the whole ping.
- Per-vessel location upsert failures are isolated inside
  `performBulkUpsertVesselLocations`.
- Completed-trip and leave-dock follow-up writes use settled handling so one
  vessel failure does not abort all write intents.

## Optional sanity instrumentation

Two toggles in `constants.ts` control temporary low-noise instrumentation:

- `ENABLE_ORCHESTRATOR_SANITY_METRICS`
- `ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS`

When both are enabled, one summary log per ping may be emitted for:

- schedule continuity access metrics
- location dedupe metrics
