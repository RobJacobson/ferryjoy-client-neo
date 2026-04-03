## VesselTimeline Backend Domain

This folder contains the backend domain logic for the normalized
boundary-event-based `VesselTimeline` system.

There is no snapshot layer and no legacy vessel/day event table. The backend
persists only three normalized tables:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

The backend now composes the public timeline read model from those tables plus
live vessel state. The frontend is expected to consume backend-owned rows and
`activeRowId`, not reconstruct rows or guess active attachment itself.

The implementation boundary is now explicit:

- `convex/functions/vesselTimeline/*` owns Convex entrypoints, table reads, and
  query-time data loading
- `convex/domain/vesselTimeline/*` owns pure boundary-event, row, and
  read-model logic over plain objects

## Overview

`VesselTimeline` is modeled as a sequence of dock-boundary events:

- departure from dock
- arrival at dock

The backend persists those boundaries in normalized form, split by update
cadence:

- schedule backbone
- actual overlay
- prediction overlay

Everything else is derived, including:

- stable at-dock / at-sea row identity
- placeholder dock rows when a dock start is missing
- terminal-tail metadata when the slice ends on an arrival
- active-row attachment
- observed timestamp for the current live slice

## Sources Of Truth

### `eventsScheduled`

Structural source of truth for the timeline.

Source:

- direct physical schedule segments from transformed WSF schedule data

Responsibilities:

- define which boundary events exist for the vessel/day
- keep the canonical segment identity shared with `vesselTrips`
- define `dep-dock` vs `arv-dock`
- define scheduled timing and terminal identity
- provide `NextTerminalAbbrev` for client composition and debugging

Important behavior:

- replace-only during schedule sync
- never mutated by live vessel-location updates
- removed sailings disappear when the schedule feed removes them

### `eventsActual`

Sparse actual-time overlay.

Sources:

- WSF vessel history during schedule sync
- trip lifecycle transitions during operation

Responsibilities:

- hold actual departure times
- hold actual arrival times

Important behavior:

- only rows with actuals exist
- trip lifecycle transitions project into this table by boundary key

### `eventsPredicted`

Sparse best-prediction overlay.

Sources:

- prediction model output attached to active trips
- WSF ETA when available

Responsibilities:

- store the single best currently displayable predicted time for an event
- retain `PredictionType` and `PredictionSource` for backend debugging

Important behavior:

- the client timeline query does not expose prediction provenance
- precedence is backend-owned
- `vesselTrips` emits prediction projection effects; timeline writes rows but
  does not derive predictions independently
- stale predicted rows are cleared by scoped boundary keys when a trip stops
  emitting a prediction

Current precedence:

- arrival:
  - WSF ETA
  - `AtSeaArriveNext`
  - `AtDockArriveNext`
- next departure:
  - `AtSeaDepartNext`
  - `AtDockDepartNext`
- current departure:
  - `AtDockDepartCurr`

## Core Domain Files

### `events/seed.ts`

Builds in-memory boundary-event records from direct schedule segments.

Responsibilities:

- classify direct physical segments
- create paired `dep-dock` and `arv-dock` records
- normalize identical dock seams
- generate stable event keys

### `events/history.ts`

Hydrates actuals from WSF vessel history into the in-memory schedule seed.

Responsibilities:

- map history rows back onto stable boundary-event keys
- backfill actual departures
- backfill arrival proxy actuals
- resolve minor timing disagreements with replacement thresholds

### `events/liveUpdates.ts`

Shared timeline ordering and seam-normalization helpers.

Responsibilities:

- normalize dock seams
- provide stable sort helpers

### `normalizedEvents.ts`

Converts in-memory ordered boundary-event records into normalized table rows.

Responsibilities:

- build `eventsScheduled` rows
- build `eventsActual` rows
- build `eventsPredicted` rows from trip state

### `rows.ts`

Builds backend-owned `at-dock` / `at-sea` rows from merged boundary events.

Responsibilities:

- build stable row IDs from trip identity
- emit placeholder dock rows only when required
- emit terminal-tail row metadata when the slice ends on an arrival

### `activeRow.ts`

