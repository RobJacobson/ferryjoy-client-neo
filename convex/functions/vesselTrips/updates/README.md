# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. For regular updates, the pipeline always constructs the full intended `VesselTrip` state, deep-compares to existing, and writes only when different. Trip boundaries always produce writes.

**Four-function design**:
1. `buildTrip` — main orchestrator calling all build functions with event detection
2. `buildTripFromVesselLocation` — base trip from raw location data (simple assignments); derives Key from raw data for schedule lookup
3. `buildTripWithInitialSchedule` — arrival terminal lookup when vessel arrives at dock (event-driven: AtDock false→true)
4. `buildTripWithFinalSchedule` — schedule lookup by Key when key changed (event-driven)
5. `buildTripWithArriveDockPredictions`, `buildTripWithLeaveDockPredictions` — ML predictions when event-triggered (arrive-dock, depart-dock)

---

## Architecture

### Pipeline Overview

```
runUpdateVesselTrips (entry point)
    ├─> Load active trips (once)
    ├─> Categorize vessel/location tuples into two groups:
    │       completedTrips, currentTrips
    └─> Delegate to processing functions (each handles own persistence):
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTrip (tripStart=true) → completeAndStartNewTrip
            │       → bulkInsertPredictions (completed records)
            │       (internal: buildTripFromVesselLocation → buildTripWithInitialSchedule
            │                 → buildTripWithFinalSchedule → buildTripWithArriveDockPredictions
            │                 → buildTripWithLeaveDockPredictions)
            └─> processCurrentTrips (ongoing trips, including first appearances)
                    buildTrip (tripStart=false for continuing, tripStart=true for first trip)
                    → tripsAreEqual → upsertVesselTripsBatch (if changed)
                    → backfillDepartNextActuals (when didJustLeaveDock)
                    → bulkInsertPredictions
                    (internal: buildTripFromVesselLocation → buildTripWithInitialSchedule
                              → buildTripWithFinalSchedule → buildTripWithArriveDockPredictions
                              → buildTripWithLeaveDockPredictions)
```

### File Structure

| File | Purpose |
|------|---------|
| `updateVesselTrips.ts` | Main orchestrator: categorizes vessels into completed/current, delegates to processing functions |
| `buildCompletedTrip.ts` | `buildCompletedTrip` — builds completed trip with TripEnd, durations, and actualized predictions |
| `buildTripFromVesselLocation.ts` | `buildTripFromVesselLocation` — location-derived fields, handles first trip, trip boundary, and regular update |
| `buildTripWithAllData.ts` | `buildTrip` — orchestrates all build functions (location, schedule, predictions) with event detection |
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

**Condition**: No existing active trip for `VesselAbbrev` (first appearance of a vessel).

**Behavior**: Handled by `processCurrentTrips` with `tripStart=true`. Calls `buildTrip(ctx, currLocation, undefined, true)` which:
- Uses `buildTripForStart` from `buildTripFromVesselLocation` to create new trip with:
  - `TripStart` set to current timestamp
  - `Prev*` fields set to undefined (no previous trip)
  - Predictions cleared (undefined)
  - `ArrivingTerminalAbbrev` comes only from currLocation (not existingTrip)
- Internally calls `buildTripWithFinalSchedule` (if Key derivable) → `buildTripWithArriveDockPredictions` (if at dock and trip ready) → `buildTripWithLeaveDockPredictions` (if LeftDock defined)
- Compares via `tripsAreEqual` (always different for new trips) and writes via `upsertVesselTripsBatch`

### 2. Trip Boundary

**Condition**: `DepartingTerminalAbbrev` changes (vessel arrived at a new terminal).

**Behavior**:
1. Complete current trip via `buildCompletedTrip`: set `TripEnd`, compute `AtSeaDuration`, `TotalDuration`, actualize predictions.
2. Start new trip via `buildTrip(ctx, currLocation, existingTrip, true)` with `tripStart=true` for `Prev*` context: internally calls `buildTripFromVesselLocation` → `buildTripWithInitialSchedule` (if at dock with missing ArrivingTerminal) → `buildTripWithFinalSchedule` (if key changed) → `buildTripWithArriveDockPredictions` (if just arrived at dock) → `buildTripWithLeaveDockPredictions` (if LeftDock defined).
3. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).
4. Insert prediction records from completed trip via `bulkInsertPredictions`.

### 3. Regular Update (Ongoing Trips)

**Condition**: Same `DepartingTerminalAbbrev` (vessel still on same leg).

