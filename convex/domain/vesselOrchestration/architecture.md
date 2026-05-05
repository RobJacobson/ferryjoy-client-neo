# Vessel orchestration architecture

This document describes the current shipped trip orchestration path, with the focus on the boundaries that matter in code today.

## One-screen mental model

Each orchestrator ping runs in this order:

```text
updateVesselOrchestrator (functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts)
  -> load identities only (getOrchestratorIdentities via loadOrchestratorSnapshot; fail fast if identity tables empty)
  -> fetch and normalize vessel locations (WSF + mapWsfVesselLocations)
  -> bulkUpsertVesselLocations (dedupe + upsert; returns changed rows + activeTripsForChanged in same transaction)
  -> createUpdateVesselTripDbAccess for the ping (targeted updateVesselTrip reads via ctx.runQuery)
  -> per changed vessel:
       updateVesselTrip -> VesselTripUpdate | null
       getVesselTripPredictionsFromTripUpdate (injected loadPredictionModelParameters → getPredictionModelParameters when needed)
       updateEvents ({ pingStartedAt, tripUpdate, enrichedActiveVesselTrip })
       persistVesselUpdates (one atomic mutation for trip, event, actualization)
```

The trip and prediction stages run in the action per changed location row.
Location dedupe and post-write **`activeTripsForChanged`** reads run in `bulkUpsertVesselLocations`; the action consumes that mutation's **`changedLocations`** and **`activeTripsForChanged`** return. Event projection (`updateEvents`) runs
in the action **before** persistence; `persistVesselUpdates` applies trip
lifecycle writes, projected actual/predicted dock rows, and optional
depart-next actualization in one transaction per vessel.

## Timestamp semantics (current code)

Use this as the canonical timestamp vocabulary for trip, event, and client read logic.

### One clock

- Use feed/sample epoch ms (`TimeStamp`) as the domain clock across `vesselLocations`, trip rows, and event events.
- Do not use wall clock (`Date.now()`) for lifecycle or boundary semantics.

### Trip row fields by intent

- Coverage interval: `TripStart` and `TripEnd` describe when a trip row exists in storage. `TripEnd` can be a synthetic close.
- Physical boundaries: `TripStart`, `LeftDockActual`, `TripEnd` are the canonical physical boundary facts.
- Phase state: trip `AtDock` is sourced from location `AtDockObserved` (stabilized observed phase), not directly from raw WSF `AtDock`.
- Legacy mirrors/fallbacks: `TripStart`, `TripEnd`, `TripEnd`, `LeftDock`, `TripStart` remain for compatibility and display fallback chains.

### Key rule

- Never infer physical arrival/departure from coverage fields alone. In particular, `TripEnd` does not imply destination arrival.

### Event projection contract

- `eventsActual` projection reads trip physical boundaries from `actualDockWritesFromTrip.ts`:
  - `dep-dock` uses `LeftDockActual`
  - `arv-dock` uses `TripEnd`
- Projection requires trip identity/terminal context (`TripKey`, terminal abbreviations) and does not derive boundaries from `TripStart`/`TripEnd`.

### Prediction storage contract

- Persisted `activeVesselTrips` and `completedVesselTrips` rows do not store ML blobs.
- Prediction rows are stored separately and joined on read paths.

### Client conversion and fallback

- `toDomainVesselTrip` converts trip epoch-ms fields to `Date` objects.
- UI fallback chains live in `tripTimeHelpers.ts` and intentionally keep compatibility behavior centralized.

## Core boundaries

### `updateVesselTrip`

Owns authoritative lifecycle trip rows for one ping.

Public surface:

- `updateVesselTrip` → **`VesselTripUpdate | null`** (null when no substantive durable change)
- `VesselTripUpdate` — sparse rows: **`existingVesselTrip`**, **`activeVesselTrip`**, **`completedVesselTrip`**

Internal one-vessel flow:

