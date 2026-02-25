# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. For regular updates, the pipeline always constructs the full intended `VesselTrip` state, deep-compares to existing, and writes only when different. Trip boundaries always produce writes.

**Five-function design**:
1. `buildTrip` — main orchestrator calling all build functions with event detection
2. `baseTripFromLocation` — base trip from raw location data (simple assignments); derives Key from raw data for schedule lookup
3. `appendInitialSchedule` — arrival terminal lookup when vessel arrives at dock (event-driven: AtDock false→true)
4. `appendFinalSchedule` — schedule lookup by Key when key changed (event-driven)
5. `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions when event-triggered (arrive-dock, depart-dock)

**Centralized event detection**: `detectTripEvents` in `eventDetection.ts` provides a single source of truth for all trip event detection logic.

**Naming convention**:
- `buildTrip` - Main orchestrator that creates complete trip from scratch
- `baseTrip*` - Base construction from raw location data
- `append*` - Enrich existing trip with schedule or prediction data
- Comments use "enrich" to describe the process of adding data

---

## Architecture

### Pipeline Overview

```
runUpdateVesselTrips (entry point)
    ├─> Load active trips (once)
    ├─> Categorize vessel/location tuples into two groups:
    │       completedTrips, currentTrips (using detectTripEvents)
    │       Events are computed once and passed through call chain
    └─> Delegate to processing functions (each handles own persistence):
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTrip (tripStart=true, events) → completeAndStartNewTrip
            │       → handlePredictionEvent (trip_complete) → PredictionService
            │       → handlePredictionEvent (arrive_dock) → PredictionService
            │       (internal: baseTripFromLocation → appendInitialSchedule
            │                 → appendFinalSchedule → appendArriveDockPredictions
            │                 → appendLeaveDockPredictions)
            └─> processCurrentTrips (ongoing trips, including first appearances)
                    buildTrip (tripStart=false for continuing, tripStart=true for first trip, events)
                    → tripsAreEqual → upsertVesselTripsBatch (if changed)
                    → handlePredictionEvent (leave_dock) → PredictionService
                    (internal: baseTripFromLocation → appendInitialSchedule
                              → appendFinalSchedule → appendArriveDockPredictions
                              → appendLeaveDockPredictions)
```

### File Structure

| File | Purpose |
|------|---------|
| `updateVesselTrips.ts` | Main orchestrator: categorizes vessels into completed/current, delegates to processing functions |
| `eventDetection.ts` | `detectTripEvents` — centralized event detection for all trip events |
| `buildCompletedTrip.ts` | `buildCompletedTrip` — builds completed trip with TripEnd, durations |
| `buildTrip.ts` | `buildTrip` — orchestrates all build functions (location, schedule, predictions) with provided events |
| `baseTripFromLocation.ts` | `baseTripFromLocation` — location-derived fields, handles first trip, trip boundary, and regular update |
| `appendPredictions.ts` | `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions for arrive-dock (AtDockArriveNext, AtDockDepartNext) and depart-dock (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext) events |
| `appendSchedule.ts` | `appendInitialSchedule`, `appendFinalSchedule` — event-driven schedule lookup by Key |
| `utils.ts` | `tripsAreEqual`, `deepEqual`, `compareTripFields` — equality checking utilities |

**External dependencies**:
- `convex/domain/ml/prediction/predictionService.ts` — Prediction lifecycle management (event handling, actualization, record insertion)
- `convex/domain/ml/prediction/vesselTripPredictions.ts` — `PREDICTION_SPECS`, `predictFromSpec`, `updatePredictionsWithActuals`
- `convex/domain/ml/prediction/predictTrip.ts` — `loadModelsForPairBatch`, `predictTripValue`
- `convex/functions/vesselTrips/mutations.ts` — `completeAndStartNewTrip`, `upsertVesselTripsBatch`, `setDepartNextActualsForMostRecentCompletedTrip`

---

## Event Types

All events are detected by `detectTripEvents(existingTrip, currLocation)`.

### 1. First Trip

**Condition**: `isFirstTrip = !existingTrip` (first appearance of a vessel).

