# Scheduled Trips Sync Module

This module owns the backend pipeline that turns raw Washington State Ferries
(WSF) schedule data into persistence-ready `scheduledTrips` rows.

## Why This Lives Under `functions/scheduledTrips`

The schedule transform is backend-owned logic, not a standalone top-level
domain. `scheduledTrips/sync` controls:

1. when schedule downloads run
2. how raw WSF data is mapped into backend records
3. how trips are transformed into physical sailings
4. how the final rows are persisted

That makes `functions/scheduledTrips/sync` the natural home for the full
fetch-transform-persist pipeline.

`vesselTimeline` may still reuse parts of this pipeline, but it does so by
importing from the ScheduledTrips-owned module rather than from a separate
top-level `domain/scheduledTrips` layer.

## WSF Data Model vs. Physical Reality

The raw WSF API is passenger-oriented. It often models one physical vessel
movement as multiple logical trips.

### The San Juan Islands Problem

On Route 9, a single vessel departure from Anacortes can appear as multiple
logical trips:

1. ANA -> LOP
2. ANA -> SHI
3. ANA -> FRH

Physically, that is one sailing: `ANA -> LOP -> SHI -> FRH`.

To keep FerryJoy aligned with physical vessel movement, the sync pipeline:

1. deduplicates one physical departure from many logical rows
2. identifies the direct next stop versus indirect downstream stops
3. links vessel-day sailings with `PrevKey` and `NextKey`
4. backfills arrival estimates for indirect rows
5. normalizes everything onto the WSF sailing day

## Pipeline Structure

### `fetching/`

WSF API download and raw segment mapping.

### `fetchAndTransform.ts`

Shared orchestration used by ScheduledTrips sync and VesselTimeline sync:

- fetch active routes
- download raw route schedule data
- map raw segments into `ConvexScheduledTrip` rows
- run the transform pipeline

### `transform/`

Pure scheduled-trips transformation steps:

- `grouping.ts`: physical-departure grouping helpers
- `directSegments.ts`: direct vs indirect classification helpers
- `classification.ts`: transform classification step
- `estimates.ts`: arrival estimation and `PrevKey`/`NextKey` linking
- `officialCrossingTimes.ts`: curated scheduled-arrival fallback durations
- `pipeline.ts`: top-level transform coordinator

### `persistence.ts`

Atomic replacement of one sailing day's `scheduledTrips` rows.

### `sync.ts`

High-level date and date-range sync entrypoints.

## Architecture Rule

Top-level `convex/domain/*` should be reserved for logic that is not owned by a
single backend module and is not tightly coupled to backend persistence-shaped
records.

This schedule pipeline is owned by `functions/scheduledTrips`, so it stays
there end to end.
