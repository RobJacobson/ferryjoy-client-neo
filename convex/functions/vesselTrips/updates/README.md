# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. For regular updates, the pipeline always constructs the full intended `VesselTrip` state, deep-compares to existing, and writes only when different. Trip boundaries and first trips always produce writes.

**Four-function design**:
1. `buildTripFromRawData` — main object from raw location data (simple assignments); derives Key from raw data for schedule lookup
2. `lookupScheduleAtArrival` — arrival terminal lookup when vessel arrives at dock (event-driven: AtDock false→true)
3. `buildTripWithSchedule` — schedule lookup by Key when arrival data available or key changed (event-driven)
4. `buildTripWithPredictions` — ML predictions when event-triggered (arrive-dock, depart-dock)

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
            │       buildTripFromRawData → buildTripWithSchedule → buildTripWithPredictions → upsertActiveTrip
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTripFromRawData → lookupScheduleAtArrival
            │       → buildTripWithSchedule → buildTripWithPredictions → completeAndStartNewTrip
            │       → bulkInsertPredictions (completed records)
            └─> processCurrentTrips (ongoing trips)
                    buildTripFromRawData → lookupScheduleAtArrival → buildTripWithSchedule
                    → buildTripWithPredictions → tripsAreEqual → upsertVesselTripsBatch (if changed)
                    → setDepartNextActualsForMostRecentCompletedTrip (when didJustLeaveDock)
                    → bulkInsertPredictions
```

### File Structure

| File | Purpose |
|------|---------|
| `updateVesselTrips.ts` | Main orchestrator: categorizes vessels into new/completed/current, delegates to processing functions |
| `buildTrip.ts` | `buildTripFromRawData`, `buildCompletedTrip` — location-derived fields, completion logic |
| `buildTripWithPredictions.ts` | `buildTripWithPredictions` — ML predictions when event-triggered (arrive-dock, depart-dock) |
| `lookupScheduledTrip.ts` | `lookupScheduleAtArrival`, `buildTripWithSchedule` — event-driven schedule lookup by Key |
| `utils.ts` | `tripsAreEqual`, `deepEqual`, `updateAndExtractPredictions` |

**External dependencies**:
- `convex/domain/ml/prediction/vesselTripPredictions.ts` — `computeVesselTripPredictionsPatch`, `updatePredictionsWithActuals`
- `convex/functions/vesselTrips/mutations.ts` — `completeAndStartNewTrip`, `upsertVesselTripsBatch`, `setDepartNextActualsForMostRecentCompletedTrip`

---

## Event Types

### 1. First Trip

**Condition**: No existing active trip for `VesselAbbrev`.

**Behavior**: Create new trip via `buildTripFromRawData(currLocation)`. No schedule lookup, no predictions. Always returns `activeUpsert`.

### 2. Trip Boundary

**Condition**: `DepartingTerminalAbbrev` changes (vessel arrived at a new terminal).

**Behavior**:
1. Complete current trip: set `TripEnd`, compute `AtSeaDuration`, `TotalDuration`, actualize predictions.
2. Start new trip: `buildTripFromRawData` with `Prev*` from completed trip, `TripStart = currLocation.TimeStamp`.
3. Lookup arrival terminal if missing.
4. Enrich with scheduled identity and at-dock predictions.
5. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).
6. Return `activeUpsert: undefined` (completion handled by mutation).

### 3. Regular Update

**Condition**: Same `DepartingTerminalAbbrev` (vessel still on same leg).

**Behavior**:
1. Arrival lookup (event-driven: only when AtDock false→true + missing ArrivingTerminal).
2. `buildTripFromRawData` — full location-derived state.
3. `buildTripWithSchedule` — ScheduledTrip (RouteID/RouteAbbrev live on ScheduledTrip).
4. `buildTripWithPredictions` — ML predictions; actualizes and extracts when `didJustLeaveDock`.
5. `tripsAreEqual(existingTrip, finalProposed)` → write only if different.
6. When `didJustLeaveDock`: call `setDepartNextActualsForMostRecentCompletedTrip` to backfill previous trip's depart-next actuals.

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
| **ArrivingTerminalAbbrev** | currLocation, scheduleArrival, or existingTrip | `currLocation` when truthy; else `scheduleArrival?.trip.ArrivingTerminalAbbrev`; else `existingTrip` (regular updates only; never old trip at boundary) |
| **Key** | Raw data | From `generateTripKey` in buildTripFromRawData; used for schedule lookup |
| **ScheduledTrip** | Schedule lookup | From `buildTripWithSchedule` (RouteID/RouteAbbrev live on ScheduledTrip); cleared when Key invalid or repositioning |
| **SailingDay** | Raw data | From `getSailingDay(ScheduledDeparture ?? TripStart ?? TimeStamp)` in buildTripFromRawData; prefer ScheduledDeparture |
| **PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock** | completedTrip | Set once at trip boundary; not updated mid-trip |
| **TripStart** | Inferred at boundary | `currLocation.TimeStamp` when vessel arrives at dock; carried forward |
| **AtDock** | currLocation | Direct copy every tick |
| **AtDockDuration** | Computed | `LeftDock - TripStart` (minutes); only when LeftDock set |
| **ScheduledDeparture** | currLocation | Only if currLocation has truthy value (null-overwrite protection) |
| **LeftDock** | currLocation or inferred | When AtDock flips false and missing: `currLocation.LeftDock ?? currLocation.TimeStamp`; else `currLocation.LeftDock ?? existingTrip.LeftDock` |
| **TripDelay** | Computed | `LeftDock - ScheduledDeparture` (minutes) |
| **Eta** | currLocation | Only if currLocation has truthy value |
| **TripEnd** | Boundary only | `currLocation.TimeStamp` when completing trip |
| **AtSeaDuration** | Computed | `TripEnd - LeftDock`; only on completed trip |
| **TotalDuration** | Computed | `TripEnd - TripStart`; only on completed trip |
| **InService, TimeStamp** | currLocation | Direct copy every tick |
| **AtDockDepartCurr** | ML | Run once when physically depart dock |
| **AtDockArriveNext, AtDockDepartNext** | ML | Run once when first arrive at dock with destination |
| **AtSeaArriveNext, AtSeaDepartNext** | ML | Run once when physically depart dock |

---

## Invariants and Gotchas

### ArrivingTerminalAbbrev

- **At trip boundary**: Never use `existingTrip.ArrivingTerminalAbbrev` — the old trip's ArrivingTerminal equals the new trip's DepartingTerminal (wrong terminal).
- **Regular updates**: Fallback chain in `buildTripFromRawData`: `currLocation` → `arrivalLookup?.arrivalTerminal` → `existingTrip`.

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

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via `getSailingDay` in `buildTripFromRawData`, not from schedule lookup. Prefer `ScheduledDeparture`; fallback to `TripStart` then `TimeStamp`. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `lookupScheduleAtArrival`: Event-driven (AtDock: false→true + missing ArrivingTerminal + has required fields).
- `buildTripWithSchedule`: Event-driven (arrival data became available OR key changed OR cached from arrival lookup).

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTripFromRawData` + `buildTripWithSchedule` + `buildTripWithPredictions` + actuals.
2. Compare `tripsAreEqual(existingTrip, finalProposed)`.
3. If equal: `activeUpsert = undefined` (no write).
4. If different: `activeUpsert = finalProposed`.

