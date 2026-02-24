# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. For regular updates, the pipeline always constructs the full intended `VesselTrip` state, deep-compares to existing, and writes only when different. Trip boundaries and first trips always produce writes.

**Four-function design**:
1. `buildTripFromVesselLocation` — main object from raw location data (simple assignments); derives Key from raw data for schedule lookup
2. `buildTripWithInitialSchedule` — arrival terminal lookup when vessel arrives at dock (event-driven: AtDock false→true)
3. `buildTripWithFinalSchedule` — schedule lookup by Key when arrival data available or key changed (event-driven)
4. `buildTripWithArriveDockPredictions`, `buildTripWithLeaveDockPredictions` — ML predictions when event-triggered (arrive-dock, depart-dock)

---

## Architecture

### Pipeline Overview

```
runUpdateVesselTrips (entry point)
    ├─> Load active trips (once)
    ├─> Categorize vessel/location tuples into three groups:
    │       newTrips, completedTrips, currentTrips
    └─> Delegate to processing functions (each handles own persistence):
            ├─> processNewTrips (first appearance)
            │       buildTripWithAllData → upsertActiveTrip
            │       (internal: buildTripFromVesselLocation → buildTripWithFinalSchedule → buildTripWithArriveDockPredictions → buildTripWithLeaveDockPredictions)
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTripWithAllData → completeAndStartNewTrip
            │       → bulkInsertPredictions (completed records)
            │       (internal: buildTripFromVesselLocation → buildTripWithInitialSchedule → buildTripWithFinalSchedule → buildTripWithArriveDockPredictions → buildTripWithLeaveDockPredictions)
            └─> processCurrentTrips (ongoing trips)
                    buildTripWithAllData → tripsAreEqual → upsertVesselTripsBatch (if changed)
                    → setDepartNextActualsForMostRecentCompletedTrip (when didJustLeaveDock)
                    → bulkInsertPredictions
                    (internal: buildTripFromVesselLocation → buildTripWithInitialSchedule → buildTripWithFinalSchedule → buildTripWithArriveDockPredictions → buildTripWithLeaveDockPredictions)
```

### File Structure

| File | Purpose |
|------|---------|
| `updateVesselTrips.ts` | Main orchestrator: categorizes vessels into new/completed/current, delegates to processing functions |
| `buildCompletedTrip.ts` | `buildCompletedTrip` — builds completed trip with TripEnd, durations, and actualized predictions |
| `buildTripFromVesselLocation.ts` | `buildTripFromVesselLocation` — location-derived fields, handles first trip, trip boundary, and regular update |
| `buildTripWithAllData.ts` | `buildTripWithAllData` — orchestrates all build functions (location, schedule, predictions) with event detection |
| `buildTripWithPredictions.ts` | `buildTripWithArriveDockPredictions`, `buildTripWithLeaveDockPredictions` — ML predictions for arrive-dock (AtDockArriveNext, AtDockDepartNext) and depart-dock (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext) events |
| `buildTripWithSchedule.ts` | `buildTripWithInitialSchedule`, `buildTripWithFinalSchedule` — event-driven schedule lookup by Key |
| `utils.ts` | `tripsAreEqual`, `deepEqual`, `updateAndExtractPredictions` |

**External dependencies**:
- `convex/domain/ml/prediction/vesselTripPredictions.ts` — `PREDICTION_SPECS`, `predictFromSpec`, `updatePredictionsWithActuals`
- `convex/domain/ml/prediction/predictTrip.ts` — `loadModelsForPairBatch`, `predictTripValue`
- `convex/functions/vesselTrips/mutations.ts` — `completeAndStartNewTrip`, `upsertVesselTripsBatch`, `setDepartNextActualsForMostRecentCompletedTrip`

---

## Event Types

### 1. First Trip

**Condition**: No existing active trip for `VesselAbbrev`.

**Behavior**: Create new trip via `buildTripWithAllData(ctx, currLocation)`. Internally calls `buildTripFromVesselLocation` → `buildTripWithFinalSchedule` (if Key derivable and LeftDock available) → `buildTripWithArriveDockPredictions` (if at dock and trip ready) → `buildTripWithLeaveDockPredictions` (if LeftDock defined). Always writes via `upsertActiveTrip`.

### 2. Trip Boundary

**Condition**: `DepartingTerminalAbbrev` changes (vessel arrived at a new terminal).

