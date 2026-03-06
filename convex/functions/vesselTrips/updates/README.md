# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. The pipeline always constructs the full intended `VesselTrip` state first, including same-trip prediction actualization when applicable, then persists that finalized object. Regular updates deep-compare to existing and write only when different. Trip boundaries always produce writes.

**Five-function design**:
1. `buildTrip` — main orchestrator calling all build functions with event detection and finalizing same-trip prediction actuals before persistence
2. `baseTripFromLocation` — base trip from raw location data (simple assignments); preserves durable fields across feed gaps and derives Key for schedule lookup
3. `appendInitialSchedule` — arrival terminal lookup when vessel arrives at dock (event-driven: AtDock false→true)
4. `appendFinalSchedule` — schedule lookup by Key when the computed key becomes newly available or changes (event-driven)
5. `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions with event-driven and time-based fallback (at-dock: AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext; at-sea: AtSeaArriveNext, AtSeaDepartNext)

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
    └─> Delegate to processing functions (each handles own persistence
            with per-vessel error isolation):
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTrip (tripStart=true, events) → completeAndStartNewTrip
            │       → handlePredictionEvent (trip_complete) → PredictionService
            │       (internal: baseTripFromLocation → appendInitialSchedule
            │                 → appendFinalSchedule → appendArriveDockPredictions
            │                 → appendLeaveDockPredictions
            │                 → actualizePredictionsOnTripComplete / OnLeaveDock)
            └─> processCurrentTrips (ongoing trips, including first appearances)
                    buildTrip (tripStart=false for continuing and first appearances, events)
                    → tripsAreEqual → upsertVesselTripsBatch (if changed)
                    → handlePredictionEvent (leave_dock) → PredictionService
                    (internal: baseTripFromLocation → appendInitialSchedule
                              → appendFinalSchedule → appendArriveDockPredictions
                              → appendLeaveDockPredictions
                              → actualizePredictionsOnLeaveDock)
```

### File Structure