Resolves backend-owned row attachment from live vessel-location state with a
narrow active-trip fallback.

Responsibilities:

- prefer `vesselLocations` for `AtDock` and `Key`
- fall back to `activeVesselTrips` only when a live location row is missing
- use inferred docked trip keys only when live state is docked and keyless
- infer those docked trip keys from the scheduled dock interval, not from the
  next future departure after the observation timestamp
- never guess between same-terminal rows by proximity

### `viewModel.ts`

Assembles the public backend-owned timeline view model from preloaded inputs.

Responsibilities:

- merge scheduled, actual, and predicted overlays by boundary key
- call `rows.ts` for row construction
- call `activeRow.ts` for active-row resolution
- return raw live vessel state needed for frontend rendering decisions
- set `ObservedAt` from `vesselLocations.TimeStamp`

## Function Entrypoints

### `convex/functions/vesselTimeline/actions.ts`

Schedule sync entrypoints.

Responsibilities:

- fetch and transform raw schedule data
- build direct boundary-event records
- merge WSF history actuals
- replace normalized schedule/actual rows for one sailing day
- support windowed and sailing-day-boundary sync

### `convex/functions/vesselTimeline/mutations.ts`

Normalized write layer.

Responsibilities:

- replace `eventsScheduled` and `eventsActual` for a sailing day
- project actual boundary effects emitted by `vesselTrips`
- project predicted boundary effects emitted by `vesselTrips`

### `convex/functions/vesselTimeline/queries.ts`

Thin public timeline-facing read layer.

Responsibilities:

- validate public query args
- load query inputs through `loaders.ts`
- hand plain inputs to the domain read-model builder

### `convex/functions/vesselTimeline/loaders.ts`

Convex-specific loader and query-time inference layer for the public query.

Responsibilities:

- read normalized event tables and live trip/location state
- derive docked and terminal-tail attachment from the loaded event slice plus
  live state
- delegate schedule-backed dock-interval resolution to shared
  `eventsScheduled` query helpers, whose pure selection logic lives in
  `convex/functions/eventsScheduled/segmentResolvers.ts`
- keep `ctx.db` and index-specific orchestration out of the domain layer

## Data Flow

```text
WSF schedule sync
  -> transform raw schedule data
  -> keep direct physical segments only
  -> build boundary-event records
  -> merge WSF history actuals
  -> replace eventsScheduled
  -> replace eventsActual

WSF vessel location ticks
  -> update vesselLocations
  -> update active vessel trips
  -> emit actual boundary effects
  -> project affected eventsActual rows only

Trip / prediction updates
  -> compute best prediction per event key
  -> emit prediction boundary effects
  -> project affected eventsPredicted rows only

Frontend VesselTimeline
  -> query getVesselTimelineViewModel
  -> render backend-owned rows
  -> place indicator using backend-owned activeRowId
  -> keep layout / animation / presentation logic only
```

## Backend Guarantees

- `eventsScheduled` is the structural truth for which boundary events exist
- `eventsActual` and `eventsPredicted` are sparse overlays only
- `eventsActual.Key` and `eventsPredicted.Key` are derived from the canonical
  segment key plus boundary type
- live ticks do not mutate the schedule backbone
- prediction precedence is resolved on the server
- public timeline reads expose stable rows, not raw boundary tables
- dock and sea rows for a trip share the same trip key
- placeholders are backend-emitted fallback only
- terminal-tail is row metadata, not a separate row kind
- `activeRowId` is backend-owned
- delayed docked vessels stay attached to the current dock row when the
  scheduled departure is overdue but still belongs to the active dock interval

## Suggested Reading Order

1. this README
2. `events/seed.ts`
3. `events/history.ts`
4. `events/liveUpdates.ts`
5. `normalizedEvents.ts`
6. `rows.ts`
7. `activeRow.ts`
8. `viewModel.ts`
9. `convex/functions/vesselTimeline/actions.ts`
10. `convex/functions/vesselTimeline/mutations.ts`
11. `convex/functions/vesselTimeline/loaders.ts`
12. `convex/functions/vesselTimeline/queries.ts`
9. `src/features/VesselTimeline/docs/ARCHITECTURE.md`
