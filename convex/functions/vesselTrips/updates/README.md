# VesselTrips Updates Module

This module synchronizes active vessel trips with live location data. It runs as part of the vessel orchestrator (every 5 seconds) and processes vessel location updates to determine whether database writes are needed.

**Core pattern**: Build-then-compare. The pipeline constructs the full in-memory `VesselTrip` (including ML prediction blobs and same-trip actualization when applicable), compares to the hydrated `existingTrip`, then **strips** the five boundary prediction fields before persisting trip rows. **Stage 2** splits **lifecycle** persistence (`shouldPersistLifecycleTrip` / strip-shaped equality) from **projection** refresh (`shouldRefreshTimelineProjection` / `tripsAreEqual`). Prediction-only ticks can refresh `eventsPredicted` without an active upsert when stored columns are unchanged. Trip boundaries always produce writes, `leave_dock` side effects run only after the active trip upsert succeeds, and `VesselTimeline` actual/predicted overlays are projected from the finalized trip state rather than re-derived from raw location ticks.

**Identity boundary**: This module now consumes `ConvexVesselLocation` from `vesselLocation/schemas.ts`. That means `VesselAbbrev` and the hot-path terminal fields were already validated against the backend vessel/terminal tables before trip logic runs. Persisted trip rows still use plain strings; the branding is a backend runtime guarantee, not a storage-schema migration.

**Predictions (strip → project → hydrate)**: The tick pipeline still builds full in-memory ML blobs (`appendPredictions`, `vesselTripPredictions`) for comparison and timeline projection, but **trip table rows do not store** the five boundary prediction fields. Before `upsertVesselTripsBatch` / `completeAndStartNewTrip`, payloads go through `stripTripPredictionsForStorage`. `projectPredictedBoundaryEffects` persists overlays to `eventsPredicted` with composite identity `(Key, PredictionType, PredictionSource)`; WSF ETA (`PredictionSource: "wsf_eta"`) and ML rows are separate when both apply to the same arrival boundary. **Read paths** (`vesselTrips` queries, orchestrator read model) batch-load `eventsPredicted` and **hydrate** trips so API responses still expose the joined `vesselTripSchema` shape (minimal `PredTime` / optional `Actual` / `DeltaTotal` on those fields; WSF ship ETA remains `trip.Eta`). Same-trip actualization and `setDepartNextActualsForMostRecentCompletedTrip` patch `eventsPredicted`, not trip documents.

