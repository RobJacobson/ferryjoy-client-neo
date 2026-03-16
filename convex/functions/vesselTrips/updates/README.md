# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. The pipeline always constructs the full intended `VesselTrip` state first, including same-trip prediction actualization when applicable, then persists that finalized object. Regular updates deep-compare to existing and write only when different. Trip boundaries always produce writes, and `leave_dock` side effects run only after the active trip upsert succeeds.

**Current design**:
1. `buildTrip` — main orchestrator calling all build functions with event detection and finalizing same-trip prediction actuals before persistence
2. `baseTripFromLocation` — base trip from raw location data; preserves active-trip identity through the dock gap and supports pre-trip records with no `TripStart`
3. `appendFinalSchedule` — deterministic schedule lookup by Key once the feed exposes `ScheduledDeparture` and `ArrivingTerminalAbbrev`
4. `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions gated on a real trip start (at-dock: AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext; at-sea: AtSeaArriveNext, AtSeaDepartNext)

**Centralized event detection**: `detectTripEvents` in `eventDetection.ts` computes the event bundle once per vessel update, and `getDockDepartureState` provides the shared `LeftDock` handling used by both event detection and trip field derivation.

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
    ├─> Build TripTransition objects:
    │       { currLocation, existingTrip, events }
    │       Events are computed once and passed through call chain
    ├─> Categorize transitions into two groups:
    │       completedTrips, currentTrips
    ├─> Compute shouldRunPredictionFallback once for the current tick
    └─> Delegate to processing functions (each handles own persistence
            with per-vessel error isolation):
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTrip (tripStart=true, events, shouldRunPredictionFallback)
            │       → handlePredictionEvent (trip_complete) → PredictionService
            │       (internal: baseTripFromLocation → appendFinalSchedule
            │                 → appendArriveDockPredictions
            │                 → appendLeaveDockPredictions
            │                 → actualizePredictionsOnTripComplete / OnLeaveDock)
            └─> processCurrentTrips (ongoing trips, including first appearances)
                    buildTrip (tripStart=events.shouldStartTrip for pre-trips/first appearances, events, shouldRunPredictionFallback)
                    → tripsAreEqual → upsertVesselTripsBatch (if changed)
                    → handlePredictionEvent (leave_dock, post-persist only) → PredictionService
                    (internal: baseTripFromLocation → appendFinalSchedule
                              → appendArriveDockPredictions
                              → appendLeaveDockPredictions
                              → actualizePredictionsOnLeaveDock)
```

### File Structure