**Behavior**:
1. Complete current trip via `buildCompletedTrip`: set `TripEnd`, compute `AtSeaDuration`, `TotalDuration`, actualize predictions.
2. Start new trip via `buildTripWithAllData` with `completedTrip` for `Prev*` context: internally calls `buildTripFromVesselLocation` → `buildTripWithInitialSchedule` (if at dock with missing ArrivingTerminal) → `buildTripWithFinalSchedule` (if Key derivable) → `buildTripWithArriveDockPredictions` (if just arrived at dock) → `buildTripWithLeaveDockPredictions` (if LeftDock defined).
3. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).
4. Insert prediction records from completed trip via `bulkInsertPredictions`.

### 3. Regular Update

**Condition**: Same `DepartingTerminalAbbrev` (vessel still on same leg).

**Behavior**:
1. `buildTripWithAllData` — orchestrates all enrichments with event detection:
   - Calls `buildTripWithInitialSchedule` when at dock with missing ArrivingTerminal
   - Calls `buildTripWithFinalSchedule` when Key changed or have departure info (LeftDock defined)
   - Calls `buildTripWithArriveDockPredictions` when first arrive at dock
   - Calls `buildTripWithLeaveDockPredictions` when physically depart dock
2. When `didJustLeaveDock`: call `updateAndExtractPredictions` to actualize and extract completed prediction records.
3. `tripsAreEqual(existingTrip, finalProposed)` → write only if different.
4. When `didJustLeaveDock`: call `setDepartNextActualsForMostRecentCompletedTrip` to backfill previous trip's depart-next actuals, and insert extracted prediction records.

---

## Architecture: buildTripWithAllData

`buildTripWithAllData` is the key orchestrator that coordinates all enrichments with event detection:

```typescript
buildTripWithAllData(ctx, currLocation, existingTrip?, completedTrip?)
  ├─> buildTripFromVesselLocation (base trip from raw data)
  ├─> Detect events:
  │   ├─> didJustArriveAtDock (!existingTrip.AtDock && trip.AtDock)
  │   ├─> didJustLeaveDock (existingTrip.LeftDock === undefined && trip.LeftDock !== undefined)
  │   └─> keyChanged (existingTrip.Key !== trip.Key)
  ├─> buildTripWithInitialSchedule (if didJustArriveAtDock && missing ArrivingTerminal)
  ├─> buildTripWithFinalSchedule (if keyChanged || have departure info)
  ├─> buildTripWithArriveDockPredictions (if didJustArriveAtDock)
  └─> buildTripWithLeaveDockPredictions (if didJustLeaveDock)
```

**Benefits**:
- Single entry point for trip construction used by all three processing functions
- Event detection happens in one place, not spread across multiple functions
- Consistent application of all enrichments across new trips, trip boundaries, and regular updates
- Clear separation of concerns: `buildTripFromVesselLocation` for raw data, schedule functions for database lookups, prediction functions for ML

---

## VesselTrip vs VesselLocation

**VesselLocation** is a point-in-time snapshot from the REST/API feed: position, terminals, AtDock, Eta, TimeStamp, etc.

**VesselTrip** maintains history across many updates. It adds:
- `TripStart` — inferred when vessel arrives at dock (at-sea → at-dock)
- `PrevTerminalAbbrev`, `PrevScheduledDeparture`, `PrevLeftDock` — carried from completed trip at boundary
- Derived durations: `AtDockDuration`, `TripDelay`, `AtSeaDuration`, `TotalDuration`
- ML predictions: `AtDockDepartCurr`, `AtDockArriveNext`, `AtDockDepartNext`, `AtSeaArriveNext`, `AtSeaDepartNext`

---

## Field Reference

**Invariant**: When `DepartingTerminalAbbrev` changes (trip boundary), that is a **hard reset**. Identity fields are never carried from the old trip. Contextual fields (`Prev*`) are explicitly carried from the completed trip.

