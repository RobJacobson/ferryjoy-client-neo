# Vessel Orchestrator pipeline

This document defines the single-ping runtime contract for the orchestrator
hot path in `convex/functions/vesselOrchestrator`.

## Entry point

- Action: `updateVesselOrchestrator` in `actions/updateVesselOrchestrator.ts`
- Core flow: `runOrchestratorPing`
- Mutations per ping:
  - one `bulkUpsertVesselLocations` for locations **and** subset `activeVesselTrips` reads (same transaction)
  - one atomic `persistVesselUpdates` write per changed vessel whose trip stage returns updates

## Single-ping stages

1. **Load identity read model**
  - Function: `loadOrchestratorSnapshot` (`actions/ping/loadSnapshot`)
  - Query: `getOrchestratorIdentities` (`queries/orchestratorSnapshotQueries.ts`)
  - Reads: `vesselsIdentity`, `terminalsIdentity`
  - Output: `{ vesselsIdentity, terminalsIdentity }`
  - Precondition: empty `vesselsIdentity` or `terminalsIdentity` throws (fatal setup; ping cannot proceed)

2. **Fetch, normalize, augment, persist locations, and load active trips for changed vessels**
  - Function: `runUpdateVesselLocations` (`actions/ping/updateVesselLocations`)
  - Mutation: `bulkUpsertVesselLocations` (`functions/vesselLocation/mutations.ts`)
  - External input: WSF vessel locations
  - Output: **`{ changedLocations, activeTripsForChanged }`** from the mutation; orchestrator builds **`activeTripsByVesselAbbrev`** for the per-vessel loop
  - Phase contract: this stage derives `AtDockObserved`; downstream trip
     `AtDock` is persisted from that observed phase
  - Behavior: mutation-side dedupe (`VesselAbbrev` + unchanged `TimeStamp`); when there are changed rows, **`loadActiveTripsForChanged`** runs in the **same mutation** after writes (`activeVesselTrips` by `by_vessel_abbrev`, `.first()` per distinct changed abbrev)
  - Semantics: `existingVesselTrip` for Stage 4 reflects DB state **after** this ping’s location writes for those vessels
  - Failure policy: per-vessel upsert failures are logged and do not abort
     writes for other vessels in the same batch

3. **Build schedule continuity access**
  - Function: `createUpdateVesselTripDbAccess` (`actions/ping/updateVesselTrip`)
  - Behavior: key-backed segment lookup first; current/next-day rollover rows
    only when key continuity is unavailable or stale
  - Output: `UpdateVesselTripDbAccess`

4. **Sequential per-vessel sparse pipeline (changed rows only)**
   - Loop: `for (const vesselLocation of dedupedLocationUpdates)`
   - For each vessel:
     1. Domain **`updateVesselTrip`** computes a sparse **`VesselTripUpdate | null`** (skip when `null`)
     2. Domain **`updateLeaveDockEventPatch`** (`domain/vesselOrchestration/updateLeaveDockEventPatch`) produces an optional **`updateLeaveDockEventPatch`** payload on observed leave-dock transitions
     3. Domain **`getVesselTripPredictionsFromTripUpdate`** loads prediction model parameters when **`getPredictionModelParametersFromTripUpdate`** is non-null (**`loadPredictionModelParameters`**) and returns **`enrichedActiveVesselTrip`**
     4. Domain **`updateTimeline`** takes **`{ pingStartedAt, tripUpdate, enrichedActiveVesselTrip }`**; it derives **`PersistedTripTimelineHandoff`** internally (**`timelineHandoffFromTripUpdate`**), builds prediction overlay handoffs, then projects **`actualEvents`** / **`predictedEvents`**
     5. **`persistVesselUpdates`** applies trip, timeline, and optional **`updateLeaveDockEventPatch`** (depart-next ML on `eventsPredicted`) in one mutation transaction
   - Failure policy: per-vessel failures are logged and the loop continues

## Invariants

- One WSF fetch per ping.
- One identity read-model query per ping (`getOrchestratorIdentities`).
- One locations mutation per ping (`bulkUpsertVesselLocations`) that includes active-trip reads for changed abbrevs when `changedLocations` is non-empty; **no** separate `getActiveTripsForVesselAbbrevs` query.
- One atomic per-vessel persistence mutation whose trip stage returns a non-null `VesselTripUpdate`.
- Trip compute runs against changed location rows returned by location-upsert dedupe.
- Schedule continuity reads are targeted and new-trip-gated: primary
  `NextScheduleKey` lookup first, rollover fallback only when needed.
- Prediction model loading is gated per vessel by runnable Stage 4 specs derived
  from changed durable trip facts.
- Timeline projection runs in action memory using same-ping
  **`enrichedActiveVesselTrip`**, and **`persistVesselUpdates`** only
  applies supplied rows.
- Location dedupe is mutation-side in `bulkUpsertVesselLocations`
  (`VesselAbbrev` + `TimeStamp` skip).

## Failure behavior

- Fatal setup failures are logged and rethrown by `updateVesselOrchestrator`.
- Per-vessel pipeline failures after dedupe are isolated inside the loop and do
  not stop the whole ping.
- `persistVesselUpdates` is all-or-nothing for one vessel branch; any failed
  trip, timeline, or actualization write rolls back that vessel's
  persistence mutation.
- Per-vessel location upsert failures remain isolated inside
  `performBulkUpsertVesselLocations`.