| File | Purpose |
|------|---------|
| `updateVesselTrips.ts` | Main orchestrator: builds `TripTransition` objects, categorizes them into completed/current, delegates to processing functions |
| `eventDetection.ts` | `detectTripEvents`, `getDockDepartureState` — centralized event detection and shared dock-departure inference |
| `buildCompletedTrip.ts` | `buildCompletedTrip` — builds completed trip with TripEnd, durations, same-trip actualization, and a guard against impossible arrival timestamps before persistence |
| `buildTrip.ts` | `buildTrip` — orchestrates all build functions (location, schedule, predictions) with provided events, then finalizes leave-dock actuals before persistence |
| `baseTripFromLocation.ts` | `baseTripFromLocation` — location-derived fields, handles first trip, trip boundary, regular updates, and carry-forward protection for durable fields |
| `appendPredictions.ts` | `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions for at-dock (AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext) and at-sea (AtSeaArriveNext, AtSeaDepartNext) events |
| `appendSchedule.ts` | `appendFinalSchedule` — deterministic schedule lookup by Key |
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

**Behavior**: Handled by `processCurrentTrips`. First appearances now split into two cases:
- If the feed is not yet start-ready, `buildTrip(..., tripStart=false, ...)` creates a minimal pre-trip/ghost record with no `TripStart`
- If the feed already has `ScheduledDeparture` and `ArrivingTerminalAbbrev`, `buildTrip(..., tripStart=true, ...)` creates a start-ready trip record, but `TripStart` remains undefined unless the system actually observed the start transition
- Compares via `tripsAreEqual` (always different for new trips) and writes via `upsertVesselTripsBatch`

### 2. Trip Boundary

**Condition**: `isCompletedTrip = hasTripEvidence && isTripStartReady && existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev`, where `hasTripEvidence` means the old trip has `LeftDock` or `ArriveDest`.

**Behavior**:
1. Keep the old trip active through the dock gap, recording `ArriveDest` when the feed indicates the vessel reached the terminal.
2. Complete the current trip only when the next trip is start-ready via `buildCompletedTrip`: set `TripEnd`, compute durations from the real arrival time (`ArriveDest` when available), and actualize same-trip at-sea predictions before persistence.
3. Start the replacement trip via `buildTrip(ctx, currLocation, tripToComplete, true, events, shouldRunPredictionFallback)` with `tripStart=true` for `Prev*` context and deterministic schedule lookup by Key.
4. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).
4. Insert completed prediction records from the already-finalized completed trip via PredictionService.

### 3. Regular Update (Ongoing Trips)

**Condition**: `!isCompletedTrip`.

**Behavior**:
1. `buildTrip(ctx, currLocation, existingTrip, events.shouldStartTrip, events, shouldRunPredictionFallback)` now handles:
   - continuing started trips
   - dock-hold updates for the previous trip while waiting on next-trip fields
   - pre-trip/ghost updates when a vessel has no real start yet
   - deterministic schedule lookup when a key becomes newly available or a trip starts
   - at-dock predictions only after a real trip start
   - Calls `appendLeaveDockPredictions` when physically depart dock
   - Applies `actualizePredictionsOnLeaveDock` before persistence when `didJustLeaveDock`
2. When `didJustLeaveDock`: `processCurrentTrips()` queues a post-persist side effect. After `upsertVesselTripsBatch` succeeds for that vessel, PredictionService inserts completed prediction records from the finalized trip and backfills previous trip depart-next actuals.
3. `tripsAreEqual(existingTrip, finalProposed)` → write only if different.
4. Per-vessel failures are logged and do not abort processing for other vessels.

---

## Architecture: buildTrip

`buildTrip` is the key orchestrator that coordinates all enrichments with provided events, trip state, and an explicit fallback flag:

```typescript
buildTrip(
  ctx,
  currLocation,
  existingTrip?,
  tripStart,
  events,
  shouldRunPredictionFallback
)
  ├─> baseTripFromLocation (base trip from raw data, using tripStart flag)
  ├─> Use provided events and trip state to drive enrichments:
  │   ├─> didJustArriveAtDock (from events.didJustArriveAtDock)
  │   ├─> didJustLeaveDock (from events.didJustLeaveDock)
  │   └─> keyChanged (from events.keyChanged)
  │   └─> shouldRunPredictionFallback (computed once by runUpdateVesselTrips)
  ├─> stamp ArriveDest (when destination terminal changes)
  ├─> appendFinalSchedule (if tripStart or keyChanged)
  ├─> appendArriveDockPredictions (if at dock && TripStart exists && (tripStart || time-based fallback))
  ├─> appendLeaveDockPredictions (if at sea && (didJustLeaveDock || time-based fallback))
  └─> actualizePredictionsOnLeaveDock (if didJustLeaveDock)