**Behavior**: Handled by `processCurrentTrips` with `tripStart=true`. Calls `buildTrip(ctx, currLocation, undefined, true, events)` which:
- Uses `baseTripForStart` from `baseTripFromLocation` to create new trip with:
  - `TripStart` set to current timestamp
  - `Prev*` fields set to undefined (no previous trip)
  - Predictions cleared (undefined)
  - `ArrivingTerminalAbbrev` comes only from currLocation (not existingTrip)
- Internally calls `appendFinalSchedule` (if Key derivable) → `appendArriveDockPredictions` (if at dock and trip ready) → `appendLeaveDockPredictions` (if LeftDock defined)
- Compares via `tripsAreEqual` (always different for new trips) and writes via `upsertVesselTripsBatch`

### 2. Trip Boundary

**Condition**: `isCompletedTrip = existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev` (vessel arrived at a new terminal).

**Behavior**:
1. Complete current trip via `buildCompletedTrip`: set `TripEnd`, compute `AtSeaDuration`, `TotalDuration`.
2. Start new trip via `buildTrip(ctx, currLocation, existingTrip, true, events)` with `tripStart=true` for `Prev*` context: internally calls `baseTripFromLocation` → `appendInitialSchedule` (if at dock with missing ArrivingTerminal) → `appendFinalSchedule` (if key changed) → `appendArriveDockPredictions` (if just arrived at dock) → `appendLeaveDockPredictions` (if LeftDock defined).
3. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).
4. Insert prediction records from completed trip via `bulkInsertPredictions`.

### 3. Regular Update (Ongoing Trips)

**Condition**: `!isCompletedTrip` (same `DepartingTerminalAbbrev`, vessel still on same leg).

**Behavior**:
1. `buildTrip(ctx, currLocation, existingTrip, false, events)` with `tripStart=false` — orchestrates all enrichments with provided events:
   - Calls `appendInitialSchedule` when at dock with missing ArrivingTerminal
   - Calls `appendFinalSchedule` when key changed
   - Calls `appendArriveDockPredictions` when first arrive at dock
   - Calls `appendLeaveDockPredictions` when physically depart dock
2. When `didJustLeaveDock`: prediction actualization and record insertion handled by `handlePredictionEvent` in PredictionService.
3. `tripsAreEqual(existingTrip, finalProposed)` → write only if different.
4. When `didJustLeaveDock`: PredictionService backfills previous trip's depart-next actuals.

---

## Architecture: buildTrip

`buildTrip` is the key orchestrator that coordinates all enrichments with provided events:

```typescript
buildTrip(ctx, currLocation, existingTrip?, tripStart, events)
  ├─> baseTripFromLocation (base trip from raw data, using tripStart flag)
  ├─> Use provided events to drive enrichments:
  │   ├─> didJustArriveAtDock (from events.didJustArriveAtDock)
  │   ├─> didJustLeaveDock (from events.didJustLeaveDock)
  │   └─> keyChanged (from events.keyChanged)
  ├─> appendInitialSchedule (if didJustArriveAtDock && missing ArrivingTerminal)
  ├─> appendFinalSchedule (if keyChanged)
  ├─> appendArriveDockPredictions (if didJustArriveAtDock)
  └─> appendLeaveDockPredictions (if didJustLeaveDock)
```

**Benefits**:
- Single entry point for trip construction used by both `processCompletedTrips` (with `tripStart=true`) and `processCurrentTrips` (with `tripStart=false` for continuing, `tripStart=true` for first trips)
- Events computed once in `runUpdateVesselTrips` and passed through call chain, avoiding redundant computation
- Consistent application of all enrichments across trip boundaries and regular updates
- Clear separation of concerns: `baseTripFromLocation` for raw data, schedule functions for database lookups, prediction functions for ML

---

## Event Detection

Centralized in `eventDetection.ts`, `detectTripEvents()` returns:

| Event | Detection Logic | Triggers |
|-------|----------------|----------|
| `isFirstTrip` | `!existingTrip` | Vessel's first appearance |
| `isCompletedTrip` | `existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev` | Trip boundary (arrived at new terminal) |
| `didJustArriveAtDock` | `existingTrip && !existingTrip.AtDock && currLocation.AtDock` | Vessel just arrived at dock |
| `didJustLeaveDock` | `existingTrip?.LeftDock === undefined && (currLocation.LeftDock !== undefined \|\| (existingTrip.AtDock && !currLocation.AtDock))` | Vessel just departed dock |
| `keyChanged` | `existingTrip?.Key !== undefined && computedKey !== existingTrip.Key` | Trip schedule identifier changed |

