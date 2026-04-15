# VesselTrips `updates/`

This module is the canonical write pipeline for vessel-trip lifecycle updates.
It runs once per orchestrator tick and converts feed snapshots into:

- lifecycle writes for `activeVesselTrips` / `completedVesselTrips`, and
- deferred timeline write intents (`TickEventWrites`) for `eventsActual` and
  `eventsPredicted`.

`processVesselTrips` is the public entrypoint (`updates/index.ts`).
`applyTickEventWrites` in `vesselOrchestrator` is a peer step that executes
after lifecycle work completes.

---

## Public API and contract

`updates/index.ts` re-exports:

- `processVesselTrips`
- `ProcessVesselTripsOptions`
- `VesselTripsTickResult`

### `processVesselTrips` inputs

- `ctx`: Convex action context.
- `locations`: current tick `ConvexVesselLocation[]`.
- `tickStartedAt`: orchestrator-owned timestamp.
- `activeTrips?`: optional preloaded active-trip snapshot.
  - if defined (including `[]`), the module does not call `getActiveTrips`.
  - if undefined, the module queries `functions.vesselTrips.queries.getActiveTrips`.
- `options?.shouldRunPredictionFallback`: optional override for fallback window.

### `processVesselTrips` output

`VesselTripsTickResult`:

- `tickStartedAt`
- `activeTripsSource`: `"preloaded"` or `"query"`
- `tickEventWrites`:
  - `actualPatches`
  - `predictedEffects`

---

## Tick pipeline (code order)

1. Resolve active trips from preload or query fallback.
2. Build one `TripTransition` per location:
   `{ currLocation, existingTrip?, events }`.
3. Split transitions into:
   - completed boundaries (`events.isCompletedTrip`)
   - current path (everything else)
4. Run lifecycle branches in order:
   - `processCompletedTrips` first
   - `processCurrentTrips` second
5. Assemble timeline write intents in
   `projection/timelineEventAssembler.ts` from:
   - completed boundary facts
   - current-branch messages filtered by successful upserts
6. Merge writes into one `TickEventWrites` and return result.
7. Orchestrator later applies returned writes via `applyTickEventWrites`.

### Why this order matters

- Completed-boundary persistence must run before current-path updates.
- Projection payloads are built from finalized branch results, not raw feed rows.
- Upsert-gated side effects and projection messages are filtered by per-vessel
  upsert success.

### Locked constraints

These constraints are intentional and should not change without explicit
approval:

- Persist lifecycle before overlay projection in each tick.
- Treat the orchestrator action as non-atomic across branches; rely on
  idempotent writes and retry-safe behavior.
- Keep stored trip rows strip-shaped (prediction blobs excluded from persisted
  `activeVesselTrips` rows).
- Keep docked identity normalization schedule-assisted (`resolveEffectiveLocation`
  and shared effective identity helpers), not feed-only heuristics.

---

## Architecture and module ownership

### Folder map

| Path | Owns |
| --- | --- |
| `index.ts` | Public barrel for tick entrypoint and types |
| `processTick/processVesselTrips.ts` | Per-tick orchestration and branch sequencing |
| `processTick/tickEnvelope.ts` | Tick result types |
| `processTick/tickEventWrites.ts` | Tick write-intent types and merge helper |
| `processTick/tickPredictionPolicy.ts` | Fallback-window policy (`seconds < 5`) |
| `tripLifecycle/physicalDockSeaDebounce.ts` | Dock/sea debounce for physical boundaries |
| `tripLifecycle/detectTripEvents.ts` | Centralized event detection |
| `tripLifecycle/tripEventTypes.ts` | Shared `TripEvents` shape |
| `tripLifecycle/tripDerivation.ts` | Shared normalized per-tick derivation and dock-departure state |
| `tripLifecycle/baseTripFromLocation.ts` | Base trip constructor (`start` / `continue` modes) |
| `tripLifecycle/resolveEffectiveLocation.ts` | Docked identity normalization against scheduled backbone |
| `tripLifecycle/appendSchedule.ts` | Schedule enrichment for key transitions |
| `tripLifecycle/appendPredictions.ts` | ML prediction enrichment helpers |
| `tripLifecycle/buildTrip.ts` | Main trip builder orchestration |
| `tripLifecycle/buildCompletedTrip.ts` | Completion finalization (`EndTime`, durations, arrival guardrails) |
| `tripLifecycle/tripEquality.ts` | Storage vs overlay equality checks |
| `tripLifecycle/processCompletedTrips.ts` | Boundary branch persistence and facts |
| `tripLifecycle/processCurrentTrips.ts` | Current branch persistence and messages |
| `projection/lifecycleEventTypes.ts` | Lifecycle DTOs emitted by branches |
| `projection/actualBoundaryPatchesFromTrip.ts` | `eventsActual` patch builders |
| `projection/timelineEventAssembler.ts` | Assembles `TickEventWrites` from branch outputs |
| `tests/*.test.ts` | Unit tests for eventing, builders, branches, and orchestration |