**Current design**:
1. `buildTrip` — main orchestrator calling all build functions with event detection and finalizing same-trip prediction actuals before persistence
2. `tripDerivation` — shared normalized per-tick derivation for event detection and base-trip construction (`ScheduledDeparture`, `SailingDay`, `Key`, dock-departure state, explicit base-trip mode)
3. `baseTripFromLocation` — base trip from raw location data using explicit `start` and `continue` modes
4. `appendFinalSchedule` — deterministic schedule lookup by Key only; `resolveEffectiveLocation` may call targeted `eventsScheduled` lookups only when `NextKey` or rollover hints exist on the prior trip
5. `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions gated on a real trip start (at-dock: AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext; at-sea: AtSeaArriveNext, AtSeaDepartNext)

**Centralized trip identity**: `shared/tripIdentity.ts` owns canonical derivation of `Key`, `SailingDay`, and trip-start readiness. `tripDerivation.ts` uses that helper for both current-tick and carry-forward cases so event detection and base-trip construction stay aligned with `vesselLocations`.

**Centralized trip derivation**: `tripDerivation.ts` owns the shared per-tick derivation used by both `detectTripEvents` and `baseTripFromLocation`, including carry-forward protection and dock-departure state.

**Centralized event detection**: `detectTripEvents` in `eventDetection.ts` computes the event bundle once per vessel update using the shared derived inputs from `tripDerivation.ts`.

**Naming convention**:
- `buildTrip` - Main orchestrator that creates complete trip from scratch
- `baseTrip*` - Base construction from raw location data
- `append*` - Enrich existing trip with schedule or prediction data
- Comments use "enrich" to describe the process of adding data

---

## Architecture

### Numbered tick pipeline (code order)

1. **Resolve active trips** — Preloaded `activeTrips` from the orchestrator read model, or `getActiveTrips` when omitted.
2. **Derive `shouldRunPredictionFallback`** — First seconds of each minute, from orchestrator-owned `tickStartedAt`.
3. **Build `TripTickPlan`** — Stage 1 contract: `locations`, `tickStartedAt`, `activeTripsSource`, `shouldRunPredictionFallback` (see `contracts.ts`).
4. **Build `TripTransition` per vessel** — `{ currLocation, existingTrip?, events }`; events computed once.
5. **Split transitions** — `completedTrips` (boundary) vs `currentTrips` (ongoing / first appearance).
6. **Lifecycle branches (sequential `await`)** — `processCompletedTrips` **first**, then `processCurrentTrips` (mutations run inside each branch; not parallel).
7. **Merge projection batch** — Completed-branch patches/effects, then current-branch patches/effects (`mergeProjectionBatches`).
8. **Project overlays** — `projectActualBoundaryPatches` / `projectPredictedBoundaryEffects` after lifecycle writes succeed.

**Read path (not synchronous with step 8):** Queries load stored trips (no ML blobs on rows), then `hydrateStoredTripsWithPredictions` merges `eventsPredicted` for API shape. That happens on subscription/query, not in the same atomic tick as step 8.

### Pipeline Overview

```
processVesselTrips (entry point)
    ├─> Load active trips (once)
    ├─> Build TripTransition objects:
    │       { currLocation, existingTrip, events }
    │       Events are computed once and passed through call chain
    ├─> Categorize transitions into two groups:
    │       completedTrips, currentTrips
    ├─> Derive shouldRunPredictionFallback from the orchestrator-owned tick timestamp
    └─> Delegate to processing functions (each handles own persistence
            with per-vessel error isolation):
            ├─> processCompletedTrips (trip boundary)
            │       buildCompletedTrip → buildTrip (tripStart=true, events, shouldRunPredictionFallback)
            │       → emit actual/predicted boundary projection effects
            │       (internal: tripDerivation → baseTripFromLocation
            │                 → appendFinalSchedule
            │                 → appendArriveDockPredictions
            │                 → appendLeaveDockPredictions
            │                 → actualizePredictionsOnTripComplete / OnLeaveDock)
            └─> processCurrentTrips (ongoing trips, including first appearances)
                    buildTrip (tripStart=false, events, shouldRunPredictionFallback)
                    → shouldPersistLifecycleTrip → upsertVesselTripsBatch (if strip-shaped row changed)
                    → shouldRefreshTimelineProjection → actual/predicted boundary projection effects (may skip upsert)
                    → setDepartNextActualsForMostRecentCompletedTrip (leave_dock, post-upsert only)
                    (internal: tripDerivation → baseTripFromLocation
                              → appendFinalSchedule
                              → appendArriveDockPredictions
                              → appendLeaveDockPredictions
                              → actualizePredictionsOnLeaveDock)
    └─> Batch-project VesselTimeline overlays after successful trip persistence
            ├─> eventsActual
            └─> eventsPredicted