**Benefits**:
- Single source of truth for all event detection
- Event detection logic not scattered across multiple files
- Easy to test and understand what events exist

---

## VesselTrip vs VesselLocation

**VesselLocation** is a point-in-time snapshot from REST/API feed: position, terminals, AtDock, Eta, TimeStamp, etc.

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
| **ArrivingTerminalAbbrev** | currLocation, appendInitialSchedule, or existingTrip | `currLocation` when truthy; else `appendInitialSchedule` result; else `existingTrip` (regular updates only; never old trip at boundary) |
| **Key** | Raw data | From `generateTripKey` in baseTripFromLocation; used for schedule lookup |
| **ScheduledTrip** | Schedule lookup | From `appendFinalSchedule` (RouteID/RouteAbbrev live on ScheduledTrip); reused if key matches existing trip |
| **SailingDay** | Raw data | From `getSailingDay(ScheduledDeparture)` in baseTripFromLocation |
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
| **AtDockDepartCurr** | ML | Run once when physically depart dock (appendLeaveDockPredictions) |
| **AtDockArriveNext, AtDockDepartNext** | ML | Run once when first arrive at dock with destination (appendArriveDockPredictions) |
| **AtSeaArriveNext, AtSeaDepartNext** | ML | Run once when physically depart dock (appendLeaveDockPredictions) |

---

## Invariants and Gotchas

### ArrivingTerminalAbbrev

- **At trip boundary**: Never use `existingTrip.ArrivingTerminalAbbrev` — the old trip's ArrivingTerminal equals the new trip's DepartingTerminal (wrong terminal).
- **Regular updates**: Fallback chain in `baseTripFromLocation`: `currLocation` → `existingTrip`. Can also be populated by `appendInitialSchedule` when vessel arrives at dock with missing ArrivingTerminal.

### Null-Overwrite Protection

`ScheduledDeparture`, `Eta`, `LeftDock`: Only update when currLocation provides truthy value. Prevents overwriting good data with null from REST glitches.

### LeftDock Special Case

When `AtDock` flips false and `LeftDock` is missing, use `currLocation.LeftDock ?? currLocation.TimeStamp` (infer from tick).

### Event-Driven Side Effects

`didJustLeaveDock` drives:
- Prediction actualization and record insertion via `handlePredictionEvent` in PredictionService
- Backfill of depart-next actuals onto previous trip (handled by PredictionService internally)

The PredictionService manages all prediction lifecycle:
- Actualization of `AtDockDepartCurr` and `AtSeaArriveNext`
- Extraction and insertion of `completedPredictionRecords` for bulk insert
- Backfill of previous trip's `AtDockDepartNext` and `AtSeaDepartNext` with actual departure time

Trip orchestration code now delegates all prediction-related operations to the PredictionService,
maintaining clear separation of concerns.

