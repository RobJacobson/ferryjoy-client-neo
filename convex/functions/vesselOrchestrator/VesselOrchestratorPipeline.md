# Vessel Orchestrator pipeline

This document defines the single-ping runtime contract for the orchestrator
hot path in `convex/functions/vesselOrchestrator`.

## Entry point

- Action: `updateVesselOrchestrator` in `actions.ts`
- Core flow: `runOrchestratorPing`
- Mutations per ping:
  - one `bulkUpsertVesselLocations` for locations
  - many sparse `persistPerVesselOrchestratorWrites` calls (trip/prediction/timeline writes; one per changed vessel)

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

5. **Sequential per-vessel sparse pipeline (changed rows only)**
   - Loop: `for (const location of dedupedLocationUpdates)`
   - For each vessel:
     1. `computeTripStageForLocation` computes trip diff (`updateVesselTrips`)
     2. skip vessel when no trip rows changed
     3. `runPredictionStage` computes prediction rows and ML overlays
    4. action computes timeline projection (`updateTimeline`) from trip-write handoff + ML overlays
    5. mutation `persistPerVesselOrchestratorWrites` writes in order:
        - trip writes (`persistVesselTripWrites`)
        - prediction upserts (`batchUpsertProposalsInDb`)
        - final timeline rows:
          - actual row upserts (`upsertActualDockRows`)
          - predicted row writes (`projectPredictedDockWriteBatchesInDb`)
   - Failure policy: per-vessel failures are logged and the loop continues

## Invariants

- One WSF fetch per ping.
- One baseline orchestrator read-model query per ping.
- One locations mutation per ping plus sparse per-vessel mutation calls only for
  changed trip rows.
- Trip compute runs against changed location rows returned by location-upsert dedupe.
- Schedule continuity reads are targeted and memoized per ping.
- Prediction model loading is gated per vessel by changed durable trip facts.
- Timeline projection runs in action memory using same-ping ML overlays, and
  timeline mutations only apply supplied rows.
- Location dedupe is mutation-side in `bulkUpsertVesselLocations`
  (`VesselAbbrev` + `TimeStamp` skip).

## Failure behavior

- Fatal setup failures are logged and rethrown by `updateVesselOrchestrator`.
- Per-vessel pipeline failures after dedupe are isolated inside the loop and do
  not stop the whole ping.
- Per-vessel location upsert failures remain isolated inside
  `performBulkUpsertVesselLocations`.

## Optional sanity instrumentation

Two toggles in `constants.ts` control temporary low-noise instrumentation:

- `ENABLE_ORCHESTRATOR_SANITY_METRICS`
- `ENABLE_ORCHESTRATOR_SANITY_SUMMARY_LOGS`

When both are enabled, one summary log per ping may be emitted for:

- schedule continuity access metrics
- location dedupe metrics
