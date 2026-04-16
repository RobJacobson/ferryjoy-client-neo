# VesselTrips (Convex functions)

Thin Convex entrypoints for vessel trips (`queries`, `mutations`, `schemas`;
lifecycle logic lives in `convex/domain/vesselTrips/`, and boundary adapters
live in `convex/adapters/vesselTrips/`).

- **`queries.ts`** — Indexed reads for active/completed trips used by the app
  (`getActiveTripsByRoutes`, `getCompletedTripsByRoutesAndTripDate`,
  `getActiveTripsWithScheduledTrip`) plus `getActiveTrips` for subscriber reads.
  Delegates prediction enrichment to
  `domain/vesselTrips/read/`.
- **`mutations.ts`** — Persistence (`upsertVesselTripsBatch`, `completeAndStartNewTrip`)
  and depart-next backfill on `eventsPredicted`; policy helpers in
  `domain/vesselTrips/mutations/`.
- **`schemas.ts`** — Validators and API/domain conversion helpers.
- **`../adapters/vesselTrips/processTick.ts`** — Default `processVesselTripsWithDeps`
  dependency wiring plus schedule lookup adapters (`appendFinalSchedule`,
  `resolveEffectiveLocation`).

**Schedule sources:** tick-time enrichment uses `eventsScheduled`-backed internal
queries (`appendFinalSchedule`). Subscriber reads that attach display schedule
rows use the `scheduledTrips` table (`getActiveTripsWithScheduledTrip`). Keep
behavior aligned when changing either path.

## Tests

- **Domain**: `bun test convex/domain/vesselTrips/**/*.test.ts`
- **Schema / wiring**: `bun test convex/functions/vesselTrips/tests/*.test.ts`