| File | Purpose |
|------|---------|
| `updateVesselTrips.ts` | Main orchestrator: categorizes vessels into completed/current, delegates to processing functions |
| `eventDetection.ts` | `detectTripEvents` — centralized event detection for all trip events |
| `buildCompletedTrip.ts` | `buildCompletedTrip` — builds completed trip with TripEnd, durations, and same-trip actualization before persistence |
| `buildTrip.ts` | `buildTrip` — orchestrates all build functions (location, schedule, predictions) with provided events, then finalizes leave-dock actuals before persistence |
| `baseTripFromLocation.ts` | `baseTripFromLocation` — location-derived fields, handles first trip, trip boundary, regular updates, and carry-forward protection for durable fields |
| `appendPredictions.ts` | `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions for at-dock (AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext) and at-sea (AtSeaArriveNext, AtSeaDepartNext) events |
| `appendSchedule.ts` | `appendInitialSchedule`, `appendFinalSchedule` — event-driven schedule lookup by Key |
| `utils.ts` | `tripsAreEqual`, `deepEqual`, `compareTripFields` — equality checking utilities |

**External dependencies**:
- `convex/domain/ml/prediction/predictionService.ts` — Prediction side effects after persistence (`trip_complete`, `leave_dock` record insertion and backfill)
- `convex/domain/ml/prediction/vesselTripPredictions.ts` — `PREDICTION_SPECS`, `predictFromSpec`, `actualizePredictionsOnTripComplete`, `actualizePredictionsOnLeaveDock`
- `convex/domain/ml/prediction/predictTrip.ts` — `loadModelsForPairBatch`, `predictTripValue`
- `convex/functions/vesselTrips/mutations.ts` — `completeAndStartNewTrip`, `upsertVesselTripsBatch`, `setDepartNextActualsForMostRecentCompletedTrip`

---

## Event Types

All events are detected by `detectTripEvents(existingTrip, currLocation)`.

### 1. First Trip

**Condition**: `isFirstTrip = !existingTrip` (first appearance of a vessel).

**Behavior**: Handled by `processCurrentTrips`. Calls `buildTrip(ctx, currLocation, undefined, false, events)` which:
- Uses the continuing path in `baseTripFromLocation` with no `existingTrip`, producing a first-seen trip with no carried-forward context
- Internally calls `appendFinalSchedule` when a key is derivable, `appendArriveDockPredictions` when at dock and prediction-ready, and `appendLeaveDockPredictions` when at sea and prediction-ready
- Compares via `tripsAreEqual` (always different for new trips) and writes via `upsertVesselTripsBatch`

### 2. Trip Boundary

**Condition**: `isCompletedTrip = existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev` (vessel arrived at a new terminal).

**Behavior**:
1. Complete current trip via `buildCompletedTrip`: set `TripEnd`, compute `AtSeaDuration`, `TotalDuration`, and actualize same-trip at-sea predictions before persistence.
2. Start new trip via `buildTrip(ctx, currLocation, existingTrip, true, events)` with `tripStart=true` for `Prev*` context: internally calls `baseTripFromLocation` → `appendInitialSchedule` (if at dock with missing ArrivingTerminal) → `appendFinalSchedule` (if key is newly available or changed) → `appendArriveDockPredictions` (if at dock) → `appendLeaveDockPredictions` (if at sea).
3. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).
4. Insert completed prediction records from the already-finalized completed trip via PredictionService.

### 3. Regular Update (Ongoing Trips)

**Condition**: `!isCompletedTrip` (same `DepartingTerminalAbbrev`, vessel still on same leg).

**Behavior**:
1. `buildTrip(ctx, currLocation, existingTrip, false, events)` with `tripStart=false` — orchestrates all enrichments with provided events:
   - Calls `appendInitialSchedule` when at dock with missing ArrivingTerminal
   - Calls `appendFinalSchedule` when a key becomes newly available or changes
   - Calls `appendArriveDockPredictions` when first arrive at dock
   - Calls `appendLeaveDockPredictions` when physically depart dock
   - Applies `actualizePredictionsOnLeaveDock` before persistence when `didJustLeaveDock`
2. When `didJustLeaveDock`: PredictionService inserts completed prediction records from the finalized trip and backfills previous trip depart-next actuals.
3. `tripsAreEqual(existingTrip, finalProposed)` → write only if different.
4. Per-vessel failures are logged and do not abort processing for other vessels.

---

## Architecture: buildTrip

`buildTrip` is the key orchestrator that coordinates all enrichments with provided events and trip state:

```typescript
buildTrip(ctx, currLocation, existingTrip?, tripStart, events)
  ├─> baseTripFromLocation (base trip from raw data, using tripStart flag)
  ├─> Use provided events and trip state to drive enrichments:
  │   ├─> didJustArriveAtDock (from events.didJustArriveAtDock)
  │   ├─> didJustLeaveDock (from events.didJustLeaveDock)
  │   └─> keyChanged (from events.keyChanged)
  │   ├─> Time-based fallback (seconds < 5 check)
  ├─> appendInitialSchedule (if didJustArriveAtDock && missing ArrivingTerminal)
  ├─> appendFinalSchedule (if keyChanged)
  ├─> appendArriveDockPredictions (if at dock && (didJustArriveAtDock || time-based fallback))
  ├─> appendLeaveDockPredictions (if at sea && (didJustLeaveDock || time-based fallback))
  └─> actualizePredictionsOnLeaveDock (if didJustLeaveDock)
