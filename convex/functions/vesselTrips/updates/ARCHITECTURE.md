# VesselTrips `updates/` — module boundaries (Stage 3–5)

This note complements [`README.md`](./README.md).

## Stage 5 folder map

| Folder | Role |
|--------|------|
| [`tripLifecycle/`](./tripLifecycle/) | Trip boundary detection (`detectTripEvents.ts`, `tripEventTypes.ts`), builders (`buildTrip`, `buildCompletedTrip`, …), branch processors (`processCurrentTrips`, `processCompletedTrips`), equality and derivation helpers. |
| [`projection/`](./projection/) | Timeline event assembly: `timelineEventAssembler`, DTOs (`lifecycleEventMessages`), `actualBoundaryPatchesFromTrip`. |
| [`processTick/`](./processTick/) | Per-tick orchestration: `tickEventWrites.ts`, `tickEnvelope.ts`, `tickPredictionPolicy.ts`, and `processVesselTrips` entrypoint. |
| [`index.ts`](./index.ts) | **Public barrel** — re-exports `processVesselTrips` and tick types (`VesselTripsTickResult`, `ProcessVesselTripsOptions`). Each `.ts` file under the folders above remains a **separate Convex module** for registration; the barrel does not replace individual files. |
| [`tests/`](./tests/) | All update-pipeline tests stay here (not nested under subfolders). |

**Import rule:** Code outside `updates/` (e.g. `vesselOrchestrator`) should import the tick API from `functions/vesselTrips/updates` (the barrel). Tests may import `processVesselTripsWithDeps` from `functions/vesselTrips/updates/processTick/processVesselTrips` when injecting deps.

---

Stage 1 adds [`processTick/tickEventWrites.ts`](./processTick/tickEventWrites.ts) and [`processTick/tickEnvelope.ts`](./processTick/tickEnvelope.ts). Stage 2 splits **lifecycle write suppression** from **timeline overlay refresh** in [`tripLifecycle/tripEquality.ts`](./tripLifecycle/tripEquality.ts) and [`tripLifecycle/processCurrentTrips.ts`](./tripLifecycle/processCurrentTrips.ts). **Stage 3** moves assembly into [`projection/timelineEventAssembler.ts`](./projection/timelineEventAssembler.ts); lifecycle branch files emit facts/messages only (see [`projection/lifecycleEventMessages.ts`](./projection/lifecycleEventMessages.ts)). **Stage 4** pins the tick input contract: preloaded `activeTrips` are **storage-native** [`TickActiveTrip`](../schemas.ts) rows (or transitional hydrated [`ConvexVesselTrip`](../schemas.ts)); public `getActiveTrips` remains **hydrated** for subscribers; the orchestrator bundles storage rows from [`getOrchestratorTickReadModelInternal`](../../vesselOrchestrator/queries.ts) so the tick does not run an extra `getActiveTrips` round trip. **Peer orchestration:** [`applyTickEventWrites`](../../vesselOrchestrator/applyTickEventWrites.ts) applies `TickEventWrites` after `processVesselTrips` returns.

## Checklist

- **Lifecycle** — Trip boundary detection, active/completed persistence, and strip-on-write live in `tripLifecycle/`, `buildTrip.ts`, `buildCompletedTrip.ts`, `mutations.ts` (callers), `stripTripForStorage.ts`. Stored rows omit the five boundary ML fields.
- **Timeline overlays** — `eventsActual` / `eventsPredicted` payloads are built in [`projection/timelineEventAssembler.ts`](./projection/timelineEventAssembler.ts) from branch-emitted facts/messages. Orchestrator runs `applyTickEventWrites` **only after** lifecycle mutations complete inside `processVesselTrips`.
- **Read-model hydration** — Public queries join `eventsPredicted` via [`hydrateTripPredictions.ts`](../hydrateTripPredictions.ts); **not** used on the orchestrator tick bundle (storage-native `activeVesselTrips` only). Not part of the synchronous tick mutation chain beyond optional fallback `getActiveTrips` when no preload is passed.
- **Orchestrator** — Bundles **storage-native** `activeTrips` into the tick to avoid an extra `getActiveTrips` query; ordering inside `processVesselTrips` is independent of `Promise.allSettled` with `updateVesselLocations`.

## Stage 4 (tick read model vs queries)

| Path | Active trips shape | Hydration |
|------|-------------------|-----------|
| `getOrchestratorTickReadModelInternal` → `processVesselTrips` | `TickActiveTrip` / persisted columns | None |
| `getActiveTrips` (fallback when no preload) | `ConvexVesselTrip` | `hydrateStoredTripsWithPredictions` |
| Public route/day queries | `ConvexVesselTrip` | `hydrateStoredTripsWithPredictions` |

**Non-atomic action note** — `updateVesselOrchestrator` runs location storage and the trip branch (`processVesselTrips` + `applyTickEventWrites`) in parallel (`Promise.allSettled`). If lifecycle mutations succeed and a later timeline mutation fails, the tick logs branch errors; callers rely on idempotent writes on retry.

## Stage 2 invariants (lifecycle vs projection)

| Concern | Predicate / helper | Compared fields |
|--------|---------------------|-----------------|
| **Persist `activeVesselTrips`** | `!tripsEqualForStorage` (internally `lifecycleTripsEqual`) | Strip both sides with `stripTripPredictionsForStorage`, then deep-compare all keys except `TimeStamp`. The five ML prediction columns do not participate (they are not stored on trip rows). |
| **Refresh `eventsActual` / `eventsPredicted`** | `!tripsEqualForOverlay` (internally `overlayTripsEqual`) | All non-`TimeStamp` keys; prediction fields use normalized `PredTime` / `Actual` / `DeltaTotal` so ML-only noise does not force refresh. |

**Projection-only ticks** — When `tripsEqualForStorage` is true but `tripsEqualForOverlay` is false (e.g. joined prediction semantics changed without stored-column churn), `processCurrentTrips` may emit overlay mutations without `upsertVesselTripsBatch`. Effects that require a durable row written this tick remain gated: `setDepartNextActualsForMostRecentCompletedTrip` still runs only after a successful upsert; tagged overlays use `requiresSuccessfulUpsert` to correlate with batch outcomes.

## Stage 3 import rules (lifecycle vs projector)

**Forbidden** in [`tripLifecycle/processCurrentTrips.ts`](./tripLifecycle/processCurrentTrips.ts) and [`tripLifecycle/processCompletedTrips.ts`](./tripLifecycle/processCompletedTrips.ts):

- `domain/vesselTimeline/normalizedEvents` (projection builders such as `buildPredictedBoundaryProjectionEffect`)
- [`projection/actualBoundaryPatchesFromTrip.ts`](./projection/actualBoundaryPatchesFromTrip.ts) (`buildDepartureActualPatchForTrip`, `buildArrivalActualPatchForTrip`)

**Allowed** in those lifecycle files:

- Shared DTO types from [`projection/lifecycleEventMessages.ts`](./projection/lifecycleEventMessages.ts) and tick write types from [`processTick/tickEventWrites.ts`](./processTick/tickEventWrites.ts)

**Owned by** [`projection/timelineEventAssembler.ts`](./projection/timelineEventAssembler.ts): imports above, plus merging tagged messages with upsert success sets from `processCurrentTrips`.

**Review check:** `rg` the two forbidden paths from the lifecycle branch files; expect no matches.