```text
updateVesselTrip
  -> startsNewTripLeg
  -> buildCompleteTrip?
  -> buildActiveTrip
  -> applyScheduleToActiveTrip
  -> classify storage/lifecycle change
```

### updateVesselTrip schedule

`updateVesselTrip/schedule/` is private support for active-trip schedule
enrichment. It owns the active schedule policy, WSF realtime resolution,
next-schedule-key continuity, schedule-table lookup, merge rules, diagnostics,
and schedule resolution types.

### Downstream contract boundaries

Cross-module contracts are owned by the domain modules that consume them:

- Dock transition facts are defined in
  `updateVesselTrip/dockTransitionEvents.ts` and exported via the
  `updateVesselTrip` barrel.
- Event handoff DTOs live in `updateEvents/handoffTypes.ts`.
- Event projection wire helpers live in `updateEvents/projectionWire.ts`.
- Completed-handoff key helper lives in
  `updateEvents/completedHandoffKey.ts`.

### Schedule continuity (production vs tests)

- **Production:** trip-field code depends only on `UpdateVesselTripDbAccess`, wired from `functions/vesselOrchestrator/actions/ping/updateVesselTrip/updateVesselTripDbAccess.ts` (`createUpdateVesselTripDbAccess`) with key-first internal queries against `eventsScheduled`. The domain tries `NextScheduleKey` continuity before rollover fallback. There is no per-ping read of a materialized full-day schedule snapshot table on this path.
- **Tests:** schedule-resolution fixtures/helpers live under
  `updateVesselTrip/schedule/tests/`, and public behavior/module tests live
  under `updateVesselTrip/tests/`.

## Contracts between stages

Trip stage output to downstream domain callers:

- **`VesselTripUpdate | null`** per changed location row (orchestrator skips the vessel when null)

Predictions consume **`VesselTripUpdate`** via **`getVesselTripPredictionsFromTripUpdate`** and return **`enrichedActiveVesselTrip`**. Event handoff and prediction overlays are derived inside **`updateEvents`** from the same trip shape plus that enriched trip
(**`eventHandoffFromTripUpdate`**) with DTOs in
**`updateEvents/handoffTypes.ts`**.

## Current ownership

- `functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts`
  - top-level ping orchestration (`updateVesselOrchestrator`, `runOrchestratorPing`)
- `functions/vesselOrchestrator/actions/ping/*`
  - identity snapshot (**`loadOrchestratorSnapshot`** / **`getOrchestratorIdentities`**), locations stage (**`updateVesselLocations`** / **`bulkUpsertVesselLocations`** including **`activeTripsForChanged`**), schedule DB access (**`updateVesselTrip/updateVesselTripDbAccess.ts`**), prediction-parameter load (**`loadPredictionModelParameters`** in **`actions/ping/updateVesselPredictions/load.ts`**)
- `functions/vesselOrchestrator/mutations/orchestratorPersistMutations.ts`
  - aggregate per-vessel persistence (`persistVesselUpdates`)
- `domain/vesselOrchestration/updateVesselTrip/`
  - trip compute only
- `domain/vesselOrchestration/updateVesselPredictions/`
  - ML overlay from trip rows
- `domain/vesselOrchestration/updateEvents/`
  - actual/predicted dock event assembly (pure); orchestrator calls it before aggregate persistence

## Key design rules

- Trip compute stays prediction-free.
- Schedule reads in production use only **`UpdateVesselTripDbAccess`** (see `functions/vesselOrchestrator/actions/ping/updateVesselTrip/updateVesselTripDbAccess.ts`); do not add a parallel schedule seam for trip-field code.
- Downstream contracts are owned by their module boundaries
  (`updateVesselTrip/dockTransitionEvents.ts` and `updateEvents/*`), not a shared
  cross-folder contract package.
- Helper-level seams should stay internal unless another subsystem truly consumes them.
- `dockTransitionEvents.ts` compatibility helpers remain downstream-facing and do not drive the main trip update pipeline.