```

**Benefits**:
- Single entry point for trip construction used by both `processCompletedTrips` (with `tripStart=true`) and `processCurrentTrips` (with `tripStart=false` for continuing, `tripStart=true` for first trips)
- Events computed once in `runUpdateVesselTrips` and passed through call chain, avoiding redundant computation
- Consistent application of all enrichments across trip boundaries and regular updates
- Clear separation of concerns: `baseTripFromLocation` for raw data, schedule functions for database lookups, prediction functions for ML
- Time-based fallback provides resilience against missed events or prediction generation failures

---

## Event Detection

Centralized in `eventDetection.ts`, `detectTripEvents()` returns:

| Event | Detection Logic | Triggers |
|-------|----------------|----------|
| `isFirstTrip` | `!existingTrip` | Vessel's first appearance |
| `isCompletedTrip` | `existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev` | Trip boundary (arrived at new terminal) |
| `didJustArriveAtDock` | `existingTrip && !existingTrip.AtDock && currLocation.AtDock` | Vessel just arrived at dock |
| `didJustLeaveDock` | `existingTrip?.LeftDock === undefined && (currLocation.LeftDock !== undefined \|\| (existingTrip.AtDock && !currLocation.AtDock))` | Vessel just departed dock |
| `keyChanged` | `computedKey !== undefined && existingTrip?.Key !== computedKey` | Trip schedule identifier became available or changed |

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
| **SailingDay** | Raw data | From `getSailingDay(ScheduledDeparture)` in baseTripFromLocation; uses carried-forward `ScheduledDeparture` when current feed omits it |
| **PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock** | completedTrip (trip boundary) or undefined (first trip) | Set once at trip boundary from completed trip (via `tripStart=true`); undefined for first trips; not updated mid-trip |
| **TripStart** | Inferred at boundary | `currLocation.TimeStamp` when vessel arrives at dock; carried forward |
| **AtDock** | currLocation | Direct copy every tick |
| **AtDockDuration** | Computed | `LeftDock - TripStart` (minutes); only when LeftDock set |
| **ScheduledDeparture** | currLocation or existingTrip | `currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture` (null-overwrite protection) |
| **LeftDock** | currLocation, existingTrip, or inferred | `currLocation.LeftDock ?? existingTrip.LeftDock ?? (justLeftDock ? currLocation.TimeStamp : undefined)` |
| **TripDelay** | Computed | `LeftDock - ScheduledDeparture` (minutes) |
| **Eta** | currLocation or existingTrip | `currLocation.Eta ?? existingTrip.Eta` (null-overwrite protection) |
| **TripEnd** | Boundary only | `currLocation.TimeStamp` when completing trip |
| **AtSeaDuration** | Computed | `TripEnd - LeftDock`; only on completed trip |
| **TotalDuration** | Computed | `TripEnd - TripStart`; only on completed trip |
| **InService, TimeStamp** | currLocation | Direct copy every tick |
| **AtDockDepartCurr** | ML | Run once when at dock (arrive at dock or time-based fallback if missing) (appendArriveDockPredictions) |
| **AtDockArriveNext, AtDockDepartNext** | ML | Run once when at dock (arrive at dock or time-based fallback if missing) (appendArriveDockPredictions) |
| **AtSeaArriveNext, AtSeaDepartNext** | ML | Run once when at sea (depart dock or time-based fallback if missing) (appendLeaveDockPredictions) |

---

## Invariants and Gotchas

### ArrivingTerminalAbbrev

- **At trip boundary**: Never use `existingTrip.ArrivingTerminalAbbrev` — the old trip's ArrivingTerminal equals the new trip's DepartingTerminal (wrong terminal).
- **Regular updates**: Fallback chain in `baseTripFromLocation`: `currLocation` → `existingTrip`. Can also be populated by `appendInitialSchedule` when vessel arrives at dock with missing ArrivingTerminal.

### Null-Overwrite Protection

`ScheduledDeparture`, `Eta`, `LeftDock`: Preserve the existing trip value when the current feed omits it. This prevents overwriting good data with null/undefined from REST glitches.

### LeftDock Special Case

When `AtDock` flips false and `LeftDock` is missing, use `currLocation.LeftDock ?? currLocation.TimeStamp` (infer from tick).

### Event-Driven Side Effects

`didJustLeaveDock` drives:
- Same-trip actualization in `buildTrip()` before persistence
- Prediction record insertion via `handlePredictionEvent` in PredictionService
- Backfill of depart-next actuals onto previous trip (handled by PredictionService internally)

The PredictionService now manages only post-persist prediction side effects:
- Extraction and insertion of `completedPredictionRecords` for bulk insert
- Backfill of previous trip's `AtDockDepartNext` and `AtSeaDepartNext` with actual departure time

Trip orchestration code builds the fully-correct trip object first, then delegates post-persist prediction side effects to the PredictionService.

### SailingDay from Raw Data

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via `getSailingDay` in `baseTripFromLocation`, not from schedule lookup. Uses `ScheduledDeparture` only. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `appendInitialSchedule`: Event-driven (AtDock: false→true + missing ArrivingTerminal + has required fields). Called by `buildTrip`.
- `appendFinalSchedule`: Event-driven (key changed). Called by `buildTrip`. Reuses existing ScheduledTrip when key matches.

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTrip` (which internally calls `baseTripFromLocation` + `appendInitialSchedule` + `appendFinalSchedule` + `appendArriveDockPredictions` + `appendLeaveDockPredictions`, using provided events to drive enrichments).
2. Finalize same-trip actuals in the builder when applicable.
3. Compare `tripsAreEqual(existingTrip, finalProposed)`.
4. If equal: no write.
5. If different: `activeUpsert = finalProposed` (batched via `upsertVesselTripsBatch`).