### SailingDay from Raw Data

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via `getSailingDay` in `baseTripFromLocation`, not from schedule lookup. Uses `ScheduledDeparture` only. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `appendInitialSchedule`: Event-driven (AtDock: false→true + missing ArrivingTerminal + has required fields). Called by `buildTrip`.
- `appendFinalSchedule`: Event-driven (key changed). Called by `buildTrip`. Reuses existing ScheduledTrip when key matches.

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTrip` (which internally calls `baseTripFromLocation` + `appendInitialSchedule` + `appendFinalSchedule` + `appendArriveDockPredictions` + `appendLeaveDockPredictions`, using provided events to drive enrichments).
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

- **Arrive-dock** (AtDockArriveNext, AtDockDepartNext): Run once when vessel first arrives at dock (`!existingTrip.AtDock && trip.AtDock`) and `isPredictionReadyTrip(trip)`. Handled by `appendArriveDockPredictions`.
- **Depart-dock** (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext): Run once when vessel physically departs (`existingTrip.LeftDock === undefined && trip.LeftDock !== undefined`). Handled by `appendLeaveDockPredictions`.

`isPredictionReadyTrip` requires: TripStart, DepartingTerminalAbbrev, ArrivingTerminalAbbrev, PrevTerminalAbbrev, InService, ScheduledDeparture, PrevScheduledDeparture, PrevLeftDock. First trips lack Prev* and do not run at-dock predictions.

**Actualization**:
- `AtDockDepartCurr`, `AtDockArriveNext`, `AtDockDepartNext`, `AtSeaArriveNext`, `AtSeaDepartNext`: Actualized by `updatePredictionsWithActuals` (called via PredictionService) when LeftDock/TripEnd set.
- `AtDockDepartNext`, `AtSeaDepartNext`: Also actualized by `setDepartNextActualsForMostRecentCompletedTrip` when the *next* trip leaves dock (backfill via PredictionService).

**Batch optimization**: When computing 2+ predictions for a vessel, `computePredictions` uses `loadModelsForPairBatch` for efficient model loading.

---

## Prediction Service Integration

The `PredictionService` manages the entire prediction lifecycle through an event-based API:

**Event Types**: The service accepts three lifecycle events:
- `trip_complete` - Called when a trip completes, actualizes at-sea predictions and inserts prediction records
- `arrive_dock` - Called when vessel arrives at dock, computes at-dock predictions for next leg
- `leave_dock` - Called when vessel leaves dock, actualizes current predictions and backfills previous trip's depart-next predictions

**Trip Orchestrator Delegation**:
- `processCompletedTrips()` calls `handlePredictionEvent()` with `trip_complete` event for completed trip and `arrive_dock` event for new trip
- `processCurrentTrips()` calls `handlePredictionEvent()` with `leave_dock` event when vessel departs dock

**Automatic Handling**:
- Predictions are computed when vessels arrive at dock (next leg) or depart dock (current trip)
- Predictions are automatically actualized with actual times when trips complete or vessels depart
- Prediction records are automatically extracted and inserted into database for completed predictions
- Previous trip's depart-next predictions are backfilled with actual departure time when current trip leaves dock

**Separation of Concerns**:
- Trip orchestrator (`updateVesselTrips.ts`) manages trip state and calls prediction service at appropriate event boundaries
- Prediction service (`convex/domain/ml/prediction/predictionService.ts`) handles all prediction lifecycle operations independently

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

- **ScheduledTrip reuse**: `appendFinalSchedule` reuses existing `ScheduledTrip` when key matches existing trip, avoiding redundant database lookups.
- **Batch model loading**: `computePredictions` uses `loadModelsForPairBatch` when computing 2+ predictions for a vessel.
- **Batch upserts**: Active trips are batched and upserted together in `upsertVesselTripsBatch`.
- **Event-gated predictions**: Expensive ML operations only run at trip boundaries (arrive-dock, depart-dock), not every tick.
- **Centralized event detection**: `detectTripEvents` consolidates all event detection logic in one place, avoiding scattered logic.

---

## Mutations

| Mutation | Purpose |
|----------|---------|
| `completeAndStartNewTrip` | Atomic: insert completed trip into `completedVesselTrips`, replace active trip with new trip (used for trip boundaries in `processCompletedTrips`) |
| `upsertVesselTripsBatch` | Batch upsert active trips (insert or replace); failures isolated per vessel (used for ongoing trips in `processCurrentTrips`) |
| `setDepartNextActualsForMostRecentCompletedTrip` | Patch most recent completed trip with depart-next actuals when current trip leaves dock (used in `processCurrentTrips` when `didJustLeaveDock`) |
| `bulkInsertPredictions` | Batch insert prediction records for completed predictions (used in both `processCompletedTrips` and `processCurrentTrips`) |

---

## Recent Improvements (2026-02-24)

1. **Renamed file**: `buildTripWithAllData.ts` → `buildTrip.ts` for consistency between file name and export
2. **Centralized event detection**: Created `eventDetection.ts` with `detectTripEvents()` function to consolidate all event detection logic
3. **Cleaned up console logs**: Removed debug `console.log` statements from `buildTrip.ts`
4. **Fixed documentation**: Removed outdated comment in `buildCompletedTrip.ts` about prediction actualization (handled separately by PredictionService)
5. **Simplified naming**: Implemented clearer naming convention:
   - `buildTrip` - Main orchestrator (creates complete trip)
   - `baseTrip*` - Base construction from raw data
   - `append*` - Enrich existing trip with data
   - Comments use "enrich" for clarity

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/REFACTOR_SUMMARY.md` — Historical refactoring analysis
- `ANALYSIS_VESSELTRIPS_UPDATES.md` — Detailed analysis of KISS principle improvements
