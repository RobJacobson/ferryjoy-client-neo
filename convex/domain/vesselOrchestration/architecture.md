# Vessel orchestration & trips architecture

**Related documentation:** [Convex domain README](../README.md) · [Vessel trips functions](../../functions/vesselTrips/README.md) · [Vessel orchestrator](../../functions/vesselOrchestrator/README.md)

**Where this file lives:** `convex/domain/vesselOrchestration/architecture.md` — next to the four concern folders (`updateTimeline/`, `updateVesselPredictions/`, …). Post–Step D, tick **orchestration** (parallel branches, metrics) lives in `convex/functions/vesselOrchestrator` (`executeVesselOrchestratorTick`).

This document explains how the orchestrator tick and **`updateVesselTrips`** domain code work: what runs each cycle, what depends on what, and where the main modules live.

It is intentionally plain-English and execution-path focused.

## One-screen mental model

**When it runs:** A cron fires every ~15s → `updateVesselOrchestrator` fetches WSF once, then fans out work.

**Operational reality (target mental model):** **four semi-independent concerns** composed by `vesselOrchestrator`, with **one parallel split** and **one sequential chain**:

- **Parallel:** **update vessel locations** runs beside the trip stack (same tick, same fetch).
- **Sequential chain:** **update vessel trips** → **update vessel predictions** → **update timeline**  
  Predictions are *not* parallel with trips; they depend on trip context. Timeline depends on lifecycle (and often on upsert success for projection gating).