| Field | Source | Update Rule |
|-------|--------|-------------|
| **VesselAbbrev** | currLocation | Direct copy every tick |
| **DepartingTerminalAbbrev** | currLocation | Direct copy; trip boundary trigger |
| **ArrivingTerminalAbbrev** | currLocation, buildTripWithInitialSchedule, or existingTrip | `currLocation` when truthy; else `buildTripWithInitialSchedule` result; else `existingTrip` (regular updates only; never old trip at boundary) |
| **Key** | Raw data | From `generateTripKey` in buildTripFromVesselLocation; used for schedule lookup |
| **ScheduledTrip** | Schedule lookup | From `buildTripWithFinalSchedule` (RouteID/RouteAbbrev live on ScheduledTrip); reused if key matches existing trip |
| **SailingDay** | Raw data | From `getSailingDay(ScheduledDeparture)` in buildTripFromVesselLocation |
| **PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock** | completedTrip | Set once at trip boundary; not updated mid-trip |
| **TripStart** | Inferred at boundary | `currLocation.TimeStamp` when vessel arrives at dock; carried forward |
| **AtDock** | currLocation | Direct copy every tick |
| **AtDockDuration** | Computed | `LeftDock - TripStart` (minutes); only when LeftDock set |
| **ScheduledDeparture** | currLocation | Only if currLocation has truthy value (null-overwrite protection) |
| **LeftDock** | currLocation or inferred | When AtDock flips false and missing: `currLocation.LeftDock ?? currLocation.TimeStamp`; else `currLocation.LeftDock ?? existingTrip.LeftDock` |
| **TripDelay** | Computed | `LeftDock - ScheduledDeparture` (minutes) |
| **Eta** | currLocation or existingTrip | `currLocation.Eta ?? existingTrip.Eta` (null-overwrite protection) |
| **TripEnd** | Boundary only | `currLocation.TimeStamp` when completing trip |
| **AtSeaDuration** | Computed | `TripEnd - LeftDock`; only on completed trip |
| **TotalDuration** | Computed | `TripEnd - TripStart`; only on completed trip |
| **InService, TimeStamp** | currLocation | Direct copy every tick |
| **AtDockDepartCurr** | ML | Run once when physically depart dock (buildTripWithLeaveDockPredictions) |
| **AtDockArriveNext, AtDockDepartNext** | ML | Run once when first arrive at dock with destination (buildTripWithArriveDockPredictions) |
| **AtSeaArriveNext, AtSeaDepartNext** | ML | Run once when physically depart dock (buildTripWithLeaveDockPredictions) |

---

## Invariants and Gotchas

### ArrivingTerminalAbbrev

- **At trip boundary**: Never use `existingTrip.ArrivingTerminalAbbrev` — the old trip's ArrivingTerminal equals the new trip's DepartingTerminal (wrong terminal).
- **Regular updates**: Fallback chain in `buildTripFromVesselLocation`: `currLocation` → `existingTrip`. Can also be populated by `buildTripWithInitialSchedule` when vessel arrives at dock with missing ArrivingTerminal.

### Null-Overwrite Protection

`ScheduledDeparture`, `Eta`, `LeftDock`: Only update when currLocation provides truthy value. Prevents overwriting good data with null from REST glitches.

### LeftDock Special Case

When `AtDock` flips false and `LeftDock` is missing, use `currLocation.LeftDock ?? currLocation.TimeStamp` (infer from tick).

### Event-Driven Side Effects

`didJustLeaveDock` drives:
- Backfill of depart-next actuals onto previous trip (`setDepartNextActualsForMostRecentCompletedTrip`)
- Actualization of `AtDockDepartCurr` and `AtSeaArriveNext`
- Extraction of `completedPredictionRecords` for bulk insert

These remain conditional; build-then-compare does not eliminate event-driven side effects.

