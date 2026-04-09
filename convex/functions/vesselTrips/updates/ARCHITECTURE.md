# VesselTrips `updates/` — module boundaries (Stage 2)

This note complements [`README.md`](./README.md). Stage 1 adds explicit contracts in [`contracts.ts`](./contracts.ts). Stage 2 splits **lifecycle write suppression** from **timeline projection refresh** in [`tripEquality.ts`](./tripEquality.ts) and [`processVesselTrips/processCurrentTrips.ts`](./processVesselTrips/processCurrentTrips.ts). **Stage 3** may tighten import rules (e.g. lifecycle modules not importing projection builders from `domain/vesselTimeline`).

## Checklist

- **Lifecycle** — Trip boundary detection, active/completed persistence, and strip-on-write live in `processVesselTrips/`, `buildTrip.ts`, `buildCompletedTrip.ts`, `mutations.ts` (callers), `stripTripForStorage.ts`. Stored rows omit the five boundary ML fields.
- **Timeline overlays** — `eventsActual` / `eventsPredicted` projection payloads are built in branch processors (`processCompletedTrips`, `processCurrentTrips`) and applied **after** lifecycle mutations succeed (`processVesselTrips`).
- **Read-model hydration** — Queries and orchestrator read models join `eventsPredicted` via `hydrateTripPredictions.ts`; not part of the synchronous tick mutation chain.
- **Orchestrator** — May bundle `activeTrips` into the tick to avoid an extra `getActiveTrips` query; ordering inside `processVesselTrips` is independent of `Promise.allSettled` with `updateVesselLocations`.

## Stage 2 invariants (lifecycle vs projection)

| Concern | Predicate / helper | Compared fields |
|--------|---------------------|-----------------|
| **Persist `activeVesselTrips`** | `shouldPersistLifecycleTrip` → `lifecycleTripsEqual` | Strip both sides with `stripTripPredictionsForStorage`, then deep-compare all keys except `TimeStamp`. The five ML prediction columns do not participate (they are not stored on trip rows). |
| **Refresh `eventsActual` / `eventsPredicted`** | `shouldRefreshTimelineProjection` → `tripsAreEqual` | All non-`TimeStamp` keys; prediction fields use normalized `PredTime` / `Actual` / `DeltaTotal` so ML-only noise does not force refresh. |

**Projection-only ticks** — When lifecycle equality holds but `tripsAreEqual` is false (e.g. joined prediction semantics changed without stored-column churn), `processCurrentTrips` may emit overlay mutations without `upsertVesselTripsBatch`. Effects that require a durable row written this tick remain gated: `setDepartNextActualsForMostRecentCompletedTrip` still runs only after a successful upsert; tagged overlays use `requiresSuccessfulUpsert` to correlate with batch outcomes.

## Forward (Stage 3)

- Document allowed shared types vs forbidden projection-builder imports from lifecycle files when that stage lands.