### Import boundaries

Lifecycle branch files (`processCompletedTrips` / `processCurrentTrips`) should:

- emit lifecycle facts/messages only,
- avoid direct imports of timeline row builders (`domain/timelineRows/*`),
- avoid assembling final `TickEventWrites` directly.

`projection/timelineEventAssembler.ts` owns:

- imports of timeline row builders,
- imports of actual patch builders,
- upsert-gated filtering and final tick write assembly.

---

## Event model and lifecycle semantics

`detectTripEvents(existingTrip, currLocation)` is the single event detector.
Current event bundle:

- `isFirstTrip`
- `isTripStartReady`
- `shouldStartTrip` (compatibility field; currently always `false`)
- `isCompletedTrip`
- `didJustArriveAtDock`
- `didJustLeaveDock`
- `scheduleKeyChanged`

### Boundary detection rules (PR 2 physical lifecycle)

- **Physical identity** is `TripKey` (immutable per trip instance). Vessel-trip
  rows do **not** persist a separate composite `Key`; schedule alignment uses
  `ScheduleKey` / `NextScheduleKey` only.
- **Schedule attachment** is optional `ScheduleKey`. `resolveEffectiveLocation`
  proposes schedule alignment; `appendFinalSchedule` commits `ScheduleKey` and
  next-leg fields when a segment key exists.
- **Lifecycle timestamps**: coverage uses `StartTime` / `EndTime`. Physical
  boundaries use `ArriveOriginDockActual`, `DepartOriginActual` (stored as
  `LeftDockActual` until rename), and `ArriveDestDockActual`. Legacy `LeftDock`
  remains feed-shaped input.
- **Dock/sea debounce** (`physicalDockSeaDebounce.ts`) uses only `AtDock`,
  `LeftDock`, and `Speed > 1`, combined with the persisted trip row, to tolerate
  one contradictory sample. At most **one** physical boundary (departure or
  arrival completion) is emitted per tick; impossible pairs are suppressed.
- Completed boundary requires:
  - existing trip evidence (`LeftDock` / `LeftDockActual` or `ArriveDest`), and
  - debounced `didJustArriveAtDock` (docked at a new departing terminal after a
    sea leg).
- `didJustLeaveDock` is true on the first debounced tick where `LeftDock`
  appears for a trip that has not yet recorded departure, unless the tick is
  physically contradictory (e.g. `LeftDock` present while still reading
  docked with low speed).
- `scheduleKeyChanged` compares proposed `continuingScheduleKey` from
  `deriveTripInputs` to `existingTrip.ScheduleKey`. It drives schedule enrichment
  and (with other gates) prediction retries; it is **not** a primary physical
  boundary trigger. Carried next-leg / prediction fields clear in `buildTrip`
  only when **`scheduleKeyChanged && physicalIdentityReplaced`** (see
  `buildTrip.ts`); when `TripKey` is stable, schedule segment updates preserve
  existing prediction snapshots while `appendFinalSchedule` refreshes segment
  fields.

### Three runtime situations

1. **First-seen vessel (`!existingTrip`)**
   - processed on current path
   - `ArriveOriginDockActual` / `StartTime` can remain unset until the pipeline
     asserts boundaries (cold start)