### tripsAreEqual

- Compares all fields from both `existing` and `proposed` trips.
- **Excludes** `TimeStamp` only — it changes every tick; we care about semantic equality.
- Uses `deepEqual` for nested objects (e.g. `ScheduledTrip`, prediction objects).
- Automatically includes new schema fields (compares all fields in both directions).

---

## ML Predictions

Predictions use a **hybrid event and time-based approach**:

**At-Dock Predictions** (AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext):
- **Event-driven**: Run once when vessel first arrives at dock (`!existingTrip.AtDock && trip.AtDock`)
- **Time-based fallback**: Check once per minute (first 5 seconds of each minute) if predictions are still undefined
- Handled by `appendArriveDockPredictions`
- Only run when `trip.AtDock && !trip.LeftDock` (vessel at dock)

**At-Sea Predictions** (AtSeaArriveNext, AtSeaDepartNext):
- **Event-driven**: Run once when vessel physically departs (`existingTrip.LeftDock === undefined && trip.LeftDock !== undefined`)
- **Time-based fallback**: Check once per minute (first 5 seconds of each minute) if predictions are still undefined
- Handled by `appendLeaveDockPredictions`
- Only run when `!trip.AtDock && trip.LeftDock` (vessel at sea)

`isPredictionReadyTrip` requires: TripStart, DepartingTerminalAbbrev, ArrivingTerminalAbbrev, PrevTerminalAbbrev, InService, ScheduledDeparture, PrevScheduledDeparture, PrevLeftDock. First trips lack Prev* and do not run predictions.

**Actualization**:
- `AtDockDepartCurr`: Actualized in `buildTrip()` via `actualizePredictionsOnLeaveDock` before persistence.
- `AtSeaArriveNext`: Actualized in `buildCompletedTrip()` via `actualizePredictionsOnTripComplete` before persistence.
- `AtDockDepartNext`, `AtSeaDepartNext`: Also actualized by `setDepartNextActualsForMostRecentCompletedTrip` when the *next* trip leaves dock (backfill via PredictionService).

**Batch optimization**: When computing 2+ predictions for a vessel, `computePredictions` uses `loadModelsForPairBatch` for efficient model loading.

**Time-based fallback**: Once per minute (throttled by `seconds < 5`), the system checks for and generates any missing predictions that were not created during event-driven triggers. This provides resilience against missed events or prediction generation failures. Predictions that already exist are skipped (no redundant computation).

---

## Prediction Service Integration

The `PredictionService` manages post-persist prediction side effects through an event-based API:

