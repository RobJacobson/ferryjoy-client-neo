## VesselTimeline Backend Domain

This folder contains the backend domain logic that exists specifically to
support `VesselTimeline`.

The backend is split into two read-model layers:

- `events/`: the mutable vessel/day boundary-event feed stored in
  `vesselTripEvents`
- `snapshots/`: the derived semantic vessel/day snapshot stored in
  `vesselTimelineSnapshots`

The public feature contract is described in
`src/features/VesselTimeline/docs/ARCHITECTURE.md`.

## Overview

`VesselTimeline` renders one continuous service-day timeline for one vessel on
one sailing day.

The backend owns source reconciliation and exposes two complementary payloads:

- a stable semantic snapshot for timeline structure
- a compact active-state payload for fast-changing live indicator state

The lower-level event feed is the source for both.

## Read-Model Layers

### `events/`

`events/` owns the mutable vessel/day boundary-event read model persisted in
`vesselTripEvents`.

Responsibilities:

- seed departure and arrival dock-boundary rows from direct physical schedule
  segments
- merge WSF history into seeded rows
- apply live vessel-location predictions and actuals
- preserve historical truth across schedule reseeds
- resolve active row state from existing event rows plus live location

Stored fields:

- `Key`
- `VesselAbbrev`
- `SailingDay`
- `ScheduledDeparture`
- `TerminalAbbrev`
- `EventType`
- `ScheduledTime?`
- `PredictedTime?`
- `ActualTime?`

### `snapshots/`

`snapshots/` owns the derived semantic snapshot persisted in
`vesselTimelineSnapshots`.

Responsibilities:

- convert ordered normalized boundary events into semantic dock and sea
  segments
- insert synthetic start-of-day and broken-seam placeholders when required
- append the terminal-tail dock segment after the final arrival
- produce a stable comparable payload so unchanged snapshots are not rewritten

## Function Entrypoints

`convex/functions/vesselTripEvents/` is still the operational entrypoint for
seed, reseed, live-update, and active-state work.

- `actions.ts`
  - scheduled and manual sync/reset entrypoints for the event read model
- `mutations.ts`
  - persists event updates and synchronizes derived snapshots
- `queries.ts`
  - exposes the event feed and active-state query

`convex/functions/vesselTimeline/` exposes snapshot reads.

- `queries.ts`
  - reads persisted `vesselTimelineSnapshots`

## Data Flow

```text
WSF schedule sync
  -> classify direct physical segments
  -> build dep/arv event skeleton
  -> merge WSF history actuals
  -> reseed/replace vesselTripEvents
  -> rebuild vesselTimelineSnapshots from ordered events

WSF vessel location ticks
  -> apply predictions/actuals to existing vesselTripEvents rows
  -> rebuild affected vesselTimelineSnapshots

Frontend VesselTimeline
  -> query vesselTimelineSnapshots for stable timeline structure
  -> query vesselTripEvents active-state endpoint for live indicator state
```

## Invariants

- `Key` must remain stable for the same logical schedule boundary
- only direct physical scheduled segments should seed rows
- historical rows must not be destroyed by mid-day schedule churn
- future rows remain schedule-owned until they become present or historical
- active-state matching must use existing event keys, not array indices
- snapshots are derived from ordered normalized event rows
- unchanged snapshots should not be rewritten

## File Map

### `events/`

- `activeState.ts`
  - resolves the compact live active-state snapshot
- `history.ts`
  - merges WSF history actuals into seeded rows
- `index.ts`
  - re-exports event-domain helpers
- `liveUpdates.ts`
  - applies live vessel-location evidence and owns event-key helpers
- `reseed.ts`
  - merges fresh seed data with existing rows safely
- `seed.ts`
  - builds schedule-derived departure and arrival boundary events

### `snapshots/`

- `buildSnapshot.ts`
  - converts ordered event rows into persisted semantic snapshot segments

### `tests/`

- `activeState.test.ts`
- `buildSnapshot.test.ts`
- `history.test.ts`
- `reseed.test.ts`
- `seed.test.ts`

## Suggested Reading Order

1. this README
2. `events/reseed.ts`
3. `events/liveUpdates.ts`
4. `events/activeState.ts`
5. `snapshots/buildSnapshot.ts`
6. `convex/functions/vesselTripEvents/mutations.ts`
7. `convex/functions/vesselTripEvents/queries.ts`
8. `src/features/VesselTimeline/docs/ARCHITECTURE.md`