2. **Completed boundary**
   - complete old trip first (`buildCompletedTrip`)
   - create replacement trip (`buildTrip` with `tripStart=true`)
   - persist atomically via `completeAndStartNewTrip`
3. **Regular current update**
   - build proposal (`buildTrip` with `tripStart=false`)
   - gate lifecycle write via `!tripsEqualForStorage`
   - gate projection refresh via `!tripsEqualForOverlay`

---

## Build pipeline details (`buildTrip`)

Per vessel, `buildTrip` composes state in this order:

1. `resolveEffectiveLocation`
2. `baseTripFromLocation`
3. same-trip `ArriveDestDockActual` stamping when eligible
4. derived-state clear when `scheduleKeyChanged && physicalIdentityReplaced`
   (see `clearDerivedStateOnScheduleKeyChange` in `buildTrip.ts`)
5. `appendFinalSchedule` when `tripStart || scheduleKeyChanged` (schedule enrichment)
6. at-dock prediction append when gated
7. at-sea prediction append when gated
8. `actualizePredictionsOnLeaveDock` on leave-dock events

### `baseTripFromLocation` modes

- `start`: used for explicit trip replacement creation
  - carries `Prev*` from evidence-bearing completed trip
  - sets `StartTime` / `ArriveOriginDockActual` from the complete-and-start chain
    (`existingTrip?.EndTime` tick)
  - clears predictions and next-leg schedule context
- `continue`: used for ongoing/first-seen active trip updates
  - carry-forward protection for feed omissions
  - preserves existing prediction fields until refreshed

### Effective location normalization

`resolveEffectiveLocation` only runs scheduled-segment resolution when vessel is
docked (`AtDock`) and no `LeftDock` exists yet. If docked identity is already
stable, no scheduled lookup is performed. Raw `vesselLocations` remain feed-shaped;
normalization only affects this write pipeline.

---

## Core invariants and non-obvious business rules

### Build-then-compare with dual predicates

For every proposed trip:

- lifecycle predicate: `persist = !tripsEqualForStorage(existing, proposed)`
- projection predicate: `refresh = !tripsEqualForOverlay(existing, proposed)`

This creates three valid outcomes:

- persist + refresh
- refresh only (projection-only tick)
- no work

### Storage vs overlay equality

`tripsEqualForStorage`:

- strips the five prediction fields via `stripTripPredictionsForStorage`
- ignores `TimeStamp`
- compares persisted-row semantics only

`tripsEqualForOverlay`:

- compares all non-`TimeStamp` keys
- normalizes prediction fields to:
  - `PredTime`
  - `Actual`
  - `DeltaTotal`

### Prediction fields not stored on trip rows

The five boundary prediction blobs are intentionally excluded from stored
`activeVesselTrips` rows:

- `AtDockDepartCurr`
- `AtDockArriveNext`
- `AtDockDepartNext`
- `AtSeaArriveNext`
- `AtSeaDepartNext`

They still exist in in-memory proposals and in overlay projection behavior.

### Null-overwrite protection

For continuing trips, durable values are preserved when feed omits data:

- scheduled departure
- ETA
- left-dock timestamp
- next-leg schedule context

This prevents transient feed gaps from erasing known-good state.

### LeftDock source of truth

Departure is only recognized when `LeftDock` exists in feed-derived state.
`AtDock` alone does not create or clear departure evidence.

### Leave-dock boundary ownership

On the exact tick where `LeftDock` first appears:

- preserve prior dock-interval owner for boundary attribution,
- avoid letting transient future identity fields steal departure ownership,
- allow identity advancement only after departure boundary is recorded.

This is handled in shared derivation (`tripDerivation.ts`) and is critical for
correct `eventsActual`/`eventsPredicted` boundary projection.

### ArriveDestDockActual guardrails

- Same-trip destination arrival stamping requires real departure evidence plus
  docking behavior, not destination field churn alone.
- Completion uses guarded arrival selection: if carried `ArriveDestDockActual`
  is missing or chronologically invalid relative to departure / origin arrival,
  completion may close coverage with `EndTime` without asserting destination
  physical arrival.

### Coverage vs physical (client-facing summary)