### SailingDay from Raw Data

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via `getSailingDay` in `buildTripFromVesselLocation`, not from schedule lookup. Uses `ScheduledDeparture` only. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `buildTripWithInitialSchedule`: Event-driven (AtDock: false→true + missing ArrivingTerminal + has required fields). Called by `buildTripWithAllData`.
- `buildTripWithFinalSchedule`: Event-driven (key changed OR have departure info/LeftDock defined). Called by `buildTripWithAllData`. Reuses existing ScheduledTrip when key matches.

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTripWithAllData` (which internally calls `buildTripFromVesselLocation` + `buildTripWithInitialSchedule` + `buildTripWithFinalSchedule` + `buildTripWithArriveDockPredictions` + `buildTripWithLeaveDockPredictions`) + actuals via `updateAndExtractPredictions`.
2. Compare `tripsAreEqual(existingTrip, finalProposed)`.
3. If equal: no write.
4. If different: `activeUpsert = finalProposed` (batched via `upsertVesselTripsBatch`).

### tripsAreEqual

- Compares all fields from both `existing` and `proposed` trips.
- **Excludes** `TimeStamp` only — it changes every tick; we care about semantic equality.
- Uses `deepEqual` for nested objects (e.g. `ScheduledTrip`, prediction objects).
- Automatically includes new schema fields (compares all fields in both directions).

---

## ML Predictions

Predictions are **event-based**, not time-based:

- **Arrive-dock** (AtDockArriveNext, AtDockDepartNext): Run once when vessel first arrives at dock (`!existingTrip.AtDock && trip.AtDock`) and `isPredictionReadyTrip(trip)`. Handled by `buildTripWithArriveDockPredictions`.
- **Depart-dock** (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext): Run once when vessel physically departs (`existingTrip.LeftDock === undefined && trip.LeftDock !== undefined`). Handled by `buildTripWithLeaveDockPredictions`.

`isPredictionReadyTrip` requires: TripStart, DepartingTerminalAbbrev, ArrivingTerminalAbbrev, PrevTerminalAbbrev, InService, ScheduledDeparture, PrevScheduledDeparture, PrevLeftDock. First trips lack Prev* and do not run at-dock predictions.

**Actualization**:
- `AtDockDepartCurr`, `AtDockArriveNext`, `AtDockDepartNext`, `AtSeaArriveNext`, `AtSeaDepartNext`: Actualized by `updatePredictionsWithActuals` (called via `updateAndExtractPredictions`) when LeftDock/TripEnd set.
- `AtDockDepartNext`, `AtSeaDepartNext`: Also actualized by `setDepartNextActualsForMostRecentCompletedTrip` when the *next* trip leaves dock (backfill).

**Batch optimization**: When computing 2+ predictions for a vessel, `computePredictions` uses `loadModelsForPairBatch` for efficient model loading.

---

## Convex Function Calls

### Per 5-Second Tick

| Call Type | Function | When |
|-----------|----------|------|
| Query | `getActiveTrips` | Once at start |
| Query | `findScheduledTripForArrivalLookup` | Per vessel, when at dock + missing ArrivingTerminal |
| Query | `getScheduledTripByKey` | Per vessel, when Key derivable + shouldLookup (skipped if cached from arrival lookup) |
| Query | `getModelParametersForProduction` / `getModelParametersForProductionBatch` | Per vessel, when prediction runs (batch when 2+ specs) |
| Mutation | `completeAndStartNewTrip` | Per vessel, on trip boundary |
| Mutation | `upsertVesselTripsBatch` | Once if has active upserts |
| Mutation | `setDepartNextActualsForMostRecentCompletedTrip` | Per vessel, when didJustLeaveDock |
| Mutation | `bulkInsertPredictions` | Once if has completed prediction records |

**Call frequency**: Expensive lookups and predictions are event-gated. They run roughly once per 30–60 minutes per vessel (at trip start or when leaving dock), not every 5 seconds.

### Optimizations

- **ScheduledTrip reuse**: `buildTripWithFinalSchedule` reuses existing `ScheduledTrip` when key matches existing trip, avoiding redundant database lookups.
- **Batch model loading**: `computePredictions` uses `loadModelsForPairBatch` when computing 2+ predictions for a vessel.
- **Batch upserts**: Active trips are batched and upserted together in `upsertVesselTripsBatch`.
- **Event-gated predictions**: Expensive ML operations only run at trip boundaries (arrive-dock, depart-dock), not every tick.

---

## Mutations

| Mutation | Purpose |
|----------|---------|
| `upsertActiveTrip` | Upsert single active trip (used for new trips in `processNewTrips`) |
| `completeAndStartNewTrip` | Atomic: insert completed trip into `completedVesselTrips`, replace active trip with new trip (used for trip boundaries in `processCompletedTrips`) |
| `upsertVesselTripsBatch` | Batch upsert active trips (insert or replace); failures isolated per vessel (used for ongoing trips in `processCurrentTrips`) |
| `setDepartNextActualsForMostRecentCompletedTrip` | Patch most recent completed trip with depart-next actuals when current trip leaves dock (used in `processCurrentTrips` when `didJustLeaveDock`) |
| `bulkInsertPredictions` | Batch insert prediction records for completed predictions (used in both `processCompletedTrips` and `processCurrentTrips`) |

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/README_REFACTORING.md` — Historical refactoring analysis (design rationale, gotchas)
