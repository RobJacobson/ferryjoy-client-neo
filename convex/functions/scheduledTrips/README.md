# ScheduledTrips (Convex functions)

Thin Convex entrypoints and persistence wiring for the `scheduledTrips` table.
Schedule **business rules** (classification, estimates, linking, prefetch
policies) live under [`convex/domain/scheduledTrips/`](/convex/domain/scheduledTrips/),
while WSF fetch and mapping live under
[`convex/adapters/fetch/`](../../adapters/fetch/) and
[`convex/adapters/pipelines/`](../../adapters/pipelines/) (e.g.
`fetchWsfScheduledTripsData.ts`, `fetchWsfScheduledTrips.ts`).

## Public surface (intended)

- **`queries.ts`** — One public query: `getDirectScheduledTripsByRoutesAndTripDate`
  (used by UnifiedTrips). Other schedule reads use `ctx.db` in feature modules
  (e.g. vessel trip joins by `Key`).
- **`schemas.ts`** — `scheduledTripSchema`, `ConvexScheduledTrip`, and
  `toDomainScheduledTrip`.
- **`constants.ts`** — `scheduledTripsConfig` (rolling sync day counts, purge batch sizes).
- **`actions.ts`** — **Internal** actions only: operator/manual sync
  (`runManualScheduledTripsSync`, `runManualScheduledTripsSyncForDate`), cron
  windowed sync (`syncScheduledTripsWindowed`), and purge
  (`purgeScheduledTripsOutOfDate`). Run manual sync from the repo with
  `bun run sync:scheduled-trips` or `bun run sync:scheduled-trips:date -- '{"targetDate":"YYYY-MM-DD"}'`
  (uses `bunx convex run` — not callable from the app client).
- **`mutations.ts`** — **Internal** mutations only: `replaceScheduledTripsForSailingDay`
  (atomic day replace for sync) and `deleteScheduledTripsBeforeBatch` (purge batches).
- **`sync.ts`** — Non-registered orchestration helpers used by `actions.ts`
  (`syncScheduledTripsForDate`, `syncScheduledTripsForDateRange`).

## Schedule sync orchestration (`sync.ts`)

[`sync.ts`](./sync.ts) is the thin shell for when sync runs: it loads backend
vessel and terminal identity rows, calls the WSF adapter pipeline
(`fetchAndTransformScheduledTrips`), and persists via
[`mutations.ts`](./mutations.ts) `replaceScheduledTripsForSailingDay`.

WSF download, raw schedule types, and raw-segment mapping live in
`convex/adapters/fetch/` and `convex/adapters/pipelines/`. **Schedule transformation rules**
(direct/indirect classification, estimates, official crossing-time policy,
`PrevKey`/`NextKey` linking) live in
[`convex/domain/scheduledTrips/`](/convex/domain/scheduledTrips/).

`vesselTimeline` and timeline reseed reuse the adapter ingress modules or
domain helpers without duplicating business rules.

### WSF data model vs. physical reality

The raw WSF API is passenger-oriented. It often models one physical vessel
movement as multiple logical trips (e.g. on Route 9, one Anacortes departure can
appear as ANA→LOP, ANA→SHI, ANA→FRH). The domain pipeline deduplicates,
classifies direct vs indirect, links `PrevKey`/`NextKey`, backfills estimates, and
normalizes onto the WSF sailing day.

### Adapter ingress (reference)

`convex/adapters/fetch/` and `convex/adapters/pipelines/` own WSF API fetch
wrappers, raw types, route-download normalization,
raw-segment-to-`ConvexScheduledTrip` mapping, and `fetchAndTransformScheduledTrips`
(used by sync and timeline reseed).

### Architecture rule

Domain modules under `convex/domain/` own reusable business logic. This
`functions/scheduledTrips` layer owns Convex registration and persistence.
Adapter modules under `convex/adapters/` own WSF-boundary translation into backend
rows.

## Tests

- **Domain**: `bun test convex/domain/scheduledTrips/**/*.test.ts`
- **Functions**: schema/query wiring only when an adapter contract needs it
  (same convention as [`convex/domain/README.md`](/convex/domain/README.md)).
