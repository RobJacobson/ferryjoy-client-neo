# VesselTrips (Convex functions)

**Architecture (domain):** See [`../../domain/vesselOrchestration/architecture.md`](../../domain/vesselOrchestration/architecture.md) for end-to-end execution paths, glossary, and mental model. **Timestamp semantics:** The canonical timestamp contract (coverage vs physical boundaries, projection rules, and client fallback ownership) lives in the `Timestamp semantics (current code)` section of that same architecture document.

Thin Convex entrypoints for vessel trips (`queries`, `mutations`, `schemas`). Lifecycle logic lives in `convex/domain/vesselOrchestration/updateVesselTrip/` (import via `domain/vesselOrchestration/updateVesselTrip`), while the orchestrator wires targeted schedule reads and prediction staging from [`updateVesselOrchestrator`](../vesselOrchestrator/actions.ts).

- **`queries.ts`** — Indexed reads for active/completed trips used by the app (`getActiveTripsByRoutes`, `getCompletedTripsByRoutesAndTripDate`, `getActiveTripsWithScheduledTrip`) plus `getActiveTrips` for subscriber reads. Delegates prediction enrichment to `mergeTripsWithPredictions` / `dedupeTripDocBatchesByTripKey` from `functions/vesselTrips/read`.
- **`mutations.ts`** — Internal persistence entrypoints (`upsertVesselTripsBatch`, `completeAndStartNewTrip`) for active/completed trip rows. Leave-dock event patches come from domain `updateLeaveDockEventPatch` (`updateLeaveDockEventPatch`) in `runOrchestratorPing`, applied inside `persistVesselUpdates` via `functions/events/eventsPredicted`.
- **`schemas.ts`** — Validators and API/domain conversion helpers.

**Schedule sources:** ping-time enrichment uses targeted `eventsScheduled`-backed continuity queries. Subscriber reads that attach display schedule rows use the `scheduledTrips` table (`getActiveTripsWithScheduledTrip`). Keep behavior aligned when changing either path.

## Tests

- **Domain**: `bun test convex/domain/vesselOrchestration/updateVesselTrip/**/*.test.ts`
- **Schema / wiring**: `bun test convex/functions/vesselTrips/tests/*.test.ts`
