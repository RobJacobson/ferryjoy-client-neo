# Vessel orchestrator: four pipelines and prediction separation

## Purpose

This document defines **why** we are refactoring real-time vessel orchestration,
**where** we want to end up, and **how** to get there in phased steps. It is
meant for engineers and coding agents implementing the work; it is not a
line-by-line specification.

**Scope:** `convex/functions/vesselOrchestrator` (especially `actions.ts`),
`convex/domain/vesselOrchestration` (trip lifecycle, timeline, locations,
predictions), persistence under `convex/functions/vesselTrips`,
`convex/functions/vesselLocation`, `convex/functions/predictions`, and event
projection modules.

## Audience

Backend engineers and agents touching orchestrator ticks, vessel trips, ML
predictions, and timeline projection.

## Related documents

- Domain map: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md)
- Orchestrator README: [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md)
- Module boundaries: [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md)
- Prior orchestration history (layering may differ from **current** tree;
  verify against code): [`vessel-orchestrator-functions-owned-orchestration-memo.md`](vessel-orchestrator-functions-owned-orchestration-memo.md)
- **O1 handoff (orchestrator extract):** [`docs/handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md)
- **O2 handoff (`buildTripCore` vs predictions):** [`docs/handoffs/vessel-orchestrator-o2-build-trip-core-vs-predictions-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o2-build-trip-core-vs-predictions-handoff-2026-04-18.md)
- **O3 handoff (predictions storage + writer):** [`docs/handoffs/vessel-orchestrator-o3-predictions-storage-and-writer-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o3-predictions-storage-and-writer-handoff-2026-04-18.md)
- **O4 handoff (wire orchestrator):** [`docs/handoffs/vessel-orchestrator-o4-wire-orchestrator-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o4-wire-orchestrator-handoff-2026-04-18.md)
- **O5 handoff (timeline + cleanup):** [`docs/handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md)

---

## 1. Current state (baseline)

### 1.1 Entry point

`updateVesselOrchestrator` (`convex/functions/vesselOrchestrator/actions.ts`) is
an internal action that:

1. Loads a denormalized snapshot (vessels, terminals, active trips).
2. Fetches one batch of WSF vessel locations.
3. Builds trip-processing deps (schedule lookups + **prediction model access**
   for ML reads used inside trip building).
4. Calls `computeOrchestratorTripTick` → domain `computeVesselTripTick`.
5. Upserts vessel **locations**.
6. Applies the vessel-trip tick (`applyVesselTripTick`).
7. Builds timeline projection input from apply results and projects onto
   `eventsActual` / `eventsPredicted`.

Trip **lifecycle** and **ML predictions** are intertwined: `buildTrip` composes
schedule enrichment (`buildTripCore`) with `applyVesselPredictions` before the
functions layer persists trips. Prediction blobs are **stripped** before DB
writes on trip documents; overlay/timeline logic uses in-memory proposals with
normalized equality.

### 1.2 Pain points

- **Coupling:** Predictions run as a side effect of the vessel-trip pipeline,
  which makes debugging and reasoning harder (“whose responsibility is this
  field?”).
- **Scheduling complexity:** Event gates, schedule-key transitions, and a
  **time-based fallback** (first seconds of each minute as a proxy for “about
  once per minute” when the orchestrator tick cadence matches product
  expectations) add branching inside trip builders.
- **Refresh semantics:** Prediction helpers skip specs when the corresponding
  trip field is already **defined**, which favors “fill empty slots” over
  “recompute when inputs change,” working against recovery from stale or bad
  derived state.
- **Orchestrator readability:** The action handler mixes I/O, wiring, and
  phase ordering without named phases aligned to domain folders.

---

## 2. Goals

### 2.1 Primary goals

1. **Two conceptual pipelines for data shape**
   - **`updateVesselTrips`:** Authoritative lifecycle + persisted trip state
     (no ML prediction attachment in this pipeline once migration is done).
   - **`updateVesselPredictions`:** Derived forecasts from **current** trip
     (and related) inputs, stored in the **predictions** surface (see §3.2), with
     explicit recompute-and-diff persistence.

2. **Four orchestrator phases aligned to folder names**
   - `updateVesselLocations` — live positions.
   - `updateVesselTrips` — trip lifecycle writes from domain plans + applier.
   - `updateVesselPredictions` — prediction recompute + upsert changed rows.
   - `updateTimeline` — sparse `eventsActual` / `eventsPredicted` projection.

   Phases run **sequentially** in the action (or a single orchestrator module
   called from the action), in an order that preserves invariants (§3.1).

### 2.2 Engineering qualities

- **Easier debugging:** Clear ownership per table / concern.
- **Deterministic policy:** Predictions follow current trip inputs each tick;
  avoid “baked-in” wrong values for an entire segment when inputs fix themselves.
- **Simpler trip code:** Remove `applyVesselPredictions` from `buildTrip` and
  strip-path coupling where no longer needed for persistence strategy.

### 2.3 Non-goals (unless explicitly pulled in)

- Changing WSF fetch strategy or cron cadence (product may revert 15s → 5s
  ticks independently).
- Perfect deduplication of Convex writes without **application-level** diffing
  (see §5.2).
- Backwards compatibility with prior API shapes (early development; breaking
  changes acceptable when coordinated).

---

## 3. Target architecture

### 3.1 Ordering and dependencies

Recommended tick order (same process, single action):

1. **Locations** — Upsert live positions from the fetched batch (can remain
   after trip **plan** computation if invariants allow, or move if a future
   invariant requires locations persisted before trip reads; document the
   chosen rule).
2. **Trips** — Compute `VesselTripTick` without attaching ML
   predictions; apply lifecycle mutations; produce outputs needed by later
   phases (e.g. boundary facts for timeline).
3. **Predictions** — Read **post-trip** trip state (and any other inputs),
   recompute candidate predictions, **compare** to stored prediction rows,
   **upsert** only when changed.
4. **Timeline** — Build projection input from the **in-memory** post–`updateVesselPredictions`
   merge (`TripLifecycleApplyOutcome` slices fed to
   `buildTimelineTickProjectionInput`). Same-tick assembly does **not** reload
   `vesselTripPredictions` from the DB for projection; the table is for persistence
   and other readers.

**Dependency note:** Timeline merges success-sensitive trip apply results after ML
is merged in memory (`enrichTripApplyResultWithPredictions`); callers are
`orchestratorPipelines.updateVesselTimeline` after `updateVesselPredictions`.

### 3.2 Predictions persistence

Today, full ML blobs are not persisted on trip documents (stripped at apply).
The target is explicit storage in the **predictions** table (or equivalent
dedicated documents), keyed in a way that supports batch reads and per-tick
diffs (exact schema left to implementation handoff).

### 3.3 Policy direction for ML execution

**Directional preference (subject to profiling):** prefer **recompute each tick
from current inputs** over intricate “only on events / once per minute” gating,
and use **equality / normalization** to avoid useless writes and subscription
noise. If cost requires throttling later, throttle with **measurements**, not
assumptions.

### 3.4 Layering (Convex)

- **Domain** (`convex/domain/...`): pure planning, diff helpers, types; no
  `ActionCtx`; no direct `ctx.db` in domain modules (keep existing project
  boundaries).
- **Functions** (`convex/functions/...`): orchestration, `runQuery` /
  `runMutation`, adapters, and mutation bodies that touch tables.

---

## 4. Implementation plan (Option B — selected)

We implement **Option B**: multiple smaller phases (O1–O5). Early development
allows breaking changes across phases when coordinated.

### 4.1 Option A — Not selected

A two-phase split (orchestrator shell vs prediction extraction) was considered
and **not** chosen; we prefer smaller checkpoints and clearer agent handoffs.

### 4.2 Phases O1–O5

| Phase | Scope | Definition of done |
|-------|--------|-------------------|
| **O1** | Orchestrator extract (**no** prediction semantics change) | Named pipeline functions; thin `actions.ts`; `updateVesselPredictions` stub/no-op; **behavior parity** with pre-refactor tick |
| **O2** | Trip builders: `buildTripCore` vs `applyVesselPredictions` | **Done** — parity tests; orchestrator uses split (`buildTrip` composer remains for other callers) |
| **O3** | Predictions table + writer | Schema/mutations; read → recompute → diff → write in functions layer |
| **O4** | Wire orchestrator | Trips without ML attachment; predictions phase after trips; simplify strip path |
| **O5** | Timeline + cleanup | `buildTimelineTickProjectionInput` contract; remove dead ML-only gates if any; docs |

**Handoffs:** See `docs/handoffs/` — **O1**
[`vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o1-orchestrator-extract-handoff-2026-04-18.md),
**O2**
[`vessel-orchestrator-o2-build-trip-core-vs-predictions-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o2-build-trip-core-vs-predictions-handoff-2026-04-18.md),
**O3**
[`vessel-orchestrator-o3-predictions-storage-and-writer-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o3-predictions-storage-and-writer-handoff-2026-04-18.md),
**O4**
[`vessel-orchestrator-o4-wire-orchestrator-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o4-wire-orchestrator-handoff-2026-04-18.md),
**O5**
[`vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md).