**Behavior**:
1. `buildTrip(ctx, currLocation, existingTrip, false)` with `tripStart=false` — orchestrates all enrichments with event detection:
   - Calls `buildTripWithInitialSchedule` when at dock with missing ArrivingTerminal
   - Calls `buildTripWithFinalSchedule` when key changed
   - Calls `buildTripWithArriveDockPredictions` when first arrive at dock
   - Calls `buildTripWithLeaveDockPredictions` when physically depart dock
2. When `didJustLeaveDock`: call `updateAndExtractPredictions` to actualize and extract completed prediction records.
3. `tripsAreEqual(existingTrip, finalProposed)` → write only if different.
4. When `didJustLeaveDock`: call `backfillDepartNextActuals` to backfill previous trip's depart-next actuals, and insert extracted prediction records.

---

## Architecture: buildTrip

`buildTrip` is the key orchestrator that coordinates all enrichments with event detection:

```typescript
buildTrip(ctx, currLocation, existingTrip?, tripStart)
  ├─> buildTripFromVesselLocation (base trip from raw data, using tripStart flag)
  ├─> Detect events:
  │   ├─> didJustArriveAtDock (existingTrip && !existingTrip.AtDock && trip.AtDock)
  │   ├─> didJustLeaveDock (existingTrip?.LeftDock === undefined && trip.LeftDock !== undefined)
  │   └─> keyChanged (existingTrip?.Key !== undefined && trip.Key !== existingTrip.Key)
  ├─> buildTripWithInitialSchedule (if didJustArriveAtDock && missing ArrivingTerminal)
  ├─> buildTripWithFinalSchedule (if keyChanged)
  ├─> buildTripWithArriveDockPredictions (if didJustArriveAtDock)
  └─> buildTripWithLeaveDockPredictions (if didJustLeaveDock)
```

**Benefits**:
- Single entry point for trip construction used by both `processCompletedTrips` (with `tripStart=true`) and `processCurrentTrips` (with `tripStart=false` for continuing, `tripStart=true` for first trips)
- Event detection happens in one place, not spread across multiple functions
- Consistent application of all enrichments across trip boundaries and regular updates
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
| **PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock** | completedTrip (trip boundary) or undefined (first trip) | Set once at trip boundary from completed trip (via `tripStart=true`); undefined for first trips; not updated mid-trip |
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
- Backfill of depart-next actuals onto previous trip (`backfillDepartNextActuals` helper calls `setDepartNextActualsForMostRecentCompletedTrip`)
- Actualization of `AtDockDepartCurr` and `AtSeaArriveNext`
- Extraction of `completedPredictionRecords` for bulk insert

These remain conditional; build-then-compare does not eliminate event-driven side effects.

### SailingDay from Raw Data

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via `getSailingDay` in `buildTripFromVesselLocation`, not from schedule lookup. Uses `ScheduledDeparture` only. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `buildTripWithInitialSchedule`: Event-driven (AtDock: false→true + missing ArrivingTerminal + has required fields). Called by `buildTrip`.
- `buildTripWithFinalSchedule`: Event-driven (key changed). Called by `buildTrip`. Reuses existing ScheduledTrip when key matches.

### Internal Helper Functions

- `backfillDepartNextActuals`: Action helper in `updateVesselTrips.ts` that calls `setDepartNextActualsForMostRecentCompletedTrip` mutation when `didJustLeaveDock` occurs. Backfills previous trip's AtDockDepartNext and AtSeaDepartNext with actual departure time, then inserts prediction records.

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTrip` (which internally calls `buildTripFromVesselLocation` + `buildTripWithInitialSchedule` + `buildTripWithFinalSchedule` + `buildTripWithArriveDockPredictions` + `buildTripWithLeaveDockPredictions`) + actuals via `updateAndExtractPredictions`.
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
- `AtDockDepartNext`, `AtSeaDepartNext`: Also actualized by `setDepartNextActualsForMostRecentCompletedTrip` when the *next* trip leaves dock (backfill via `backfillDepartNextActuals`).

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
| `completeAndStartNewTrip` | Atomic: insert completed trip into `completedVesselTrips`, replace active trip with new trip (used for trip boundaries in `processCompletedTrips`) |
| `upsertVesselTripsBatch` | Batch upsert active trips (insert or replace); failures isolated per vessel (used for ongoing trips in `processCurrentTrips`) |
| `setDepartNextActualsForMostRecentCompletedTrip` | Patch most recent completed trip with depart-next actuals when current trip leaves dock (used in `processCurrentTrips` when `didJustLeaveDock`) |
| `bulkInsertPredictions` | Batch insert prediction records for completed predictions (used in both `processCompletedTrips` and `processCurrentTrips`) |

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/README_REFACTORING.md` — Historical refactoring analysis (design rationale, gotchas)
