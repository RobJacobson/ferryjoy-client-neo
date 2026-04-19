# VesselTrips (Convex functions)

**Architecture (domain):** See [`../../domain/vesselOrchestration/architecture.md`](../../domain/vesselOrchestration/architecture.md) for end-to-end execution paths, glossary, and mental model.

Thin Convex entrypoints for vessel trips (`queries`, `mutations`, `schemas`;
lifecycle logic lives in `convex/domain/vesselOrchestration/updateVesselTrips/` (import via
`domain/vesselOrchestration/updateVesselTrips`), and boundary adapters are wired via
`createDefaultProcessVesselTripsDeps` with **`createScheduledSegmentLookupFromSnapshot`**
(after **`getScheduleSnapshotForTick`**) and `createVesselTripPredictionModelAccess`
(wired from [`updateVesselOrchestrator`](../vesselOrchestrator/actions.ts)).

- **`queries.ts`** — Indexed reads for active/completed trips used by the app
  (`getActiveTripsByRoutes`, `getCompletedTripsByRoutesAndTripDate`,
  `getActiveTripsWithScheduledTrip`) plus `getActiveTrips` for subscriber reads.
  Delegates prediction enrichment to `mergeTripsWithPredictions` /
  `dedupeTripDocBatchesByTripKey` from `domain/vesselOrchestration/updateVesselTrips`.
- **`mutations.ts`** — Persistence (`upsertVesselTripsBatch`, `completeAndStartNewTrip`)
  and depart-next backfill on `eventsPredicted`; policy helpers such as
  `resolveDepartNextLegContext` from `domain/vesselOrchestration/updateVesselTrips`.
- **`schemas.ts`** — Validators and API/domain conversion helpers.

**Schedule sources:** tick-time enrichment uses `eventsScheduled`-backed internal
queries (`appendFinalSchedule`). Subscriber reads that attach display schedule
rows use the `scheduledTrips` table (`getActiveTripsWithScheduledTrip`). Keep
behavior aligned when changing either path.

## Tests

- **Domain**: `bun test convex/domain/vesselOrchestration/updateVesselTrips/**/*.test.ts`
- **Schema / wiring**: `bun test convex/functions/vesselTrips/tests/*.test.ts`