### 4.3 O1 ordering note (current invariant)

Today’s tick **computes** trip work **before** location bulk upsert,
then **applies** trip mutations (see §1.1). Until a later phase explicitly
changes that ordering, **O1** should preserve it. The practical pattern is:
**`updateVesselTrips`** orchestrates **compute → `updateVesselLocations` →
apply** so the handler can still read as four logical steps (`updateVesselTrips`
includes the location upsert **between** plan and apply). Export
**`updateVesselLocations`** separately for tests and clarity.

---

## 5. Implementation notes (cross-cutting)

### 5.1 Tests

- Extend or add orchestrator integration tests under
  `convex/functions/vesselOrchestrator/tests/` (and domain tests under
  `convex/domain/vesselOrchestration/**/tests/`).
- **Comment sync:** When orchestrator filenames or pipeline steps change, update
  module-level comments in orchestrator tests (see O1 handoff §*Test and comment
  sync*).
- After prediction extraction, add tests for: **diff skips write** when
  normalized prediction unchanged; **diff writes** when normalized value changes.

### 5.2 Convex writes and “no-op upserts”

Do **not** rely on undocumented engine behavior to skip work when `patch` /
`replace` values are identical. Implement **compare-then-write** in prediction
mutations (or a single batch mutation that diffs in-process).

