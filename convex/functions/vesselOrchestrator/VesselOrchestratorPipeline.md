# Vessel Orchestrator pipeline

This document defines the single-ping runtime contract for the orchestrator
hot path in `convex/functions/vesselOrchestrator`.

## Entry point

- Action: `updateVesselOrchestrator` in `actions.ts`
- Core flow: `runOrchestratorPing`
- Mutations per ping:
  - one `bulkUpsertVesselLocations` for locations
  - one atomic `persistVesselUpdates` write per changed vessel whose trip stage returns updates

## Single-ping stages

1. **Load baseline read model**
  - Function: `loadOrchestratorSnapshot` (`pipeline/loadSnapshot`)
   - Reads: `vesselsIdentity`, `terminalsIdentity`, `activeVesselTrips`
   - Output: `{ vesselsIdentity, terminalsIdentity, activeTrips }`
   - Precondition: empty `vesselsIdentity` or `terminalsIdentity` throws (fatal setup; ping cannot proceed)

2. **Fetch, normalize, augment, and persist live locations**
  - Function: `runUpdateVesselLocations` (`pipeline/updateVesselLocations`)
   - External input: WSF vessel locations
   - Output: changed `ConvexVesselLocation[]` rows after dedupe
   - Phase contract: this stage derives `AtDockObserved`; downstream trip
     `AtDock` is persisted from that observed phase
   - Behavior: mutation-side dedupe (`VesselAbbrev` + unchanged `TimeStamp`)
   - Failure policy: per-vessel upsert failures are logged and do not abort
     writes for other vessels in the same batch

3. **Build schedule continuity access**
  - Function: `createUpdateVesselTripDbAccess` (`pipeline/updateVesselTrip`)
  - Behavior: key-backed segment lookup first; current/next-day rollover rows
    only when key continuity is unavailable or stale
  - Output: `UpdateVesselTripDbAccess`

4. **Sequential per-vessel sparse pipeline (changed rows only)**
   - Loop: `for (const vesselLocation of dedupedLocationUpdates)`
   - For each vessel:
     1. Domain **`updateVesselTrip`** computes a sparse **`VesselTripUpdate | null`** (skip when `null`)
     2. Domain **`updateLeaveDockEventPatch`** (`domain/vesselOrchestration/updateLeaveDockEventPatch`) produces an optional **`updateLeaveDockEventPatch`** payload on observed leave-dock transitions
     3. **`loadPredictionContext`** runs a Convex query for production model parameters when terminal-pair preload requests apply (derived in domain via **`predictionModelLoadRequestForTripUpdate`**)
     4. Domain **`updateVesselPredictions`** takes `{ tripUpdate, predictionContext }` and returns **`predictionRows`** + **`mlTimelineOverlays`**
     5. Domain **`updateTimeline`** takes `{ pingStartedAt, tripUpdate, mlTimelineOverlays }`; it derives **`PersistedTripTimelineHandoff`** internally (**`timelineHandoffFromTripUpdate`**) then projects **`actualEvents`** / **`predictedEvents`**
     6. **`persistVesselUpdates`** applies trip, prediction, timeline, and optional **`updateLeaveDockEventPatch`** (depart-next ML on `eventsPredicted`) in one mutation transaction
   - Failure policy: per-vessel failures are logged and the loop continues

## Invariants

- One WSF fetch per ping.
- One baseline orchestrator read-model query per ping.
- One locations mutation per ping plus one atomic per-vessel persistence
  mutation whose trip stage returns a non-null `VesselTripUpdate`.
- Trip compute runs against changed location rows returned by location-upsert dedupe.
- Schedule continuity reads are targeted and new-trip-gated: primary
  `NextScheduleKey` lookup first, rollover fallback only when needed.
- Prediction model loading is gated per vessel by changed durable trip facts.
- Timeline projection runs in action memory using same-ping ML overlays, and
  `persistVesselUpdates` only applies supplied rows.
- Location dedupe is mutation-side in `bulkUpsertVesselLocations`
  (`VesselAbbrev` + `TimeStamp` skip).

## Failure behavior

- Fatal setup failures are logged and rethrown by `updateVesselOrchestrator`.
- Per-vessel pipeline failures after dedupe are isolated inside the loop and do
  not stop the whole ping.
- `persistVesselUpdates` is all-or-nothing for one vessel branch; any failed
  trip, prediction, timeline, or actualization write rolls back that vessel's
  persistence mutation.
- Per-vessel location upsert failures remain isolated inside
  `performBulkUpsertVesselLocations`.
