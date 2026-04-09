# VesselTrips `updates/` — module boundaries (Stage 3)

This note complements [`README.md`](./README.md). Stage 1 adds explicit contracts in [`contracts.ts`](./contracts.ts). Stage 2 splits **lifecycle write suppression** from **timeline projection refresh** in [`tripEquality.ts`](./tripEquality.ts) and [`processVesselTrips/processCurrentTrips.ts`](./processVesselTrips/processCurrentTrips.ts). **Stage 3** moves timeline projection **builders** into [`timelineProjectionProjector.ts`](./timelineProjectionProjector.ts); lifecycle branch files emit DTO facts/intents only (see [`projectionContracts.ts`](./projectionContracts.ts)).

## Checklist

- **Lifecycle** — Trip boundary detection, active/completed persistence, and strip-on-write live in `processVesselTrips/`, `buildTrip.ts`, `buildCompletedTrip.ts`, `mutations.ts` (callers), `stripTripForStorage.ts`. Stored rows omit the five boundary ML fields.
- **Timeline overlays** — `eventsActual` / `eventsPredicted` payloads are built in [`timelineProjectionProjector.ts`](./timelineProjectionProjector.ts) from branch-emitted facts/intents. In-memory assembly runs after each branch returns; `projectActualBoundaryPatches` / `projectPredictedBoundaryEffects` run **only after** all lifecycle mutations for the tick (`processVesselTrips`).
- **Read-model hydration** — Queries and orchestrator read models join `eventsPredicted` via `hydrateTripPredictions.ts`; not part of the synchronous tick mutation chain.
- **Orchestrator** — May bundle `activeTrips` into the tick to avoid an extra `getActiveTrips` query; ordering inside `processVesselTrips` is independent of `Promise.allSettled` with `updateVesselLocations`.

## Stage 2 invariants (lifecycle vs projection)

| Concern | Predicate / helper | Compared fields |
|--------|---------------------|-----------------|
| **Persist `activeVesselTrips`** | `shouldPersistLifecycleTrip` → `lifecycleTripsEqual` | Strip both sides with `stripTripPredictionsForStorage`, then deep-compare all keys except `TimeStamp`. The five ML prediction columns do not participate (they are not stored on trip rows). |
| **Refresh `eventsActual` / `eventsPredicted`** | `shouldRefreshTimelineProjection` → `tripsAreEqual` | All non-`TimeStamp` keys; prediction fields use normalized `PredTime` / `Actual` / `DeltaTotal` so ML-only noise does not force refresh. |

**Projection-only ticks** — When lifecycle equality holds but `tripsAreEqual` is false (e.g. joined prediction semantics changed without stored-column churn), `processCurrentTrips` may emit overlay mutations without `upsertVesselTripsBatch`. Effects that require a durable row written this tick remain gated: `setDepartNextActualsForMostRecentCompletedTrip` still runs only after a successful upsert; tagged overlays use `requiresSuccessfulUpsert` to correlate with batch outcomes.

## Stage 3 import rules (lifecycle vs projector)

**Forbidden** in [`processVesselTrips/processCurrentTrips.ts`](./processVesselTrips/processCurrentTrips.ts) and [`processVesselTrips/processCompletedTrips.ts`](./processVesselTrips/processCompletedTrips.ts):

- `domain/vesselTimeline/normalizedEvents` (projection builders such as `buildPredictedBoundaryProjectionEffect`)
- [`actualBoundaryPatchesFromTrip.ts`](./actualBoundaryPatchesFromTrip.ts) (`buildDepartureActualPatchForTrip`, `buildArrivalActualPatchForTrip`)

**Allowed** in those lifecycle files:

- Shared DTO types from [`projectionContracts.ts`](./projectionContracts.ts) and tick types from [`contracts.ts`](./contracts.ts)

**Owned by** [`timelineProjectionProjector.ts`](./timelineProjectionProjector.ts): imports above, plus merging tagged intents with upsert success sets from `processCurrentTrips`.

**Review check:** `rg` the two forbidden paths from the lifecycle branch files; expect no matches.
