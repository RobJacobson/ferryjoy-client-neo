# ScheduledTrips (Convex functions)

Thin Convex entrypoints and WSF I/O for the `scheduledTrips` table. Schedule
**business rules** (classification, estimates, linking, prefetch policies) live
under [`convex/domain/scheduledTrips/`](/convex/domain/scheduledTrips/).

## Public surface (intended)

- **`actions.ts`** — Manual/windowed sync and purge jobs (`syncScheduledTrips*`,
  `purgeScheduledTripsOutOfDate`).
- **`mutations.ts`** — Day-scoped delete/insert and batched purge by departure
  time.
- **`queries.ts`** — Indexed reads for routes, terminals, vessels, and internal
  schedule lookups used by trip lifecycle.
- **`schemas.ts`** — `scheduledTripSchema`, `ConvexScheduledTrip`, and
  `toDomainScheduledTrip`.

## Internal adapters

The **`sync/`** subtree is the fetch → map → domain pipeline → persist adapter
(WSF download, raw-segment mapping, `runScheduleTransformPipeline`, atomic day
replace). Other modules may import from `sync/` paths; prefer the files above
for new Convex-facing code.

For the pipeline narrative, see
[`sync/README.md`](./sync/README.md).

## Tests

- **Domain**: `bun test convex/domain/scheduledTrips/**/*.test.ts`
- **Functions**: schema/query wiring only when an adapter contract needs it
  (same convention as [`convex/domain/README.md`](/convex/domain/README.md)).