See [Target reorganization: four orchestrator concerns](#target-reorganization-four-orchestrator-concerns).

**Shipped layout:** The four concern folders under `domain/vesselOrchestration/` are in place. The orchestrator runs the location branch in parallel with one **trip stack** branch. **updateVesselPredictions** is `applyVesselPredictions` after `buildTripCore`; **updateTimeline** (`buildTimelineTickProjectionInput`, assembler, `tickEventWrites`) lives under **`domain/vesselOrchestration/updateTimeline/`**. Trip persistence runs in **`functions/`** (`runProcessVesselTripsTick`: `computeVesselTripTickWritePlan` → `applyVesselTripTickWritePlan` → `buildTimelineTickProjectionInput`), behind injected `deps.processVesselTrips`. Further refactors aim at **narrower modules and explicit handoffs** between concerns—not more network hops.

**Four concerns at a glance:**

| Concern | What it owns | Main code today (illustrative) |
| --- | --- | --- |
| **updateVesselLocations** | Live snapshot: `vesselLocations` bulk upsert | `updateVesselLocations/bulkUpsertArgsFromLocations.ts` → orchestrator `persistLocations` |
| **updateVesselTrips** | Authoritative lifecycle: `activeVesselTrips` / `completedVesselTrips` | `computeVesselTripTickWritePlan` → `processCompletedTrips` / `processCurrentTrips` → (functions) `applyVesselTripTickWritePlan` |
| **updateVesselPredictions** | Trip-shaped ML fields (`applyVesselPredictions`; `appendPredictions` helpers) | `updateVesselPredictions/applyVesselPredictions.ts`, `appendArriveDockPredictions` / `appendLeaveDockPredictions` in `appendPredictions.ts` |
| **updateTimeline** | Sparse `eventsActual` / `eventsPredicted` writes | `domain/vesselOrchestration/updateTimeline/` → `TickEventWrites` / `TimelineTickProjectionInput`; orchestrator `applyTickEventWrites` applies them |

**Per tick, in one sentence:** For each converted vessel location, detect events → build/update trips (schedule enrichment → **updateVesselPredictions**) → strip predictions for DB where needed → batch upsert → assemble timeline writes → orchestrator persists timeline writes—**updateVesselTrips** → **updateVesselPredictions** → **updateTimeline**.

**Core files to remember:**

```text
updateVesselTrips/processTick/processVesselTrips.ts   `computeVesselTripTickWritePlan` (domain plan); `runProcessVesselTripsTick` applies + timeline
updateVesselTrips/tripLifecycle/buildTrip.ts   buildTripCore + applyVesselPredictions (ML)
updateVesselPredictions/applyVesselPredictions.ts   ML tail (calls appendPredictions)
updateVesselTrips/tripLifecycle/detectTripEvents.ts  flags (completed? leave? arrive?)
vesselOrchestration/updateTimeline/             tickEventWrites, assembler, buildTimelineTickProjectionInput
```

**Two identities:** `TripKey` = physical trip instance; `ScheduleKey` = schedule segment alignment (different purpose).

Read on for full paths, alternatives, glossary, and refactor ideas.

---

## 1) What this module is responsible for

**`updateVesselTrips`** (under `domain/vesselOrchestration/`) is the backend lifecycle engine for vessel trip state.

At a high level, every orchestrator tick:

1. receives current vessel locations,
2. decides what changed for each vessel (no-op, left dock, arrived, etc.),
3. updates `activeVesselTrips` and `completedVesselTrips`,
4. emits per-tick timeline writes (`eventsActual`, `eventsPredicted`),
5. returns those writes for the orchestrator to persist.

It does **not** directly fetch WSF; that happens in adapters/functions layers.

---

## 2) Main entry points and consumers

## Primary backend entry point (write path)

- `convex/crons.ts`
  - Schedules `internal.functions.vesselOrchestrator.actions.updateVesselOrchestrator` every 15s.
- `convex/functions/vesselOrchestrator/actions.ts`
  - Fetches WSF locations once.
  - Loads read model (vessels, terminals, active trips).
  - Calls **`executeVesselOrchestratorTick(ctx, input)`** (inlined Convex I/O: trip-eligible
    filter, `runProcessVesselTripsTick`, `applyTickEventWrites`).
- `convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts`
  - `computeVesselTripTickWritePlan` — domain plan for one tick (completed + current branches).
- `convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts`
  - Functions runner: plan → `applyVesselTripTickWritePlan` → `buildTimelineTickProjectionInput`.

## Public read consumers (frontend/app)

- `src/data/contexts/convex/ConvexVesselTripsContext.tsx`
  - Uses `api.functions.vesselTrips.queries.getActiveTripsWithScheduledTrip`.
- `src/data/contexts/convex/ConvexUnifiedTripsContext.tsx`
  - Uses:
    - `api.functions.vesselTrips.queries.getActiveTripsByRoutes`
    - `api.functions.vesselTrips.queries.getCompletedTripsByRoutesAndTripDate`

## Internal write consumers (within backend)

- `processCompletedTrips` calls mutation:
  - `api.functions.vesselTrips.mutations.completeAndStartNewTrip`
- `processCurrentTrips` calls mutations:
  - `api.functions.vesselTrips.mutations.upsertVesselTripsBatch`
  - `api.functions.vesselTrips.mutations.setDepartNextActualsForMostRecentCompletedTrip`

---

## 3) End-to-end flow (ASCII diagrams)

## A. Tick write flow (happy path)

```text
Cron (15s)
  -> functions/vesselOrchestrator/actions.updateVesselOrchestrator
      -> load read model (vessels, terminals, activeTrips)
      -> fetchWsfVesselLocations(...)
      -> executeVesselOrchestratorTick(...)
          -> persistLocations branch (vesselLocations bulkUpsert)
          -> trip branch:
               deps.processVesselTrips(...) [runProcessVesselTripsTick]
                 -> detect events per vessel
                 -> processCompletedTrips(...)
                 -> processCurrentTrips(...)
                 -> applyVesselTripTickWritePlan (functions)
                 -> assemble TickEventWrites (buildTimelineTickProjectionInput)
               deps.applyTickEventWrites(...) [applyTickEventWrites.ts; production via executeVesselOrchestratorTick]
                    -> eventsActual mutation
                    -> eventsPredicted mutation
```

## B. High-level branch model

```text
One tick
  ├─ updateVesselLocations: vesselLocations snapshot persistence
  └─ Trip stack (sequential chain):
        updateVesselTrips (lifecycle mutations)
        -> updateVesselPredictions (applyVesselPredictions after buildTripCore)
        -> updateTimeline (TickEventWrites -> eventsActual / eventsPredicted)

Conceptually: locations ∥ trip stack; within the stack, timeline after trips
(and after predictions attach), with upsert-gated projection where required.

Branches run in parallel with Promise.allSettled for (locations) vs (trip stack).
Branch failures are isolated in orchestrator result envelope.
```

## C. Per-vessel lifecycle decision model

```text
For each trip-eligible vessel location:
  existingTrip? + currLocation
    -> detectTripEvents(...)
      -> completed transition?
          yes -> complete old trip + start new trip
          no  -> update current active trip if changed
```

---

## 4) Execution paths with plain-English sequence

## Path 1: Normal continuing active trip (no boundary)

1. `detectTripEvents` reports not completed.
2. `buildTrip` creates latest proposed trip state.
3. Compare existing vs proposed:
   - storage compare (`tripsEqualForStorage`)
   - overlay compare (`tripsEqualForOverlay`)
4. If storage changed: enqueue active upsert.
5. If overlay changed: enqueue timeline messages.
6. Batch upsert active trips.
7. Build tick event writes from queued messages.

What it means:
- Vessel stays on same physical trip; state is refreshed only when needed.

## Path 2: Leave-dock boundary on current trip

1. Debounce logic identifies `didJustLeaveDock`.
2. `buildTrip` sets departure boundary fields and may actualize predictions.
3. Active trip upsert occurs (if storage changed).
4. Post-persist hook runs:
   - `setDepartNextActualsForMostRecentCompletedTrip`
5. Projection emits departure actual write and prediction updates.

What it means:
- Departure is recorded, timeline gets departure actual, and next-leg ML rows
  can be backfilled with real departure time.

## Path 3: Arrival boundary completes trip

1. `detectTripEvents` marks `isCompletedTrip`.
2. `buildCompletedTrip` creates archival completed row.
3. `buildTrip(...tripStart=true...)` builds replacement active trip.
4. Mutation `completeAndStartNewTrip` performs:
   - insert completed row,
   - delete old active row,
   - insert new active row.
5. Completed facts are converted into tick event writes:
   - actual departure/arrival writes,
   - prediction clear for old trip,
   - prediction writes for new trip.

What it means:
- Old trip is closed and new trip starts atomically.

## Path 4: Docked identity continuity when feed identity is unstable

1. At dock with no `LeftDock`, runtime adapter calls
   `resolveEffectiveDockedLocation`.
2. It tries, in order:
   - keep active-trip identity if stable,
   - infer from schedule continuity (`NextScheduleKey`/rollover),
   - fallback to live feed identity.
3. Applies effective identity to location before trip building.

What it means:
- Prevents schedule/identity churn while vessel is still docked.

## Path 5: Fetch or branch failure alternatives

- If fetch/read-model stage fails in orchestrator:
  - tick stops, both branch success flags false.
- If location persistence fails but trip branch succeeds:
  - trips continue to progress.
- If trip branch fails but location persistence succeeds:
  - vessel snapshots continue updating.

What it means:
- Designed for partial availability rather than all-or-nothing tick failure.

---

## 5) Folder-by-folder and file-by-file map

## `updateVesselTrips/processTick/` (tick orchestration entry)

- `processVesselTrips.ts`
  - Main domain entrypoint. Splits transitions into completed/current, runs both
    paths, calls `buildTimelineTickProjectionInput` (**`updateTimeline`**).
- `buildTripRuntimeAdapters.ts`
  - Builds runtime adapters for:
    - effective location resolution,
    - schedule enrichment (`appendFinalSchedule`).
- `tickEnvelope.ts`
  - Return type of one trip tick; references `TimelineTickProjectionInput` from
    **`vesselOrchestration/updateTimeline/tickEventWrites`**.
- `tickPredictionPolicy.ts`
  - Time-window policy for fallback prediction attempts.

## `vesselOrchestration/updateVesselTrips/tripLifecycle/` (**updateVesselTrips** — core state machine)

Cron-driven trip lifecycle for one tick: detection, `buildTrip`, completed vs current
branches, equality, ML appenders, and strip-for-storage. Wired by
`updateVesselTrips/processTick/processVesselTrips.ts`, `processTick/defaultProcessVesselTripsDeps.ts`, and `executeVesselOrchestratorTick` (`createScheduledSegmentLookup` plus `createVesselTripPredictionModelAccess` from `functions/predictions/createVesselTripPredictionModelAccess.ts`).

- `detectTripEvents.ts` — Per-vessel event flags from existing trip + location.
- `tripEventTypes.ts` — Shared event bundle type.
- `processCompletedTrips.ts` — Completion transitions and atomic rollover mutation.
- `processCurrentTrips.ts` — Continuing trips, write suppression, upsert batching, hooks.
- `processCurrentTripsTickLogging.ts` — Schedule/boundary diagnostics.
- `buildTrip.ts` — Full proposed trip (`buildTripCore` + `applyVesselPredictions`).
- `buildCompletedTrip.ts` — Canonical completed trip row.
- `baseTripFromLocation.ts` — Start/continue base trip shapes.
- `tripDerivation.ts` — Shared derived inputs for detection and base trip build.
- `physicalDockSeaDebounce.ts` — Leave/arrive debounce.
- **`../updateVesselPredictions/appendPredictions.ts`** / **`../updateVesselPredictions/applyVesselPredictions.ts`** — **updateVesselPredictions** ML tail.
- **`../updateVesselPredictions/stripTripPredictionsForStorage.ts`** — Strip blobs before DB writes.
- `tripEquality.ts` — Storage vs overlay equality; `tripWriteSuppressionFlags`.

Adapter types for `buildTrip` live in **`domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters.ts`**.

## `updateVesselTrips/continuity/` (docked identity continuity logic)

- `resolveEffectiveDockedLocation.ts`
  - Orchestrates docked effective identity decision.
- `resolveDockedScheduledSegment.ts`
  - Schedule-backed continuity fallback resolution.
- `types.ts`
  - Continuity source/provenance type.

## `vesselOrchestration/updateTimeline/` (**updateTimeline** — trip output → timeline writes)

Canonical home for sparse `eventsActual` / `eventsPredicted` payload assembly. **Apply** is separate: the exported helper `applyTickEventWrites` in `functions/vesselOrchestrator/applyTickEventWrites.ts` runs the internal timeline mutations after lifecycle writes (single apply owner; production calls it from `executeVesselOrchestratorTick`; see `updateTimeline/README.md`).

- `tickEventWrites.ts` — `TickEventWrites` / `TimelineTickProjectionInput`, `mergeTickEventWrites`.
- `timelineEventAssembler.ts` — Converts lifecycle branch outputs into tick write payloads.
- `actualDockWritesFromTrip.ts` — Sparse dep/arv actual dock writes from trip rows.
- `buildTimelineTickProjectionInput.ts` — Merges completed + current branch writes per tick.
- `types.ts` — Message/fact DTOs exchanged between lifecycle branches and the assembler.

The barrel `updateTimeline/index.ts` re-exports the public surface. `domain/vesselOrchestration/updateVesselTrips/index.ts` re-exports **updateTimeline** / **updateVesselPredictions** symbols, `computeVesselTripTickWritePlan`, and tick-related types.

## `updateVesselTrips/read/` (query-time enrichment)

- `mergeTripsWithPredictions.ts`
  - Pure join of `eventsPredicted` rows onto trip docs for API reads.
- `dedupeTripDocsByTripKey.ts`
  - Dedupes overlapped query batches by physical `TripKey`.

## `updateVesselTrips/mutations/` (domain mutation policy helpers)

- `departNextActualization.ts`
  - Policy/helper logic for leave-dock depart-next actualization context.

## Root files: `vesselOrchestration/`

- `index.ts` — Re-exports `computeOrchestratorTripWrites` (`computeOrchestratorTripWrites.ts`). Tick orchestration types and `executeVesselOrchestratorTick` live under **`convex/functions/vesselOrchestrator/`** (Step D).

## Root files: `updateVesselTrips/`

- `processTick/defaultProcessVesselTripsDeps.ts` — `createDefaultProcessVesselTripsDeps(lookup, predictionModelAccess)` bundles default `buildTrip` / `buildTripAdapters` / `predictionModelAccess` for the orchestrator (`lookup` from `createScheduledSegmentLookup`, `predictionModelAccess` from `createVesselTripPredictionModelAccess`).
- `index.ts` — Re-exports timeline/prediction types, `computeVesselTripTickWritePlan`, and tick adapter types (see file); production wiring pairs `runProcessVesselTripsTick` with `createDefaultProcessVesselTripsDeps` (domain), `createScheduledSegmentLookup`, and `createVesselTripPredictionModelAccess` as composed by **`executeVesselOrchestratorTick`**.

## Functions layer tied directly to the trip domain

- `convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts`
  - Production tick: parallel locations vs trip branch (`runProcessVesselTripsTick` + `applyTickEventWrites`).
- `convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts`
  - Trip tick runner (plan compute + apply + timeline projection input).
  - Internal `createScheduledSegmentLookup` builds `ScheduledSegmentLookup` from Convex internal `eventsScheduled` queries (for default trip deps).
- `convex/functions/predictions/createVesselTripPredictionModelAccess.ts`
  - `createVesselTripPredictionModelAccess` builds `VesselTripPredictionModelAccess` from `ctx.runQuery` to production model-parameter queries (for `buildTrip` / **updateVesselPredictions**).
- `convex/functions/vesselTrips/queries.ts`
  - Public trip queries and enrichment.
- `convex/functions/vesselTrips/mutations.ts`
  - Public/internal trip lifecycle write handlers and backfill actions.
- `convex/functions/vesselTrips/schemas.ts`
  - Canonical validators/types/conversions for stored and joined trip shapes.

## Tests

- `convex/domain/vesselOrchestration/tests/`
  - Cross-cutting tests (e.g. `buildTimelineTickProjectionInput`, `computeOrchestratorTripWrites`).
- `convex/functions/vesselOrchestrator/tests/executeVesselOrchestratorTick.*.test.ts`
  - Orchestrator tick integration and branch-isolation tests against `executeVesselOrchestratorTick`.
- `convex/domain/vesselOrchestration/updateVesselTrips/tests/`
  - Unit coverage for trip lifecycle, continuity, projections, and adapters.

---

## 6) Data and state ownership

- `vesselLocations`
  - Live vessel snapshot branch; raw fidelity.
- `activeVesselTrips`
  - Current lifecycle state per vessel/trip.
- `completedVesselTrips`
  - Archived lifecycle rows.
- `eventsActual`
  - Actual dep/arv boundary events derived from trip lifecycle.
- `eventsPredicted`
  - Prediction projections and actualization updates.

Important design detail:
- Predictions are not persisted as full blobs on trip tables; projection/read
  layers own prediction table writes/joins.

---

## Target reorganization: four orchestrator concerns

This section records a **target architecture** for a broad reorganization: **four semi-independent concerns** under the vessel orchestrator’s umbrella, with **explicit handoffs** between them. The **domain layer** should own the business logic, grouped into modules that mirror these names; **`convex/functions/vesselOrchestrator`** stays the parent that wires Convex runtime (`ctx`, mutations, internal queries) and passes outputs forward—same role as today, but clearer.

**Folder shape (current repo — domain):**

```text
convex/domain/vesselOrchestration/
  updateVesselLocations/
  updateVesselTrips/
  updateVesselPredictions/
  updateTimeline/
```

Mirror **thin** runtime wrappers under `convex/functions/vesselOrchestrator/` (imports domain, applies `ctx`). The point is **one folder per concern** so review and onboarding match the mental model.

### Dependency graph (operational truth)

```text
  updateVesselLocations
        (parallel with the stack below)

  updateVesselTrips
        → updateVesselPredictions
        → updateTimeline
```

- **Locations** do not depend on trips; **trips / predictions / timeline** are ordered within the same tick.
- **Predictions** are *not* a second parallel branch like locations: they need trip context (`buildTripCore` then `applyVesselPredictions` within `buildTrip`).
- **Timeline** depends on lifecycle outcomes (and often on upsert success for upsert-gated projection).

### What each concern should own (contracts)

**updateVesselLocations**

- **Input:** Converted `ConvexVesselLocation[]` (full feed fidelity).
- **Output:** Successful or failed snapshot write to `vesselLocations`.
- **Non-goals:** Trip keys, schedule continuity, ML, timeline rows.

**updateVesselTrips**

- **Input:** Trip-eligible locations + preloaded active trips + tick policy (e.g. prediction fallback window) + injected schedule/runtime adapters as today.
- **Output:** Mutations to `activeVesselTrips` / `completedVesselTrips` (authoritative trip state).
- **Non-goals:** Owning `eventsActual` / `eventsPredicted` row shapes; those are **updateTimeline**.

**updateVesselPredictions**

- **Input:** Schedule-enriched trip proposal (`VesselTripCoreProposal`) plus precomputed gates from the same tick (`VesselPredictionGates`); see `applyVesselPredictions`.
- **Output:** Trip rows with ML fields filled (or no-op when gates skip work), feeding persistence and/or timeline.
- **Non-goals:** Timeline DTO assembly; owning `appendPredictions` spec lists — those stay in `updateVesselPredictions/appendPredictions.ts`.

**updateTimeline**

- **Input:** Facts / projection intents after lifecycle (and prediction attachment when relevant): e.g. boundary facts, current-branch messages, upsert success flags (as encoded in branch results).
- **Output (domain):** `TickEventWrites` / `TimelineTickProjectionInput` — assembled by `timelineEventAssembler` + merge; **not** direct DB writes in this step.
- **Output (apply):** `eventsActual` / `eventsPredicted` persistence via **`applyTickEventWrites`** in the orchestrator / functions layer, **after** lifecycle mutations for the tick.
- **Non-goals:** Re-deriving full trip state from raw locations; consume **authoritative** trip + tick outputs.

### Where today’s code maps (migration guide)

| Rough area today | Natural home |
| --- | --- |
| Orchestrator location branch (`executeVesselOrchestratorTick` → bulk upsert) | **updateVesselLocations** |
| `processCompletedTrips`, `processCurrentTrips`, `buildTripCore` / lifecycle half of `buildTrip`, `detectTripEvents`, continuity, storage equality | **updateVesselTrips** |
| `appendPredictions` / `applyVesselPredictions` (called from `buildTrip`) | **updateVesselPredictions** (`vesselOrchestration/updateVesselPredictions` barrel) |
| `timelineEventAssembler`, merge → `TickEventWrites` / `TimelineTickProjectionInput` | **updateTimeline** (domain assembly; e.g. `vesselOrchestration/updateTimeline`) |
| `applyTickEventWrites` | **updateTimeline** apply path (orchestrator / functions; runs after lifecycle) |

**Gray zone (unchanged fact):** predictions produce **trip-shaped fields** and **inputs to timeline projection**; explicit DTOs between **updateVesselPredictions** and **updateTimeline** reduce coupling.

### Phased cleanup / reorg (recommended order)

**Phase 1 — Document and compose (no behavior change)**  
- Name the four concerns in orchestrator and domain docs; optional thin wrappers with stable names (`runUpdateVesselLocations`, etc.) that delegate to existing implementations.

**Phase 2 — Folder scaffolding** (**shipped**)  
- The four concern folders exist under `domain/vesselOrchestration/`; remaining work is incremental import cleanup and boundary tightening, not greenfield scaffolding.

**Phase 3 — Extract updateTimeline**  
- Split “lifecycle result → `TickEventWrites` / `TimelineTickProjectionInput` **assembly**” from “run mutations” so **updateVesselTrips** yields authoritative trip outcomes and **updateTimeline** (domain) builds the projection payload; **apply** stays in **`applyTickEventWrites`** (orchestrator) after mutations settle. Keeps ordering: mutations settle before timeline apply when required.  
- **Shipped layout:** `buildTimelineTickProjectionInput` and related projection code live in **`domain/vesselOrchestration/updateTimeline/`** (canonical). `processVesselTrips` imports the builder from that path; the barrel `updateTimeline/index.ts` re-exports for tests and named-concern imports.

**Phase 4 — Extract updateVesselPredictions** (**shipped**)  
- ML attachment is `applyVesselPredictions` after `buildTripCore`, with handoff types `VesselTripCoreProposal` / `VesselPredictionGates`; implementation files under `vesselOrchestration/updateVesselPredictions/` (barrel `index.ts`).

**Phase 5 — Optional follow-up ([handoff](../../../docs/handoffs/vessel-trips-phase-5-handoff-2026-04-17.md))**  
- **Track 5A** — Split internal Convex actions only if ops need separate retries/metrics; usually **module boundaries** matter more than extra actions.  
- **Track 5B** — Narrow domain cleanups (§9–10): unify storage vs overlay diff; audit mirror fields; remove dead paths behind tests; keep changes **behavior-neutral** unless fixing a proven bug.

### Why this reorganization reduces pain

- **Four reviewable surfaces** aligned with operations: locations, trip truth, ML overlay, timeline projection.
- **Clearer failure domains:** e.g. “predictions failed” vs “timeline apply failed” without reading one mega-module.
- **Easier tests:** fixture trip outcomes into **updateTimeline** and **updateVesselPredictions** independently over time.

### Risks and constraints to preserve

- **Ordering:** Timeline after lifecycle when upsert-gated; predictions after enough trip context exists.
- **Atomicity:** Keep `completeAndStartNewTrip` as one mutation unless there is a strong reason to split.
- **Single source of tick truth:** Prefer one structured “tick result” object passed down the chain to avoid duplicate diff logic.

### Further thoughts (after boundaries exist)

- **updateVesselTrips internal layers:** detection → base trip → schedule enrichment → persist intents (predictions extracted to **updateVesselPredictions** when ready).
- **updateTimeline as pure projection:** `domain/timelineRows` / assembler owns `eventsActual` / `eventsPredicted` shapes; trip code emits **facts**, not row DTOs, where possible.
- **Deprecate dual equality gradually:** “storage diff” vs “overlay diff” may map to **updateVesselTrips** vs **updateTimeline** responsibilities.
- **Observability:** per-concern metrics (duration, rows written, failures).

---

## 7) Key alternative-path behaviors

- **Debounce guard**
  - Contradictory raw signal suppresses boundary events for that tick.
- **Upsert-gated projection**
  - Some timeline writes require successful active-trip upsert first.
- **Schedule identity detach**
  - On schedule-key loss or physical identity replacement, derived state is cleared.

---

## 8) Glossary (plain English)

- `TripKey`
  - Physical trip instance identity. Stable per real trip.
- `ScheduleKey`
  - Schedule segment identity derived from schedule fields. Not same as physical identity.
- `SailingDay`
  - Service-day grouping key (3AM boundary semantics in shared time helpers).
- `Tick`
  - One orchestrator cycle processing current vessel snapshot batch.
- `Completed transition`
  - Existing active trip becomes completed, and a new active trip starts.
- `Current transition`
  - Existing active trip continues and may be updated.
- `TickEventWrites`
  - Per-tick timeline payload returned by trip processing, then persisted by orchestrator.
- `Effective docked identity`
  - Corrected identity used while docked when feed identity is unstable or missing.
- `Prediction fallback window`
  - Early-seconds-of-minute policy for retrying missing predictions.
- `Overlay equality`
  - Equality check used to avoid unnecessary timeline writes.
- `Storage equality`
  - Equality check used to avoid unnecessary active-trip upserts.

---

## 9) Complexity hotspots and simplification suggestions

Work in two tiers: **(A) broad compartmentalization** (four orchestrator concerns), then **(B) narrow refactors** inside each. See [Target reorganization: four orchestrator concerns](#target-reorganization-four-orchestrator-concerns) for the framing.

## A) Broad: align code with four operational concerns

1. **Make pipeline boundaries explicit in code structure**
   - Even before splitting files, separate “trip tick result” from “timeline projection step” in types and call order.
   - Benefit: same runtime behavior, clearer ownership for review and onboarding.

2. **Feed updateTimeline only from authoritative trip (and prediction) outputs**
   - Projection should consume committed lifecycle results + explicit facts, not re-derive from raw locations mid-pipeline.
   - Benefit: timeline code shrinks and tests become fixture-driven.

## B) Narrow: inside updateVesselTrips (trip lifecycle) — easy wins

3. Split `buildTrip` into composable phases
   - Current function mixes identity, schedule transitions, prediction triggers,
     and cleanup rules.
   - Extract explicit phase helpers:
     - `resolveBaseIdentityPhase`
     - `applyScheduleTransitionPhase`
     - `applyPredictionPhase`
   - Benefit: easier reasoning and narrower tests once **updateVesselTrips** is isolated from timeline and from prediction attachment.

4. Reduce dual-equality complexity
   - `tripsEqualForStorage` and `tripsEqualForOverlay` are useful but subtle.
   - Add one shared "change summary" helper returning flags instead of running
     two independent deep compares—or push overlay diff to **updateTimeline** only.
   - Benefit: one source of truth for “what changed this tick.”

5. Move heavy diagnostic logging to dedicated logger helper
   - `processCurrentTrips.ts` has substantial inline logging plumbing.
   - Benefit: less cognitive overhead in lifecycle logic.

6. Add a single architecture-level sequence test
   - A "golden flow" covering: continuing → leave dock → arrive/complete.
   - Benefit: safer refactors and easier onboarding.

## C) Narrow: inside updateTimeline

7. Keep all `eventsActual` / `eventsPredicted` shape knowledge in projection builders
   - `timelineEventAssembler` and `domain/timelineRows` become the single story for “what gets written.”
   - Benefit: **updateVesselTrips** stops caring about row DTOs.

## D) Cross-cutting

8. Introduce explicit "decision objects"
   - Return structured decision DTOs from event detection and schedule continuity
     (not just booleans).
   - Benefit: clearer why a branch executed.

## Potential unused/redundant checks to audit

9. Audit duplicated/legacy field handling
   - Several fields mirror canonical ones (`LeftDock`/`LeftDockActual`,
     `AtDockActual`/`ArrivedCurrActual`, etc.).
   - Benefit: if some mirrors are no longer required, remove or deprecate to
     reduce branch logic.

10. Audit commented "tripStartReady"/`shouldStartTrip` remnants
    - `TripEvents` includes `shouldStartTrip`, but start decision appears driven
      mostly by other flags now.
    - Benefit: remove dead semantic surface if truly unused.

---

## 10) Suggested refactor sequence (safe order)

This aligns with **Phased cleanup / reorg** under [Target reorganization: four orchestrator concerns](#target-reorganization-four-orchestrator-concerns); kept here as a short checklist.

**Phase 0 — Documentation and safety net**

1. Architecture doc and README links (this document).
2. Golden-path lifecycle test for sequence confidence.

**Phase 1 — Four-concern composition without changing behavior**

3. Name the four concerns in code comments or thin wrappers (`updateVesselLocations`, `updateVesselTrips`, `updateVesselPredictions`, `updateTimeline`).
4. Introduce explicit types: structured trip-tick result → `TickEventWrites` (or equivalent) for **updateTimeline**.

**Phase 2 — Folder scaffolding (domain)** (**shipped**)

5. Four concern folders exist under `domain/vesselOrchestration/`; finish any remaining import moves and re-export cleanup as needed.

**Phase 3 — Extract updateTimeline**

6. Lifecycle returns facts; **updateTimeline** (domain) **builds** `TickEventWrites` / `TimelineTickProjectionInput` (assembler + merge) only after required mutations settle; orchestrator **`applyTickEventWrites`** **applies** them to `eventsActual` / `eventsPredicted`.

**Phase 4 — Extract updateVesselPredictions** (**done**)

7. ML phases live in `applyVesselPredictions` with explicit handoff DTOs (`VesselTripCoreProposal`, `VesselPredictionGates`).

**Phase 5 — Optional follow-up (same 5A / 5B as under *Phased cleanup / reorg* above; [handoff](../../../docs/handoffs/vessel-trips-phase-5-handoff-2026-04-17.md))**

8. **5B:** unify storage vs overlay diff; audit mirror fields; remove dead paths behind tests. **5A:** optional internal-action splits for retries/metrics only when justified.

This sequence prioritizes **compartmentalization** (four concrete concerns) before local cleanups, so `buildTrip` and equality logic are not fighting timeline DTO assembly in the same mental space.