**Event Types**: The service accepts two lifecycle events:
- `trip_complete` - Called when a trip completes to insert completed prediction records from the already-finalized completed trip
- `leave_dock` - Called when vessel leaves dock to insert completed prediction records from the already-finalized active trip and backfill previous trip's depart-next predictions

**Trip Orchestrator Delegation**:
- `processCompletedTrips()` calls `handlePredictionEvent()` with `trip_complete` for the finalized completed trip
- `processCurrentTrips()` calls `handlePredictionEvent()` with `leave_dock` event when vessel departs dock

**Automatic Handling**:
- Predictions are computed in the trip-building pipeline before persistence
- Same-trip actuals are written onto trip objects before persistence
- Prediction records are automatically extracted and inserted into database for completed predictions
- Previous trip's depart-next predictions are backfilled with actual departure time when current trip leaves dock

**Separation of Concerns**:
- Trip orchestrator (`updateVesselTrips.ts`) manages trip state and calls prediction service at appropriate event boundaries
- Prediction service (`convex/domain/ml/prediction/predictionService.ts`) handles post-persist prediction side effects independently

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
- **Time-based fallback**: Once per minute (throttled by `seconds < 5`), system checks for and generates any missing predictions that were not created during event-driven triggers. Predictions that already exist are skipped (no redundant computation).
- **Centralized event detection**: `detectTripEvents` consolidates all event detection logic in one place, avoiding scattered logic.
- **Per-vessel isolation**: Errors while processing one vessel are logged and do not abort the rest of the batch.
- **Feed-glitch resilience**: `baseTripFromLocation` carries forward durable values such as `ScheduledDeparture` and `LeftDock` when the current feed omits them.

---

## Mutations

| Mutation | Purpose |
|----------|---------|
| `completeAndStartNewTrip` | Atomic: insert completed trip into `completedVesselTrips`, replace active trip with new trip (used for trip boundaries in `processCompletedTrips`) |
| `upsertVesselTripsBatch` | Batch upsert active trips (insert or replace); failures isolated per vessel (used for ongoing trips in `processCurrentTrips`) |
| `setDepartNextActualsForMostRecentCompletedTrip` | Patch most recent completed trip with depart-next actuals when current trip leaves dock (used in `processCurrentTrips` when `didJustLeaveDock`) |
| `bulkInsertPredictions` | Batch insert prediction records for completed predictions (used in both `processCompletedTrips` and `processCurrentTrips`) |

---

## Recent Improvements

1. **Renamed file**: `buildTripWithAllData.ts` → `buildTrip.ts` for consistency between file name and export
2. **Centralized event detection**: Created `eventDetection.ts` with `detectTripEvents()` function to consolidate all event detection logic
3. **Cleaned up console logs**: Removed debug `console.log` statements from `buildTrip.ts`
4. **Fixed documentation**: Removed outdated comment in `buildCompletedTrip.ts` about prediction actualization (handled separately by PredictionService)
5. **Simplified naming**: Implemented clearer naming convention:
   - `buildTrip` - Main orchestrator (creates complete trip)
   - `baseTrip*` - Base construction from raw data
   - `append*` - Enrich existing trip with data
   - Comments use "enrich" for clarity
6. **Finalize before persist**: `buildTrip()` and `buildCompletedTrip()` now apply same-trip prediction actuals before persistence.
7. **PredictionService simplification**: PredictionService now handles post-persist side effects only (`trip_complete`, `leave_dock`).
8. **Per-vessel isolation**: Errors for one vessel no longer abort the full batch.
9. **Carry-forward protection**: Continuing trips preserve durable fields such as `ScheduledDeparture` and `LeftDock` across feed glitches.
10. **Key availability detection**: Schedule enrichment now runs when a key becomes newly available, not only when an existing key changes.

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/REFACTOR_SUMMARY.md` — Historical refactoring analysis
- `ANALYSIS_VESSELTRIPS_UPDATES.md` — Detailed analysis of KISS principle improvements
