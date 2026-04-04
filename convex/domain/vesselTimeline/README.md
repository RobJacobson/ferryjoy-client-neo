## VesselTimeline Backend Domain

This folder contains the backend domain logic for the normalized
boundary-event-based `VesselTimeline` system.

There is no snapshot layer and no legacy vessel/day event table. The backend
persists only three normalized tables:

- `eventsScheduled`
- `eventsActual`
- `eventsPredicted`

The backend now composes a public event-first read model from those tables plus
live vessel state. The frontend derives rows locally from backend events and
uses one backend-owned `activeInterval` to ground the live indicator.
When the visible day starts with a departure, the read path may also prepend
the previous sailing day's final arrival event so the first dock interval can
be rendered with its real arrival time.

The implementation boundary is now explicit:

- `convex/functions/vesselTimeline/*` owns Convex entrypoints, table reads, and
  query-time data loading
- `convex/domain/vesselTimeline/*` owns pure event and read-model logic over
  plain objects

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

- event overlays and stable ordering
- active-interval attachment
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
- mark the final arrival of the sailing day for indexed carry-in lookup

Important behavior:

- replace-only during schedule sync
- never mutated by live vessel-location updates
- removed sailings disappear when the schedule feed removes them
- the final arrival row is flagged with `IsLastArrivalOfSailingDay`

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

### `timelineEvents.ts`

Builds the event-first public read backbone from normalized tables.

Responsibilities:

- merge `eventsScheduled`, `eventsActual`, and `eventsPredicted` by key
- attach `SegmentKey`
- sort same-day events into stable timeline order

### `activeInterval.ts`

Resolves the backend-owned active interval from live vessel-location state.

Responsibilities:

- use `vesselLocations` as the only live-state source for query-time
  attachment
- use `vesselLocations.Key` only as a same-day at-sea identity hint
- resolve docked attachment directly from ordered events plus the observed dock
  terminal, including one carry-in arrival when the day starts at dock
- return `null` when no live location row or no same-day event evidence exists
- never guess between same-terminal trips by proximity

### `viewModel.ts`

Assembles the public backend-owned event-first timeline view model from
preloaded inputs.

Responsibilities:

- call `timelineEvents.ts` for event construction
- call `activeInterval.ts` for active-interval resolution
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

Convex-specific loader for the public query.

Responsibilities:

- read normalized event tables plus `vesselLocations`
- keep the primary event slice scoped to the requested sailing day
- do one indexed previous-day lookup for the flagged final arrival when the
  first visible interval needs an overnight carry-in anchor
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
  -> derive rows from backend events
  -> place indicator using backend-owned activeInterval
  -> keep layout / animation / presentation logic only
```

## Backend Guarantees

- `eventsScheduled` is the structural truth for which boundary events exist
- `eventsActual` and `eventsPredicted` are sparse overlays only
- `eventsActual.Key` and `eventsPredicted.Key` are derived from the canonical
  segment key plus boundary type
- the requested sailing day is a hard ownership boundary for public timeline
  reads
- `vesselTimeline` derives same-day dock ownership from `eventsScheduled`, not
  from `scheduledTrips`
- `vesselLocations` is the only live-state source used by the timeline query
- live ticks do not mutate the schedule backbone
- prediction precedence is resolved on the server
- public timeline reads expose stable ordered events plus `activeInterval`
- the frontend derives rows from events as presentation logic
- `activeInterval` is backend-owned
- `activeInterval` may be `null` when same-day event evidence is insufficient
- delayed docked vessels stay attached to the current dock row when the
  same-day schedule slice proves that dock ownership

## Suggested Reading Order

1. this README
2. `events/seed.ts`
3. `events/history.ts`
4. `events/liveUpdates.ts`
5. `normalizedEvents.ts`
6. `timelineEvents.ts`
7. `activeInterval.ts`
8. `viewModel.ts`
9. `convex/functions/vesselTimeline/actions.ts`
10. `convex/functions/vesselTimeline/mutations.ts`
11. `convex/functions/vesselTimeline/loaders.ts`
12. `convex/functions/vesselTimeline/queries.ts`
13. `src/features/VesselTimeline/docs/ARCHITECTURE.md`
