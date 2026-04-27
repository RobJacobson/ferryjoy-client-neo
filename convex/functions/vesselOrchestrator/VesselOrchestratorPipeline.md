# Vessel Orchestrator pipeline

This document defines the single-ping runtime contract for the orchestrator
hot path in `convex/functions/vesselOrchestrator`.

## Entry point

- Action: `updateVesselOrchestrator` in `action/actions.ts`
- Core flow: `runOrchestratorPing`
- Mutations per ping:
  - one `bulkUpsertVesselLocations` for locations
  - many sparse `persistPerVesselOrchestratorWrites` calls (trip/prediction/timeline writes; one per changed vessel)

## Single-ping stages

1. **Load baseline read model**
   - Function: `loadOrchestratorSnapshot`
   - Reads: `vesselsIdentity`, `terminalsIdentity`, `activeVesselTrips`
   - Output: `{ vesselsIdentity, terminalsIdentity, activeTrips }`
   - Precondition: empty `vesselsIdentity` or `terminalsIdentity` throws (fatal setup; ping cannot proceed)

2. **Fetch, normalize, augment, and persist live locations**
   - Function: `updateVesselLocations`
   - External input: WSF vessel locations
   - Output: changed `ConvexVesselLocation[]` rows after dedupe
   - Phase contract: this stage derives `AtDockObserved`; downstream trip
     `AtDock` is persisted from that observed phase
   - Behavior: mutation-side dedupe (`VesselAbbrev` + unchanged `TimeStamp`)
   - Failure policy: per-vessel upsert failures are logged and do not abort
     writes for other vessels in the same batch

3. **Build schedule continuity access**
   - Function: `createScheduleContinuityAccess`
   - Behavior: targeted, memoized schedule lookups for this ping
   - Output: `ScheduleContinuityAccess`

4. **Sequential per-vessel sparse pipeline (changed rows only)**
   - Loop: `for (const vesselLocation of dedupedLocationUpdates)`
   - For each vessel:
     1. Domain **`updateVesselTrip`** computes a sparse **`VesselTripUpdate | null`** (skip when `null`)
     2. **`loadPredictionContext`** runs a Convex query for production model parameters when terminal-pair preload requests apply (derived in domain via **`predictionModelLoadRequestsForTripUpdate`**)
     3. Domain **`updateVesselPredictions`** takes `{ tripUpdate, predictionContext }` and returns **`predictionRows`** + **`mlTimelineOverlays`**
     4. Domain **`updateTimeline`** takes `{ pingStartedAt, tripUpdate, mlTimelineOverlays }`; it derives **`PersistedTripTimelineHandoff`** internally (**`timelineHandoffFromTripUpdate`**) then projects **`actualEvents`** / **`predictedEvents`**
     5. Mutation **`persistPerVesselOrchestratorWrites`** writes in order:
        - trip writes (`persistVesselTripWrites`)
        - prediction upserts (`batchUpsertProposalsInDb`)
        - timeline rows:
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