```

**Benefits**:
- Single entry point for trip construction used by both `processCompletedTrips` and `processCurrentTrips`, with `tripStart` explicitly marking when a real trip begins
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
| `isTripStartReady` | `currLocation.ScheduledDeparture && currLocation.ArrivingTerminalAbbrev` | Feed now exposes real next-trip data |
| `shouldStartTrip` | `existingTrip && !existingTrip.TripStart && !existingTrip.ArrivingTerminalAbbrev && currLocation.ArrivingTerminalAbbrev && currLocation.AtDock` | Promote an observed pre-trip into a real trip |
| `isCompletedTrip` | `hasTripEvidence && isTripStartReady && existingTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev` | Delayed trip boundary once the previous trip has real evidence (`LeftDock` or `ArriveDest`) |
| `didJustArriveAtDock` | `existingTrip.LeftDock && !existingTrip.ArriveDest && currLocation.AtDock && currLocation.DepartingTerminalAbbrev !== existingTrip.DepartingTerminalAbbrev` | Vessel physically reached a new dock after a real sailing leg, even if the feed's expected-destination field is stale |
| `didJustLeaveDock` | `existingTrip?.LeftDock === undefined && currLocation.LeftDock !== undefined` | Vessel just departed dock |
| `keyChanged` | `computedKey !== undefined && existingTrip?.Key !== computedKey` | Trip schedule identifier became available or changed |

**Benefits**:
- Single source of truth for all event detection
- Shared dock-departure inference via `getDockDepartureState`
- Easy to test and understand what events exist

---

## VesselTrip vs VesselLocation

**VesselLocation** is a point-in-time snapshot from REST/API feed: position, terminals, AtDock, Eta, TimeStamp, etc.

**VesselTrip** maintains history across many updates. It adds:
- `ArriveDest` — actual destination-arrival time when the vessel reaches the terminal
- `TripStart` — observed trip-start time, not a synthetic proxy; may stay undefined when the system did not observe the start transition
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
| **ArrivingTerminalAbbrev** | currLocation or existingTrip | `currLocation` when truthy; else `existingTrip` (regular updates only; never old trip at boundary) |
| **Key** | Raw data | From `generateTripKey` in baseTripFromLocation; used for schedule lookup |
| **SailingDay** | Raw data | From `getSailingDay(ScheduledDeparture)` in baseTripFromLocation; uses carried-forward `ScheduledDeparture` when current feed omits it |
| **PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock** | completedTrip (trip boundary) or undefined (first trip) | Set once at trip boundary from completed trip (via `tripStart=true`); undefined for first trips; not updated mid-trip |
| **ArriveDest** | Arrival event | `currLocation.TimeStamp` only when the vessel has already left dock and is now docked at the destination terminal; carried until completion |
| **TripStart** | Observed start event | Set only when the system observed the start transition. At delayed boundaries this is the previous trip's `ArriveDest`; for pre-trips it can be the tick where `ArrivingTerminalAbbrev` first becomes defined while the vessel is at dock. |
| **AtDock** | currLocation | Direct copy every tick |
| **AtDockDuration** | Computed | `LeftDock - ArriveDest` when available, else `LeftDock - TripStart` (minutes); only when LeftDock set |
| **ScheduledDeparture** | currLocation or existingTrip | `currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture` (null-overwrite protection) |
| **LeftDock** | currLocation or existingTrip | Derived by `getDockDepartureState`: `currLocation.LeftDock ?? existingTrip.LeftDock` |
| **TripDelay** | Computed | `LeftDock - ScheduledDeparture` (minutes) |
| **Eta** | currLocation or existingTrip | `currLocation.Eta ?? existingTrip.Eta` (null-overwrite protection) |
| **NextScheduledDeparture** | Schedule lookup or existingTrip | Set by appendFinalSchedule; carried forward in baseTripForContinuing when the lookup doesn't run (no overwrite with undefined) |
| **TripEnd** | Boundary only | `currLocation.TimeStamp` when completing trip |
| **AtSeaDuration** | Computed | `ArriveDest - LeftDock` when available and chronologically valid, else `TripEnd - LeftDock`; only on completed trip |
| **TotalDuration** | Computed | `ArriveDest - TripStart` when available and chronologically valid, else `TripEnd - TripStart`; only on completed trip |
| **InService, TimeStamp** | currLocation | Direct copy every tick |
| **AtDockDepartCurr** | ML | Run once when at dock (arrive at dock or time-based fallback if missing) (appendArriveDockPredictions) |
| **AtDockArriveNext, AtDockDepartNext** | ML | Run once when at dock (arrive at dock or time-based fallback if missing) (appendArriveDockPredictions) |
| **AtSeaArriveNext, AtSeaDepartNext** | ML | Run once when at sea (depart dock or time-based fallback if missing) (appendLeaveDockPredictions) |

---

## Invariants and Gotchas

### ArrivingTerminalAbbrev

- **At trip boundary**: Never use `existingTrip.ArrivingTerminalAbbrev` — the old trip's ArrivingTerminal equals the new trip's DepartingTerminal (wrong terminal).
- **Regular updates**: Fallback chain in `baseTripFromLocation`: `currLocation` → `existingTrip`.

### Null-Overwrite Protection

`ScheduledDeparture`, `Eta`, `LeftDock`: Preserve the existing trip value when the current feed omits it. This prevents overwriting good data with null/undefined from REST glitches.

`NextScheduledDeparture`: Set by `appendFinalSchedule`. Carried forward from `existingTrip` in `baseTripForContinuing` when the lookup does not run. Prevents overwriting with undefined on regular updates.

### LeftDock Source of Truth

Departure is recorded only when the feed provides `LeftDock`. `AtDock` may disagree transiently, but it does not create or clear `LeftDock`.

### ArriveDest Guardrails

- Do not stamp `ArriveDest` from destination-field churn alone. A real arrival requires evidence that the trip already departed and the vessel is now docked at a new terminal.
- On completion, if a stored `ArriveDest` is earlier than `LeftDock` or `TripStart`, treat it as invalid feed state and fall back to `TripEnd` for persisted arrival/duration fields.

### Event-Driven Side Effects

`didJustLeaveDock` drives:
- Same-trip actualization in `buildTrip()` before persistence
- Prediction record insertion via `handlePredictionEvent` in PredictionService after a successful active-trip write
- Backfill of depart-next actuals onto previous trip (handled by PredictionService internally)

The PredictionService now manages only post-persist prediction side effects:
- Extraction and insertion of `completedPredictionRecords` for bulk insert
- Backfill of previous trip's `AtDockDepartNext` and `AtSeaDepartNext` with actual departure time

Trip orchestration code builds the fully-correct trip object first, then delegates post-persist prediction side effects to the PredictionService.

### SailingDay from Raw Data

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via `getSailingDay` in `baseTripFromLocation`, not from schedule lookup. Uses `ScheduledDeparture` only. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `appendFinalSchedule`: Event-driven when a trip starts or its key changes. Called by `buildTrip`. Reuses existing schedule fields when the key matches.

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTrip` (which internally calls `baseTripFromLocation` + `appendFinalSchedule` + `appendArriveDockPredictions` + `appendLeaveDockPredictions`, using provided events and `shouldRunPredictionFallback` to drive enrichments).
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
- **Event-driven**: Run when a real trip start is observed (`tripStart=true`)
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
- `processCurrentTrips()` calls `handlePredictionEvent()` with `leave_dock` only after `upsertVesselTripsBatch` succeeds for that vessel

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
| Query | `getScheduledTripByKey` | Per vessel, when a trip starts or its computed Key changes |
| Query | `getModelParametersForProduction` / `getModelParametersForProductionBatch` | Per vessel, when prediction runs (batch when 2+ specs) |
| Mutation | `completeAndStartNewTrip` | Per vessel, on trip boundary |
| Mutation | `upsertVesselTripsBatch` | Once if has active upserts |
| Mutation | `setDepartNextActualsForMostRecentCompletedTrip` | Per vessel, when didJustLeaveDock |
| Mutation | `bulkInsertPredictions` | Once if has completed prediction records |

