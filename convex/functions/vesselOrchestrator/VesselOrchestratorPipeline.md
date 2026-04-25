# Vessel Orchestrator pipeline

This document defines the single-ping runtime contract for the orchestrator
hot path in `convex/functions/vesselOrchestrator`.

## Entry point

- Action: `updateVesselOrchestrator` in `actions.ts`
- Core flow: `runOrchestratorPing`
- Persistence boundary: one mutation call to `persistOrchestratorPing`

## Single-ping stages

1. **Load baseline read model**
   - Function: `loadOrchestratorSnapshot`
   - Reads: `vesselsIdentity`, `terminalsIdentity`, `activeVesselTrips`
   - Output: `{ vesselsIdentity, terminalsIdentity, activeTrips }`

2. **Fetch and normalize live locations**
   - Function: `loadVesselLocationUpdates`
   - External input: WSF vessel locations
   - Output: `VesselLocationUpdates[]` (normalized batch)

3. **Build schedule continuity access**
   - Function: `createScheduleContinuityAccess`
   - Behavior: targeted, memoized schedule lookups for this ping
   - Output: `ScheduleContinuityAccess` with optional sanity metrics summary

4. **Compute trip stage for full normalized batch**
   - Function: `computeTripStageForLocations`
   - Loop policy: all normalized locations each ping
   - Output:
     - `tripRows` (`activeTrips`, `completedTrips`)
     - `predictionInputs` (changed-facts gate for prediction stage)

5. **Run prediction stage (gated)**
   - Function: `runPredictionStage`
   - Gate: no-op when both active and completed prediction inputs are empty
   - Output:
     - `predictionRows`
     - `mlTimelineOverlays`

6. **Persist one orchestrator bundle**
   - Mutation: `persistOrchestratorPing`
   - Writes in order:
     1. location upsert (`performBulkUpsertVesselLocations`)
     2. trip writes (`persistVesselTripWriteSet`)
     3. prediction upserts (`batchUpsertProposalsInDb`) when non-empty
     4. timeline projection (`runUpdateVesselTimelineFromAssembly`)
     5. timeline table writes (`upsertActualDockRows`, `projectPredictedDockWriteBatchesInDb`)

## Invariants

- One WSF fetch per ping.
- One baseline orchestrator read-model query per ping.
- One persistence mutation call per ping.
- Trip compute runs against the full normalized batch.
- Schedule continuity reads are targeted and memoized per ping.
- Prediction model loading is gated by changed durable trip facts.
- Timeline projection consumes persisted trip handoff plus same-ping ML overlays.
- Location dedupe is mutation-side (`VesselAbbrev` + `TimeStamp` skip).

## Failure behavior

- Fatal ping failures are logged and rethrown by `updateVesselOrchestrator`.
- Per-vessel trip-stage failures are isolated inside the loop and do not stop
  the whole ping.
- Completed-trip and leave-dock follow-up writes use settled handling so one
  vessel failure does not abort all write intents.

## Optional sanity instrumentation

Two toggles in `constants.ts` control temporary low-noise instrumentation:

- `ENABLE_ORCHESTRATOR_SANITY_METRICS`
- `ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS`

When both are enabled, one summary log per ping may be emitted for:

- schedule continuity access metrics
- location dedupe metrics