### 5.3 Model parameters

Model parameters currently load via queries. Mitigations: rely on query caching
where effective; consider **inlined static JSON** for truly constant per-deploy
data if profiling warrants it.

### 5.4 Documentation updates

After each phase: `convex/domain/vesselOrchestration/architecture.md`,
`convex/functions/vesselOrchestrator/README.md`, and this memo’s status section.

---

## 6. Definition of done (end state)

- [x] `updateVesselOrchestrator` invokes **four** clearly named phases
  (`orchestratorPipelines`: locations inside trips step, trips, predictions,
  timeline) matching folders.
- [x] Vessel trip computation on the orchestrator path **does not** call
  `applyVesselPredictions` inside `buildTrip` (composed `buildTrip` remains for
  other callers).
- [x] Predictions are **read** and **written** via `vesselTripPredictions`, with
  **refresh-on-input-change** semantics (not only `undefined` slots).
- [x] Timeline projection for each tick uses the **in-memory** enriched apply
  result after `updateVesselPredictions`; `vesselTripPredictions` persists proposals
  for other consumers.
- [x] `bun run check:fix`, `bun run type-check`, and Convex typecheck pass;
  tests updated or added for new behavior.

**Cron surface:** `updateVesselOrchestrator` only invokes
`runVesselOrchestratorPhases` (no return value). Each step builds **arrays of
plain POJOs** (location rows, trip tick rows, prediction proposal rows, timeline
rows) and passes them to small persist helpers; there is no shared scratch
object. A future refactor may drive some steps from DB re-reads only.

---

## 7. Open decisions (resolve in handoffs)

1. ~~Exact **prediction row keying** and schema~~ **(resolved, O3):** one `vesselTripPredictions` document per `(VesselAbbrev, TripKey, PredictionType)` with full `ConvexPrediction` payload + `UpdatedAt`; indexes `by_vessel_and_trip` and `by_vessel_trip_and_field`.
2. Whether **location upsert** must occur before trip **plan** computation in
   the final ordering (current code computes plan before location upsert).
3. Whether to keep any **throttle** (e.g. fallback window) after moving to
   per-tick recompute, or remove entirely and profile.
4. Parallelism: today’s action is largely sequential; confirm no regression if
   later reintroducing limited parallelism **only** where safe.

---

## 8. Status

| Item | State |
|------|--------|
| Document | **Active** — Option B (O1–O5) is the implementation plan |
| O1 — Orchestrator extract | **Done** |
| O2 — `buildTripCore` vs `applyVesselPredictions` | **Done** |
| O3 — Predictions storage + writer | **Done** (`vesselTripPredictions` + internal writer) |
| O4 — Wire orchestrator (`buildTripCore` trip phase; `updateVesselPredictions` real) | **Done** |
| O5 — Timeline + cleanup | **Done** |

---

## Revision history

- **Initial draft:** Four-pipeline orchestration + prediction separation roadmap
  (early development; no release/back-compat constraints).
- **Option B selected:** Phasing table finalized; O1 ordering note added; link to
  O1 handoff document.
- **O1 shipped:** `orchestratorPipelines.ts` + thin `actions.ts`; §8 marked Done.
- **O2 handoff added:** `buildTripCore` export + parity tests (`docs/handoffs/…o2…`).
- **O2 shipped:** `buildTripCore` / `BuildTripCoreResult` exported; `buildTrip.test.ts` parity coverage; §8 updated.
- **O3 handoff added:** predictions storage + compare-then-write writer (`docs/handoffs/…o3…`).
- **O3 shipped:** `vesselTripPredictions` table, `functions/vesselTripPredictions` internal API, overlay-aligned compare-then-write + tests; §7.1 item 1 closed; §8 updated.
- **O4 shipped:** Orchestrator uses `buildTripCore` for trip planning; `updateVesselPredictions` runs `applyVesselPredictions`, merges ML for timeline, `batchUpsertProposals`; §8 updated.
- **O4 handoff linked:** Related docs § and §4.2 handoffs list include [`vessel-orchestrator-o4-wire-orchestrator-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o4-wire-orchestrator-handoff-2026-04-18.md).
- **O5 shipped:** [`vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md`](../handoffs/vessel-orchestrator-o5-timeline-and-cleanup-handoff-2026-04-18.md) —
  timeline TSDoc + `computeShouldRunPredictionFallback` dedupe; `newTrip` guard test;
  `updateTimeline`/architecture memo alignment; §3.1 dependency note and §6 checklist
  updated; §8 marked Done.
- **Orchestrator phases:** `runVesselOrchestratorPhases` builds POJO row arrays per
  step then persists; trip rows live in `applyVesselTripTick.ts`
  (`buildTripTickRows` / `persistTripTickDbRows`).
