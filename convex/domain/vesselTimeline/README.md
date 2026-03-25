## VesselTimeline Backend Domain

This folder contains the backend domain logic for the normalized
boundary-event-based `VesselTimeline` system.

There is no snapshot layer and no legacy vessel/day event table. The backend
persists only three normalized tables:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

The frontend composes timeline structure and active state from those tables plus
the current `vesselLocations` row.

## Overview

`VesselTimeline` is modeled as a sequence of dock-boundary events:

- departure from dock
- arrival at dock

The backend persists those boundaries in normalized form, split by update
cadence:

- schedule backbone
- actual overlay
- prediction overlay

Everything else is derived.

## Sources Of Truth

### `eventsScheduled`

Structural source of truth for the timeline.

Source:

- direct physical schedule segments from transformed WSF schedule data

Responsibilities:

- define which boundary events exist for the vessel/day
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
- live `vesselLocations` updates during operation

Responsibilities:

- hold actual departure times
- hold actual arrival times
- support false-departure unwind

Important behavior:

- only rows with actuals exist
- live updates rewrite only this table for the affected vessel/day

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

Applies live vessel-location evidence to an in-memory ordered boundary-event
array.

Responsibilities:

- determine sailing day for a live location
- resolve strong departures
- resolve strong arrivals
- unwind false departures
- normalize dock seams
- provide stable event-key construction and sort helpers

Important current behavior:

- this flow now owns actuals only
- live location ticks do not write predicted times into event rows

### `normalizedEvents.ts`

Converts in-memory ordered boundary-event records into normalized table rows.

Responsibilities:

- build `eventsScheduled` rows
- build `eventsActual` rows
- build `eventsPredicted` rows from trip state

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
- apply live actual updates from `vesselLocations`
- upsert best-prediction rows from active trip state

### `convex/functions/vesselTimeline/queries.ts`

Timeline-facing read layer.

Responsibilities:

- return scheduled rows for one vessel/day
- return actual overlay rows for one vessel/day
- return prediction overlay rows for one vessel/day

Important behavior:

- prediction queries hide `PredictionType` and `PredictionSource`

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
  -> resolve actual boundary changes
  -> replace affected eventsActual rows only

Trip / prediction updates
  -> compute best prediction per event key
  -> upsert eventsPredicted

Frontend VesselTimeline
  -> query eventsScheduled
  -> query eventsActual
  -> query eventsPredicted
  -> query vesselLocations
  -> merge rows client-side
  -> build segments client-side
  -> resolve active state client-side
  -> render UX-specific timeline rows
```

## Backend Guarantees

- `eventsScheduled` is the structural truth for which boundary events exist
- `eventsActual` and `eventsPredicted` are sparse overlays only
- live ticks do not mutate the schedule backbone
- prediction precedence is resolved on the server
- the client never needs to understand prediction provenance
- no snapshot persistence exists in the backend

## Suggested Reading Order

1. this README
2. `events/seed.ts`
3. `events/history.ts`
4. `events/liveUpdates.ts`
5. `normalizedEvents.ts`
6. `convex/functions/vesselTimeline/actions.ts`
7. `convex/functions/vesselTimeline/mutations.ts`
8. `convex/functions/vesselTimeline/queries.ts`
9. `src/features/VesselTimeline/docs/ARCHITECTURE.md`
