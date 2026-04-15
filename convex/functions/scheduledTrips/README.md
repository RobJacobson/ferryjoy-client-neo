# ScheduledTrips (Convex functions)

Thin Convex entrypoints and persistence wiring for the `scheduledTrips` table.
Schedule **business rules** (classification, estimates, linking, prefetch
policies) live under [`convex/domain/scheduledTrips/`](/convex/domain/scheduledTrips/),
while WSF fetch and mapping live under
[`convex/adapters/wsf/scheduledTrips/`](/convex/adapters/wsf/scheduledTrips/).

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

The **`sync/`** subtree now stays thin and owns:

- when scheduled-trips sync runs
- loading backend identity rows needed for the adapter layer
- atomic replacement of one sailing day's persisted `scheduledTrips` rows

WSF download, raw schedule types, raw-segment mapping, and the shared
fetch-and-transform flow now live in `convex/adapters/wsf/scheduledTrips/`.
Other modules should import the adapter layer directly instead of deep
`functions/scheduledTrips/sync/*` paths.

For the pipeline narrative, see
[`sync/README.md`](./sync/README.md).

## Tests

- **Domain**: `bun test convex/domain/scheduledTrips/**/*.test.ts`
- **Functions**: schema/query wiring only when an adapter contract needs it
  (same convention as [`convex/domain/README.md`](/convex/domain/README.md)).
