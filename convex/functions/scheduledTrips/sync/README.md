# Scheduled Trips Sync Module

This module owns the backend pipeline that turns raw Washington State Ferries
(WSF) schedule data into persistence-ready `scheduledTrips` rows.

## Why This Lives Under `functions/scheduledTrips`

`scheduledTrips/sync` controls:

1. when schedule downloads run
2. how raw WSF data is mapped into backend records
3. orchestration of fetch, domain transformation, and persistence

**Schedule transformation rules** (direct/indirect classification, estimates,
official crossing-time policy, `PrevKey`/`NextKey` linking) live in
[`convex/domain/scheduledTrips/`](/convex/domain/scheduledTrips/). This folder
holds Convex actions, mutations, queries, schemas, WSF download/mapping, and the
thin `fetchAndTransform` adapter that delegates transformation to the domain
module.

`vesselTimeline` and timeline reseed reuse `fetchAndTransform` or domain helpers
without duplicating business rules.

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

WSF API download and raw segment mapping. Segment rows are turned into initial
`ConvexScheduledTrip` shapes via `buildInitialScheduledTripRow` in
[`convex/domain/scheduledTrips/buildInitialScheduledTripRow.ts`](/convex/domain/scheduledTrips/buildInitialScheduledTripRow.ts)
(prefetch policies such as Route 9 `SchedArriveCurr` live there).

### `fetchAndTransform.ts`

Shared orchestration used by ScheduledTrips sync and VesselTimeline sync:

- fetch active routes
- download raw route schedule data
- map raw segments into `ConvexScheduledTrip` rows
- run `runScheduleTransformPipeline` from `convex/domain/scheduledTrips`

### `persistence.ts`

Atomic replacement of one sailing day's `scheduledTrips` rows.

### `sync.ts`

High-level date and date-range sync entrypoints.

## Architecture Rule

Domain modules under `convex/domain/` own reusable business logic. The
`functions/scheduledTrips` layer owns Convex registration, persistence, and
schedule fetch/mapping to `ConvexScheduledTrip` rows.