### tripsAreEqual

- Compares all semantic fields from `FIELDS_TO_COMPARE` (see `utils.ts`).
- **Excludes** `TimeStamp` — it changes every tick; we care about semantic equality.
- **Excludes** `_id`, `_creationTime` — read-only Convex fields.
- Uses `deepEqual` for nested objects (e.g. `ScheduledTrip`, prediction objects).

---

## ML Predictions

Predictions are **event-based**, not time-based:

- **Arrive-dock** (AtDockArriveNext, AtDockDepartNext): Run once when vessel first arrives at dock (`!existingTrip.AtDock && trip.AtDock`) and `isPredictionReadyTrip(trip)`.
- **Depart-dock** (AtDockDepartCurr, AtSeaArriveNext, AtSeaDepartNext): Run once when vessel physically departs (`!existingTrip.LeftDock && trip.LeftDock`).

`isPredictionReadyTrip` requires: TripStart, DepartingTerminalAbbrev, ArrivingTerminalAbbrev, PrevTerminalAbbrev, InService, ScheduledDeparture, PrevScheduledDeparture, PrevLeftDock. First trips lack Prev* and do not run at-dock predictions.

**Actualization**:
- `AtDockDepartCurr`, `AtSeaArriveNext`: Actualized by `updatePredictionsWithActuals` when LeftDock/TripEnd set.
- `AtDockDepartNext`, `AtSeaDepartNext`: Actualized by `setDepartNextActualsForMostRecentCompletedTrip` when the *next* trip leaves dock.

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

- **Consolidated arrival + scheduled trip lookup**: When `lookupScheduleAtArrival` returns a scheduled trip doc, that doc becomes `ScheduledTrip`. `buildTripWithSchedule` can reuse existing `ScheduledTrip` when key matches.
- **Batch model loading**: `computeVesselTripPredictionsPatch` uses `loadModelsForPairBatch` when computing 2+ predictions for a vessel.

---

## Mutations

| Mutation | Purpose |
|----------|---------|
| `upsertActiveTrip` | Upsert single active trip (used for new trips) |
| `completeAndStartNewTrip` | Atomic: insert completed trip into `completedVesselTrips`, replace active trip with new trip |
| `upsertVesselTripsBatch` | Batch upsert active trips (insert or replace); failures isolated per vessel |
| `setDepartNextActualsForMostRecentCompletedTrip` | Patch most recent completed trip with depart-next actuals when current trip leaves dock |

---

## Testing

- `__tests__/buildTripFromRawData.test.ts` — Location-derived field construction, fallback chain, LeftDock inference, null-overwrite protection.
- `__tests__/utils.test.ts` — `deepEqual` edge cases, `tripsAreEqual` (TimeStamp ignored, semantic differences, nested ScheduledTrip).

Run: `bun test convex/functions/vesselTrips/updates`

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/README_REFACTORING.md` — Historical refactoring analysis (design rationale, gotchas)
