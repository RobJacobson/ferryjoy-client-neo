# Scheduled Trips Sync Module

This module owns the thin Convex-facing shell for scheduled-trips sync.

WSF download, raw schedule types, and raw-segment mapping now live in
`convex/adapters/wsf/scheduledTrips/`. This folder remains responsible for
when sync runs, loading backend identity snapshots for the adapter layer, and
persisting the final `scheduledTrips` rows.

## Why This Lives Under `functions/scheduledTrips`

`scheduledTrips/sync` controls:

1. when schedule downloads run
2. how backend identity rows are loaded for adapter translation
3. orchestration of adapter ingress, domain transformation, and persistence

**Schedule transformation rules** (direct/indirect classification, estimates,
official crossing-time policy, `PrevKey`/`NextKey` linking) live in
[`convex/domain/scheduledTrips/`](/convex/domain/scheduledTrips/). WSF-specific
boundary translation lives in `convex/adapters/wsf/scheduledTrips/`.

`vesselTimeline` and timeline reseed reuse the adapter ingress modules or
domain helpers without duplicating business rules.

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

### `sync.ts`

High-level date and date-range sync entrypoints.

This file:

- loads backend vessel and terminal identity rows
- calls the shared WSF adapter ingress pipeline
- persists the transformed rows atomically for one sailing day

### Adapter ingress

`convex/adapters/wsf/scheduledTrips/` now owns:

- WSF API fetch wrappers
- raw WSF schedule types
- raw route-download normalization
- raw-segment-to-`ConvexScheduledTrip` mapping
- the shared `fetchAndTransformScheduledTrips` flow used by sync and timeline reseed

### `persistence.ts`

Atomic replacement of one sailing day's `scheduledTrips` rows.

## Architecture Rule

Domain modules under `convex/domain/` own reusable business logic. The
`functions/scheduledTrips` layer owns Convex registration and persistence.
`convex/adapters/wsf/scheduledTrips/` owns WSF-boundary translation into
backend rows.
