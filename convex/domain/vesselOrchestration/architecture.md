# Vessel orchestration architecture

This document describes the current shipped trip orchestration path, with the
focus on the boundaries that matter in code today.

## One-screen mental model

Each orchestrator ping runs in this order:

```text
updateVesselOrchestrator
  -> fetch and normalize vessel locations
  -> load schedule continuity access for the ping
  -> compute trip rows through updateVesselTrips
  -> persist trip write set / handoff facts
  -> run prediction stage from trip rows
  -> assemble and persist timeline writes
```

The trip stage is pure domain compute. Persistence, prediction, and timeline
assembly happen downstream.

## Core boundaries

### `updateVesselTrips`

Owns authoritative lifecycle trip rows for one ping.

Public surface:

- `computeVesselTripsRows`
- `computeVesselTripUpdate`
- `RunUpdateVesselTripsOutput`
- `VesselTripUpdate`

Internal one-vessel flow:

```text
computeVesselTripUpdate
  -> detectTripEvents
  -> buildTripRowsForPing
  -> classify storage/lifecycle change
```

`buildTripRowsForPing` is the only row-construction seam in the folder.

### `tripFields`

Owns schedule-facing trip identity policy.

Public seam:

- `resolveTripFieldsForTripRow`

That seam resolves current-trip fields, emits transient inference observability,
and attaches next-leg schedule fields to the built row.

### `shared`

Owns cross-module contracts that should not leak from `updateVesselTrips`, such
as:

- `TripLifecycleEventFlags`
- `areTripStorageRowsEqual`
- ping-handshake DTOs shared by persistence, predictions, and timeline code

## Contracts between stages

Trip stage durable output:

- `activeTrips: ReadonlyArray<ConvexVesselTrip>`
- `completedTrips: ReadonlyArray<ConvexVesselTrip>`

Trip stage orchestrator metadata:

- `ReadonlyArray<VesselTripUpdate>`

Prediction and timeline stages consume trip rows plus handshake DTOs produced in
`domain/vesselOrchestration/shared` and `functions/vesselOrchestrator`.

## Current ownership

- `functions/vesselOrchestrator/actions.ts`
  - top-level ping orchestration
- `functions/vesselOrchestrator/persistVesselTripWriteSet.ts`
  - trip write persistence and handoff construction
- `domain/vesselOrchestration/updateVesselTrips/`
  - trip compute only
- `domain/vesselOrchestration/updateVesselPredictions/`
  - ML overlay from trip rows
- `domain/vesselOrchestration/updateTimeline/`
  - actual/predicted dock event assembly and persistence prep

## Key design rules

- Trip compute stays prediction-free.
- Shared downstream contracts are owned in `shared/`, not in
  `updateVesselTrips`.
- Helper-level seams should stay internal unless another subsystem truly
  consumes them.
- `tripFields/` remains isolated because schedule identity policy changes for
  different reasons than physical lifecycle logic.