```

`eventsScheduled`, `eventsActual`, and `eventsPredicted` are now the
normalized persistence layer only. The public `VesselTimeline` read contract is
built later in `convex/domain/vesselTimeline/timelineEvents.ts` and
`convex/domain/vesselTimeline/viewModel.ts` as a backbone-only ordered event
list. The client derives `activeInterval` locally from that backbone.

### File Structure

| File | Purpose |
|------|---------|
| `contracts.ts` | Stage 1 tick contracts: `TripTickPlan`, `LifecycleCommand`, `ProjectionBatch`, and merge helpers used by `processVesselTrips` |
| `processVesselTrips/processVesselTrips.ts` | Main per-tick trip processor: builds `TripTransition` objects, categorizes them into completed/current, and delegates to processing functions |
| `processVesselTrips/processCompletedTrips.ts` | `processCompletedTrips` — trip-boundary persistence and boundary effect collection |
| `processVesselTrips/processCurrentTrips.ts` | `processCurrentTrips` — same-trip persistence, post-upsert depart-next backfill on leave-dock, and boundary effect collection |
| `tripDerivation.ts` | Shared normalized trip derivation: carry-forward fields, dock departure, and explicit base-trip mode selection |
| `eventDetection.ts` | `detectTripEvents` — centralized event detection driven by shared trip-derivation helpers |
| `buildCompletedTrip.ts` | `buildCompletedTrip` — builds completed trip with TripEnd, durations, same-trip actualization, and a guard against impossible arrival timestamps before persistence |
| `buildTrip.ts` | `buildTrip` — orchestrates all build functions (location, schedule, predictions) with provided events, then finalizes leave-dock actuals before persistence |
| `baseTripFromLocation.ts` | `baseTripFromLocation` — location-derived base trip from `ConvexVesselLocation` using explicit `start` / `continue` modes |
| `appendPredictions.ts` | `appendArriveDockPredictions`, `appendLeaveDockPredictions` — ML predictions for at-dock (AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext) and at-sea (AtSeaArriveNext, AtSeaDepartNext) events |
| `appendSchedule.ts` | `appendFinalSchedule` — deterministic schedule lookup by Key; `resolveEffectiveLocation` uses `NextKey`/rollover lookups only when continuity hints exist |
| `tripEquality.ts` | `lifecycleTripsEqual`, `shouldPersistLifecycleTrip`, `shouldRefreshTimelineProjection`, `tripsAreEqual`, `deepEqual` — lifecycle strip-shaped vs projection-normalized equality |
| `shared/tripIdentity.ts` | `deriveTripIdentity` — canonical `Key` / `SailingDay` / start-ready derivation shared by live locations and trip updates |
| `tests/*.test.ts` | Focused unit and sequencing coverage for builders, completed/current trip processing, event detection, and top-level update orchestration |

**External dependencies**:
- `convex/domain/ml/prediction/vesselTripPredictions.ts` — `PREDICTION_SPECS`, `predictFromSpec`, `actualizePredictionsOnTripComplete`, `actualizePredictionsOnLeaveDock`
- `convex/domain/ml/prediction/predictTrip.ts` — `loadModelsForPairBatch`, `predictTripValue`
- `convex/functions/eventsScheduled/queries.ts` — thin Convex query handlers for schedule-backed segment lookup
- `convex/functions/eventsScheduled/segmentResolvers.ts` — pure scheduled-segment selection reused by those query handlers
- `convex/functions/vesselTrips/mutations.ts` — `completeAndStartNewTrip`, `upsertVesselTripsBatch`, `setDepartNextActualsForMostRecentCompletedTrip`

**Tests**:
- Colocated under `convex/functions/vesselTrips/updates/tests/`
- Typical command: `bun test convex/functions/vesselTrips/updates/tests/*.test.ts`

---

## Event Types

All events are detected by `detectTripEvents(existingTrip, currLocation)`.

### 1. First Trip

**Condition**: `isFirstTrip = !existingTrip` (first appearance of a vessel).

**Behavior**: Handled by `processCurrentTrips`.
- `buildTrip(..., tripStart=false, ...)` creates the active trip record using feed identity when available; schedule lookups run only for `NextKey` or same-day rollover when the prior trip carried those hints
- `TripStart` remains undefined unless the system observed the boundary from a prior completed trip
- Compares via `shouldPersistLifecycleTrip` / `shouldRefreshTimelineProjection` (always true for new trips) and writes via `upsertVesselTripsBatch` when the strip-shaped row is new or changed

### 2. Trip Boundary

**Condition**: `isCompletedTrip = hasTripEvidence && didJustArriveAtDock`, where `hasTripEvidence` means the old trip has `LeftDock` or `ArriveDest`.

**Behavior**:
1. Complete the current trip immediately on arrival via `buildCompletedTrip`: set `TripEnd`, compute durations from the real arrival time (`ArriveDest` when available), and actualize same-trip at-sea predictions before persistence.
2. Start the replacement trip via `buildTrip(ctx, currLocation, tripToComplete, true, events, shouldRunPredictionFallback)` with `tripStart=true` for `Prev*` context and deterministic schedule lookup by Key.
   Trip-boundary rollover should normally reuse:
   - the exact `NextKey` already linked from the completed trip
   - the first surviving scheduled trip after the completed trip's `ScheduledDeparture`
3. The replacement trip's `TripStart` equals the completed trip's `TripEnd`.
4. Call `completeAndStartNewTrip` mutation (atomic: insert completed, replace active).

### 3. Regular Update (Ongoing Trips)

**Condition**: `!isCompletedTrip`.

**Behavior**:
1. `buildTrip(ctx, currLocation, existingTrip, false, events, shouldRunPredictionFallback)` now handles:
   - continuing started trips
   - first-seen trips whose `TripStart` is still unknown
   - deterministic schedule lookup when a key becomes newly available
   - at-dock predictions only after a real trip start
   - Calls `appendLeaveDockPredictions` when physically depart dock
   - Applies `actualizePredictionsOnLeaveDock` before persistence when `didJustLeaveDock`
2. When `didJustLeaveDock`: `processCurrentTrips()` queues a post-upsert hook. After `upsertVesselTripsBatch` succeeds for that vessel, it calls `setDepartNextActualsForMostRecentCompletedTrip` to backfill the previous completed trip's depart-next actuals (using the new trip's `LeftDock` time).
3. `shouldPersistLifecycleTrip` → upsert only if strip-shaped row differs; `shouldRefreshTimelineProjection` → overlays when projection semantics differ (may run without upsert).
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
  ├─> tripDerivation (shared normalized per-tick values and explicit base-trip mode)
  ├─> baseTripFromLocation (base trip from raw data, using tripStart flag)
  ├─> Use provided events and trip state to drive enrichments:
  │   ├─> didJustArriveAtDock (from events.didJustArriveAtDock)
  │   ├─> didJustLeaveDock (from events.didJustLeaveDock)
  │   └─> keyChanged (from events.keyChanged)
  │   └─> shouldRunPredictionFallback (computed once from the tick timestamp passed in by VesselOrchestrator)
  ├─> stamp ArriveDest (only for same-trip arrival evidence that does not trigger rollover)
  ├─> appendFinalSchedule (if tripStart or keyChanged)
  ├─> appendArriveDockPredictions (if at dock && TripStart exists && (tripStart || time-based fallback))
  ├─> appendLeaveDockPredictions (if at sea && (didJustLeaveDock || time-based fallback))
  └─> actualizePredictionsOnLeaveDock (if didJustLeaveDock)
```

**Benefits**:
- Single entry point for trip construction used by both `processCompletedTrips` and `processCurrentTrips`, with `tripStart` explicitly marking when a replacement trip is created
- Events computed once in `processVesselTrips` and passed through call chain, avoiding redundant computation
- Shared trip derivation keeps event detection and base-trip construction in sync
- Consistent application of all enrichments across trip boundaries and regular updates
- Clear separation of concerns: `baseTripFromLocation` for raw data, schedule functions for database lookups, prediction functions for ML
- Time-based fallback provides resilience against missed events or prediction generation failures

---

## Event Detection

Centralized in `eventDetection.ts`, `detectTripEvents()` returns:

| Event | Detection Logic | Triggers |
|-------|----------------|----------|
| `isFirstTrip` | `!existingTrip` | Vessel's first appearance |
| `isTripStartReady` | Derived by `deriveTripIdentity` from `ScheduledDeparture` + `ArrivingTerminalAbbrev` | Feed now exposes real next-trip data |
| `shouldStartTrip` | Always `false` in the current lifecycle | Reserved compatibility field; arrival now owns rollover |
| `isCompletedTrip` | `hasTripEvidence && didJustArriveAtDock` | Immediate trip boundary on physical arrival at a new dock |
| `didJustArriveAtDock` | `existingTrip.LeftDock && !existingTrip.ArriveDest && currLocation.AtDock && currLocation.DepartingTerminalAbbrev !== existingTrip.DepartingTerminalAbbrev` | Vessel physically reached a new dock after a real sailing leg, even if the feed's expected-destination field is stale |
| `didJustLeaveDock` | `existingTrip?.LeftDock === undefined && currLocation.LeftDock !== undefined` | Vessel just departed dock |
| `keyChanged` | `computedKey !== undefined && existingTrip?.Key !== computedKey` | Trip schedule identifier became available or changed |

**Benefits**:
- Single source of truth for all event detection
- Shared trip derivation via `tripDerivation.ts`
- Easy to test and understand what events exist

---

## VesselTrip vs VesselLocation

**VesselLocation** is a point-in-time snapshot from REST/API feed: position, terminals, AtDock, Eta, TimeStamp, optional canonical `Key`, etc.

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
| **Key** | Raw data + boundary ownership rules | From shared trip identity derivation; start mode uses the current tick's `ScheduledDeparture`/`ArrivingTerminalAbbrev`, continuing mode uses carried-forward values when the feed omits them, and the exact `didJustLeaveDock` tick keeps the departure boundary attached to the segment that owned the vessel during the preceding dock interval |
| **SailingDay** | Raw data + boundary ownership rules | Present if and only if `ScheduledDeparture` is known; derived by the same shared trip identity helper, using the same current-vs-carried-forward rule as `ScheduledDeparture`, including preserving departure-boundary ownership on the leave-dock tick |
| **PrevTerminalAbbrev, PrevScheduledDeparture, PrevLeftDock** | completedTrip (trip boundary) or undefined (first trip) | Set once at trip boundary from completed trip (via `tripStart=true`); undefined for first trips; not updated mid-trip |
| **ArriveDest** | Arrival event | `currLocation.TimeStamp` only when the vessel has already left dock and is now docked at the destination terminal; carried until completion |
| **TripStart** | Observed boundary event | Set only when the system observed a real trip boundary. At rollover this is the completed trip's `TripEnd`; first-seen trips keep `TripStart` undefined until such a boundary is observed. |
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

`SailingDay`: Exists exactly when `ScheduledDeparture` exists. There is no separate notion of a missing sailing day once a scheduled departure is known.

`NextScheduledDeparture`: Set by `appendFinalSchedule`. Carried forward from `existingTrip` in `baseTripForContinuing` when the lookup does not run. Prevents overwriting with undefined on regular updates.

### LeftDock Source of Truth

Departure is recorded only when the feed provides `LeftDock`. `AtDock` may disagree transiently, but it does not create or clear `LeftDock`.

### Leave-Dock Boundary Ownership

The exact tick where `LeftDock` first appears writes the departure actual to the
boundary that ends the current dock interval and starts the next sea interval.

- Preserve the existing dock-interval owner on that boundary tick when the
  vessel is departing from the same terminal
- Do not let a transient future `ScheduledDeparture` / `ArrivingTerminalAbbrev`
  jump from the raw feed steal ownership of the departure actual
- Only after the departure boundary has been recorded may later ticks advance to
  a new segment identity

### Base Trip Modes

`baseTripFromLocation` now uses two explicit modes:

- `start` — create a new trip from current feed data; clear predictions and set `Prev*` context from the completed trip when available
- `continue` — update the current trip or first-seen pre-trip using carried-forward values where needed

### ArriveDest Guardrails

- Do not stamp `ArriveDest` from destination-field churn alone. A real arrival requires evidence that the trip already departed and the vessel is now docked at a new terminal.
- On completion, if a stored `ArriveDest` is earlier than `LeftDock` or `TripStart`, treat it as invalid feed state and fall back to `TripEnd` for persisted arrival/duration fields.

### Event-Driven Side Effects

`didJustLeaveDock` drives:
- Same-trip actualization in `buildTrip()` before persistence
- Backfill of depart-next actuals onto the most recent completed trip via
  `setDepartNextActualsForMostRecentCompletedTrip` after a successful active-trip
  upsert
- `eventsActual` departure projection for the current trip, anchored to the
  pre-departure dock-owned segment
- `eventsPredicted` refresh for the affected boundary-key scope

Trip orchestration builds the fully-correct trip object first, runs the
post-upsert depart-next mutation when applicable, and separately emits timeline
projection effects keyed to the canonical segment/boundary identities.

Those projected overlays no longer imply a public raw-event query surface. The
timeline feature now treats them as backend inputs to the final row/view-model
builder.

### SailingDay from Raw Data

`SailingDay` is core business logic (WSF sailing day, 3 AM Pacific cutoff). It comes from raw data via the shared trip identity helper, not from schedule lookup. Uses `ScheduledDeparture` only. Needed whether or not we have a schedule match.

### Event-Driven Lookups

- `appendFinalSchedule`: Event-driven when a trip starts or its key changes. Reuses existing schedule fields when the key matches. `resolveEffectiveLocation` does not re-merge the full timeline backbone on each tick.

---

## Build-Then-Compare

### Flow

1. Build `proposedTrip` via `buildTrip` (which internally calls `baseTripFromLocation` + `appendFinalSchedule` + `appendArriveDockPredictions` + `appendLeaveDockPredictions`, using provided events and `shouldRunPredictionFallback` to drive enrichments).
2. Finalize same-trip actuals in the builder when applicable.
3. **Lifecycle** — `lifecycleTripsEqual` / `shouldPersistLifecycleTrip` after stripping the five ML fields (`stripTripPredictionsForStorage` semantics). If equal: no `activeVesselTrips` upsert.
4. **Projection** — `tripsAreEqual` / `shouldRefreshTimelineProjection` for overlay refresh (normalized prediction fields). If different from step 3: emit `eventsActual` / `eventsPredicted` work even when step 3 skipped the upsert.
5. When step 3 says persist: `activeUpsert = finalProposed` (batched via `upsertVesselTripsBatch`).

### tripsAreEqual (projection) and lifecycleTripsEqual

- **`lifecycleTripsEqual`** — Strip-shaped row equality: compares persisted columns only; `TimeStamp` excluded.
- **`tripsAreEqual`** — Projection-relevant equality: all keys except `TimeStamp`; prediction fields normalize to `PredTime` / `Actual` / `DeltaTotal` so ML-only noise does not force refresh.
- Uses `deepEqual` for nested objects (e.g. `ScheduledTrip`, non-prediction objects).
- Walks the union of keys on both trips so adds/removes are detected.

---

## ML Predictions

Predictions use a **hybrid event and time-based approach**:

**At-Dock Predictions** (AtDockDepartCurr, AtDockArriveNext, AtDockDepartNext):
- **Event-driven**: Run when a replacement trip is created at an observed boundary (`tripStart=true`)
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
- `AtDockDepartNext`, `AtSeaDepartNext`: Also actualized by `setDepartNextActualsForMostRecentCompletedTrip` when the *next* trip leaves dock (post-upsert backfill on the completed trip).

**Batch optimization**: When computing 2+ predictions for a vessel, `computePredictions` uses `loadModelsForPairBatch` for efficient model loading.

**Time-based fallback**: Once per minute (throttled by `seconds < 5`), the system checks for and generates any missing predictions that were not created during event-driven triggers. This provides resilience against missed events or prediction generation failures. Predictions that already exist are skipped (no redundant computation).

---

## Post-upsert depart-next backfill

When `didJustLeaveDock`, `processCurrentTrips` calls
`setDepartNextActualsForMostRecentCompletedTrip` **only after**
`upsertVesselTripsBatch` succeeds for that vessel, using the new active trip's
`LeftDock` as `actualDepartMs`. There is no separate logging table for completed
ML outcomes; prediction values live on trip rows and timeline projection
tables.

**Automatic handling**:
- ML outputs are computed in the trip-building pipeline before persistence
- Same-trip actuals are written onto trip objects before persistence
- Depart-next fields on the latest completed trip are patched when the next leg
  leaves dock
- `eventsActual` and `eventsPredicted` refresh from finalized trip state after
  writes succeed

---

## Convex Function Calls

### Per 5-Second Tick

| Call Type | Function | When |
|-----------|----------|------|
| Query | `getActiveTrips` | Once at start when `processVesselTrips` is called **without** a preloaded trip list; the vessel orchestrator passes active trips from `getOrchestratorTickReadModelInternal` instead |
| Query | `getScheduledDepartureSegmentBySegmentKey` / `getNextDepartureSegmentAfterDeparture` (internal) | Per vessel tick only when `resolveEffectiveLocation` needs `NextKey` or rollover resolution; `appendFinalSchedule` on trip start / key change |
| Query | `getModelParametersForProduction` / `getModelParametersForProductionBatch` | Per vessel, when prediction runs (batch when 2+ specs) |
| Mutation | `completeAndStartNewTrip` | Per vessel, on trip boundary |
| Mutation | `upsertVesselTripsBatch` | Once if has active upserts |
| Mutation | `functions/eventsActual/mutations.projectActualBoundaryPatches` | Once if any trip-driven actual patches were emitted |
| Mutation | `projectPredictedBoundaryEffects` | Once if any trip-driven predicted effects were emitted |
| Mutation | `setDepartNextActualsForMostRecentCompletedTrip` | Per vessel, when didJustLeaveDock |

**Call frequency**: Expensive lookups and predictions are event-gated. They run roughly once per 30–60 minutes per vessel (at trip start or when leaving dock), not every 5 seconds.

### Optimizations

- **Schedule reuse**: `appendFinalSchedule` reuses existing schedule-derived fields when the key matches, avoiding redundant lookups.
- **Dock-time identity**: `resolveEffectiveLocation` uses internal segment queries only for `NextKey` or same-day rollover after a known departure; otherwise it relies on the live feed until Convex updates land.
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

---

## Recent Improvements

1. **Renamed file**: `buildTripWithAllData.ts` → `buildTrip.ts` for consistency between file name and export
2. **Transition-based orchestration**: `processVesselTrips()` now builds `TripTransition` objects so events are computed once and carried through the pipeline
3. **Shared dock-departure inference**: `getDockDepartureState()` now centralizes `LeftDock` inference for both event detection and trip field derivation
4. **Post-upsert leave-dock backfill**: `setDepartNextActualsForMostRecentCompletedTrip` runs only after `upsertVesselTripsBatch` succeeds for that vessel
5. **Explicit fallback flag**: `processVesselTrips()` computes `shouldRunPredictionFallback` once per tick and passes it into `buildTrip()`
6. **Cleaned up console logs**: Removed debug `console.log` statements from `buildTrip.ts`
7. **Fixed documentation**: Clarified same-trip prediction actualization vs post-upsert depart-next backfill
8. **Simplified naming**: Implemented clearer naming convention:
   - `buildTrip` - Main orchestrator (creates complete trip)
   - `baseTrip*` - Base construction from raw data
   - `append*` - Enrich existing trip with data
   - Comments use "enrich" for clarity
9. **Finalize before persist**: `buildTrip()` and `buildCompletedTrip()` now apply same-trip prediction actuals before persistence.
10. **Removed predictions logging table**: Post-upsert work is only depart-next backfill on `completedVesselTrips`; no `predictions` table inserts.
11. **Per-vessel isolation**: Errors for one vessel no longer abort the full batch.
12. **Carry-forward protection**: Continuing trips preserve durable fields such as `ScheduledDeparture` and `LeftDock` across feed glitches.
13. **Key availability detection**: Schedule enrichment now runs when a key becomes newly available, not only when an existing key changes.
14. **Orchestrator active-trip handoff**: `processVesselTrips` accepts an optional `activeTrips` argument so `updateVesselOrchestrator` can reuse the same snapshot loaded in its bundled read-model query and skip an extra `getActiveTrips` call on the hot path.

---

## Related Documentation

- `convex/functions/vesselOrchestrator/README.md` — Orchestrator entry point and flow
- `convex/domain/ml/readme-ml.md` — ML pipeline overview
- `convex/functions/vesselTrips/updates/REFACTOR_SUMMARY.md` — Historical refactoring analysis
- `ANALYSIS_VESSELTRIPS_UPDATES.md` — Detailed analysis of KISS principle improvements
