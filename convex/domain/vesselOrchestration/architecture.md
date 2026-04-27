# Vessel orchestration architecture

This document describes the current shipped trip orchestration path, with the focus on the boundaries that matter in code today.

## One-screen mental model

Each orchestrator ping runs in this order:

```text
updateVesselOrchestrator (action/actions.ts)
  -> load identities + active trips (getOrchestratorModelData via loadOrchestratorSnapshot; fail fast if identity tables empty)
  -> fetch and normalize vessel locations (WSF + mapWsfVesselLocations)
  -> bulkUpsertVesselLocations (dedupe + locations-only upsert; returns changed rows)
  -> createScheduleContinuityAccess for the ping (memoized eventsScheduled reads)
  -> per changed vessel: updateVesselTrip -> runPredictionStage -> buildTripWritesForVessel
  -> updateTimeline in action memory (trip handoff + mlTimelineOverlays)
  -> persistPerVesselOrchestratorWrites: trip writes + prediction upserts + timeline rows
```

The trip and prediction stages run in the action per changed location row.
Location dedupe runs in `bulkUpsertVesselLocations`, and the action consumes only
that mutation's changed-row return. Timeline projection (`updateTimeline`) runs
in the action **before** persistence; `persistPerVesselOrchestratorWrites` applies
trip lifecycle writes, prediction proposals, and projected actual/predicted dock
rows in one ordered mutation per vessel.

## Timestamp semantics (current code)

Use this as the canonical timestamp vocabulary for trip, timeline, and client read logic.

### One clock

- Use feed/sample epoch ms (`TimeStamp`) as the domain clock across `vesselLocations`, trip rows, and timeline events.
- Do not use wall clock (`Date.now()`) for lifecycle or boundary semantics.

### Trip row fields by intent

- Coverage interval: `StartTime` and `EndTime` describe when a trip row exists in storage. `EndTime` can be a synthetic close.
- Physical boundaries: `ArrivedCurrActual`, `LeftDockActual`, `ArrivedNextActual` are the canonical physical boundary facts.
- Legacy mirrors/fallbacks: `TripStart`, `TripEnd`, `ArriveDest`, `LeftDock`, `AtDockActual` remain for compatibility and display fallback chains.

### Key rule

- Never infer physical arrival/departure from coverage fields alone. In particular, `EndTime` does not imply destination arrival.

### Timeline projection contract

- `eventsActual` projection reads trip physical boundaries from `actualDockWritesFromTrip.ts`:
  - `dep-dock` uses `LeftDockActual`
  - `arv-dock` uses `ArrivedNextActual`
- Projection requires trip identity/terminal context (`TripKey`, terminal abbreviations) and does not derive boundaries from `StartTime`/`EndTime`.

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

- `updateVesselTrip`
- `VesselTripUpdate`

Internal one-vessel flow:

```text
updateVesselTrip
  -> detectTripEvents
  -> buildUpdatedVesselRows
  -> classify storage/lifecycle change
```

`buildUpdatedVesselRows` is the only row-construction seam in the folder.

### `tripFields`

Owns schedule-facing trip identity policy.

Public seam:

- `resolveTripFieldsForTripRow`

That seam resolves current-trip fields, emits transient inference observability, and attaches next-leg schedule fields to the built row.

### `shared`

Owns cross-module contracts that should not leak from `updateVesselTrip`, such as:

- `TripLifecycleEventFlags`
- `areTripStorageRowsEqual`
- ping-handshake DTOs shared by persistence, predictions, and timeline code

### Schedule continuity (production vs tests)

- **Production:** trip-field code depends only on `ScheduleContinuityAccess`, wired from `functions/vesselOrchestrator/action/pipeline/scheduleContinuity.ts` (`createScheduleContinuityAccess`) with memoized internal queries against `eventsScheduled`. There is no per-ping read of a materialized full-day schedule snapshot table on this path.
- **Tests:** `shared/scheduleSnapshot/` builds the same interface from an in-memory `ScheduleSnapshot` fixture (see that folder’s README). Do not treat that fixture as documentation of production persistence.

## Contracts between stages

Trip stage durable output:

- `activeTrips: ReadonlyArray<ConvexVesselTrip>`
- `completedTrips: ReadonlyArray<ConvexVesselTrip>`

Trip stage orchestrator metadata:

- `ReadonlyArray<VesselTripUpdate>`

Prediction and timeline stages consume trip rows plus handshake DTOs produced in `domain/vesselOrchestration/shared` and shaped in `functions/vesselOrchestrator/action/pipeline/*`.

## Current ownership

- `functions/vesselOrchestrator/action/actions.ts`
  - top-level ping orchestration (`updateVesselOrchestrator`, `runOrchestratorPing`)
- `functions/vesselOrchestrator/action/pipeline/*`
  - location load, snapshot, schedule continuity, trip stage, prediction stage, trip-write shaping, timeline handoff adapter
- `functions/vesselOrchestrator/mutation/mutations.ts` (`persistPerVesselOrchestratorWrites`)
  - ordered trip + prediction + timeline persistence per vessel
- `domain/vesselOrchestration/updateVesselTrip/`
  - trip compute only
- `domain/vesselOrchestration/updateVesselPredictions/`
  - ML overlay from trip rows
- `domain/vesselOrchestration/updateTimeline/`
  - actual/predicted dock event assembly (pure); orchestrator calls it before `persistPerVesselOrchestratorWrites`

## Key design rules

- Trip compute stays prediction-free.
- Schedule continuity in production uses only **`ScheduleContinuityAccess`** (see `functions/vesselOrchestrator/action/pipeline/scheduleContinuity.ts`); do not add a parallel schedule seam for trip-field code.
- Shared downstream contracts are owned in `shared/`, not in `updateVesselTrip`.
- Helper-level seams should stay internal unless another subsystem truly consumes them.
- `tripFields/` remains isolated because schedule identity policy changes for different reasons than physical lifecycle logic.