`StartTime` / `EndTime` are the recording window only. `ArriveOriginDockActual`,
`DepartOriginActual`, and `ArriveDestDockActual` are optional physical
boundaries. Legacy `TripStart` / `TripEnd` mirror coverage during transition;
readers should prefer canonical fields.

### SailingDay semantics

`SailingDay` is business logic derived from trip identity
(`shared/tripIdentity`), tied to departure schedule context, and not solely a
schedule-lookup artifact.

---

## Prediction behavior and actualization

Predictions use event-driven triggers with minute-window fallback.

### At-dock predictions

- Fields: `AtDockDepartCurr`, `AtDockArriveNext`, `AtDockDepartNext`
- Triggered when at dock with started-trip context and missing fields
- May run on event triggers and fallback window

### At-sea predictions

- Fields: `AtSeaArriveNext`, `AtSeaDepartNext`
- Triggered when underway (`LeftDock` present, not docked) and missing fields
- May run on leave-dock / key-change / fallback triggers

### Readiness and efficiency

- Prediction computation skips fields already present.
- Predictions require `isPredictionReadyTrip`.
- Multiple predictions for same pair batch-load model parameters.

### Actualization paths

- Same-trip leave-dock actualization occurs in `buildTrip` before persistence.
- Completion actualization occurs in `buildCompletedTrip`.
- Depart-next backfill onto most recent completed trip runs via
  `setDepartNextActualsForMostRecentCompletedTrip` only after successful active
  upsert for that vessel.

---

## Persistence and side-effect ordering

### Completed branch

- Build finalized completed trip
- Build replacement active trip
- Persist atomically (`completeAndStartNewTrip`)
- Emit completed-boundary fact for projection assembly

### Current branch

- Build proposals in per-vessel isolation (`Promise.allSettled`)
- Batch active upserts when needed
- Track successful upserts per vessel
- Run leave-dock post-persist backfill only for successful upserts
- Emit actual/predicted event messages for assembler

### Projection assembly and application

- Assembler builds `TickEventWrites` from completed facts + current messages.
- Tagged messages requiring successful upsert are filtered by success set.
- Orchestrator applies writes after lifecycle phase returns.

---

## Convex call surface (per tick, conditional)

- Query: `getActiveTrips` fallback when `activeTrips` not provided.
- Internal schedule queries from location normalization / schedule enrichment:
  - `getScheduledDepartureSegmentBySegmentKey`
  - `getNextDepartureSegmentAfterDeparture`
- ML parameter queries when predictions run (single or batched model loads).
- Mutation: `completeAndStartNewTrip` on boundaries.
- Mutation: `upsertVesselTripsBatch` for current-path persist work.
- Mutation: `setDepartNextActualsForMostRecentCompletedTrip` on successful
  leave-dock post-persist path.
- Peer mutations (orchestrator step): `projectActualBoundaryPatches`,
  `projectPredictedBoundaryEffects`.

Most expensive queries/predictions are event-gated; they are not intended to run
on every 5-second tick for every vessel.

---

## Failure, idempotency, and operational behavior

- Per-vessel failures are isolated; one vessel should not abort others.
- Batch upsert returns per-vessel success/failure used for downstream gating.
- Orchestrator action is not globally atomic across all branches; idempotent
  writes and retries are expected.
- Preferred hot path: pass preloaded storage-native active trips from
  orchestrator read model to avoid extra `getActiveTrips` query.

---

## Future work (out of current scope)

- Async outbox/replay infrastructure for projection retries.
- Additional idempotency-key hardening if projection is further split into more
  independent mutations.
- Golden tick fixtures for regression snapshots.
- Further WSF feed hardening for at-dock/at-sea transition noise.

---

## Testing map

Primary tests are colocated in:

- `convex/functions/vesselTrips/updates/tests/`

Common command:

- `bun test convex/functions/vesselTrips/updates/tests/*.test.ts`

Focus areas covered by tests:

- event detection and derivation logic
- base/build/completed trip builders
- storage vs overlay equality behavior
- current/completed branch sequencing and gating
- end-to-end `processVesselTrips` orchestration behavior

---

## Related docs

- `convex/functions/vesselOrchestrator/README.md`
- `docs/PRD-vessel-trips-lifecycle-refactor.md`