**Call frequency**: Expensive lookups and predictions are event-gated. They run roughly once per 30–60 minutes per vessel (at trip start or when leaving dock), not every 5 seconds.

### Optimizations

- **Schedule reuse**: `appendFinalSchedule` reuses existing schedule-derived fields when the key matches, avoiding redundant lookups.
- **Batch model loading**: `computePredictions` uses `loadModelsForPairBatch` when computing 2+ predictions for a vessel.
- **Batch upserts**: Active trips are batched and upserted together in `upsertVesselTripsBatch`.
- **Event-gated predictions**: Expensive ML operations only run when a real trip start is observed or when the vessel departs dock, not every tick.
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
2. **Transition-based orchestration**: `runUpdateVesselTrips()` now builds `TripTransition` objects so events are computed once and carried through the pipeline
3. **Shared dock-departure inference**: `getDockDepartureState()` now centralizes `LeftDock` inference for both event detection and trip field derivation
4. **Post-persist leave-dock side effects**: `PredictionService` leave-dock handlers now run only after `upsertVesselTripsBatch` succeeds for that vessel
5. **Explicit fallback flag**: `runUpdateVesselTrips()` computes `shouldRunPredictionFallback` once per tick and passes it into `buildTrip()`
6. **Cleaned up console logs**: Removed debug `console.log` statements from `buildTrip.ts`
7. **Fixed documentation**: Removed outdated comment in `buildCompletedTrip.ts` about prediction actualization (handled separately by PredictionService)
8. **Simplified naming**: Implemented clearer naming convention:
   - `buildTrip` - Main orchestrator (creates complete trip)
   - `baseTrip*` - Base construction from raw data
   - `append*` - Enrich existing trip with data
   - Comments use "enrich" for clarity
9. **Finalize before persist**: `buildTrip()` and `buildCompletedTrip()` now apply same-trip prediction actuals before persistence.
10. **PredictionService simplification**: PredictionService now handles post-persist side effects only (`trip_complete`, `leave_dock`).
11. **Per-vessel isolation**: Errors for one vessel no longer abort the full batch.
12. **Carry-forward protection**: Continuing trips preserve durable fields such as `ScheduledDeparture` and `LeftDock` across feed glitches.
13. **Key availability detection**: Schedule enrichment now runs when a key becomes newly available, not only when an existing key changes.

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/REFACTOR_SUMMARY.md` — Historical refactoring analysis
- `ANALYSIS_VESSELTRIPS_UPDATES.md` — Detailed analysis of KISS principle improvements
