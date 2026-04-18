# Vessel orchestrator: domain compute vs. persistence refactor

## Purpose

Document the **current** vessel-tick orchestration and trip-lifecycle wiring, the
**intended** architecture (domain produces plans and payloads; the functions
layer applies Convex mutations), and a **staged migration** with enough detail
for implementation and review. This memo is an engineering guide, not a
line-by-line spec.

## Audience

Backend engineers working on `convex/functions/vesselOrchestrator`,
`convex/domain/vesselOrchestration`, and vessel trip / timeline persistence.

## Related docs

- [`convex/functions/vesselOrchestrator/README.md`](../convex/functions/vesselOrchestrator/README.md)
- [`convex/domain/vesselOrchestration/architecture.md`](../convex/domain/vesselOrchestration/architecture.md)
- [`docs/handoffs/vessel-orchestration-concern-colocation-handoff-2026-04-17.md`](handoffs/vessel-orchestration-concern-colocation-handoff-2026-04-17.md)
- **Phase 1 implementation handoff:** [`docs/handoffs/vessel-trip-phase1-write-plan-handoff-2026-04-17.md`](handoffs/vessel-trip-phase1-write-plan-handoff-2026-04-17.md)
- **Phase 2 implementation handoff:** [`docs/handoffs/vessel-trip-phase2-read-ports-handoff-2026-04-17.md`](handoffs/vessel-trip-phase2-read-ports-handoff-2026-04-17.md)
- **Phase 3 implementation handoff:** [`docs/handoffs/vessel-orchestrator-phase3-orchestrator-handoff-2026-04-17.md`](handoffs/vessel-orchestrator-phase3-orchestrator-handoff-2026-04-17.md)
- **Phase 4 follow-up handoff (optional initiatives):** [`docs/handoffs/vessel-orchestrator-phase4-handoff-2026-04-17.md`](handoffs/vessel-orchestrator-phase4-handoff-2026-04-17.md)

---

## 1. Current structure

### 1.1 Layering (stated rule)

The backend follows:

```text
convex/functions → convex/adapters → convex/domain → convex/functions (persistence)
```

The orchestrator action is meant to stay a **thin Convex shell**: fetch external
data, load read models, call domain orchestration, apply side effects.

### 1.2 Orchestrator action (`updateVesselOrchestrator`)

[`convex/functions/vesselOrchestrator/actions.ts`](../convex/functions/vesselOrchestrator/actions.ts):

1. Loads identity and active trips via one internal query
   (`getOrchestratorModelData`).
2. Fetches and converts WSF vessel locations
   (`fetchWsfVesselLocations`).
3. Calls **`runVesselOrchestratorTick(input, deps)`** with:
   - **Input:** converted locations, passenger-terminal allow-list, tick
     timestamp, active trips.
   - **Deps:** three **injected callbacks** — `persistLocations`,
     `processVesselTrips`, `applyTickEventWrites` — built by
     [`createVesselOrchestratorTickDeps`](../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)
     (timeline mutations in
     [`applyTickEventWrites.ts`](../convex/functions/vesselOrchestrator/applyTickEventWrites.ts)),
     closing over `ActionCtx` (`runMutation` / `runQuery` / internal mutations).

The orchestrator returns
[`VesselOrchestratorTickResult`](../convex/domain/vesselOrchestration/types.ts)
(branch success flags, per-branch timings, optional branch errors).

### 1.3 Domain tick coordinator (`runVesselOrchestratorTick`)

[`convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`](../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts):

- Filters **trip-eligible** locations.
- Runs **in parallel**:
  - **updateVesselLocations:** `deps.persistLocations(convexLocations)`.
  - A **sequential** trip stack:
    1. **updateVesselTrips:** `deps.processVesselTrips(...)`.
    2. **updateTimeline:** `deps.applyTickEventWrites(tripResult.tickEventWrites)`.
- Uses `Promise.allSettled` on the two top-level branches so one branch can fail
  without aborting the other (subject to each branch’s own error handling).

`runVesselOrchestratorTick` intentionally does **not** import Convex `api` or
mutations; **deps** are the seam for tests and for keeping this file free of
function references.

### 1.4 Trip processing (`processVesselTripsWithDeps`)

[`convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts`](../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts):

- Takes **`ActionCtx`** and runs, in order:
  1. **`processCompletedTrips`** — trip-boundary completions / handoffs.
  2. **`processCurrentTrips`** — steady-state active-trip updates.
- Then builds **`tickEventWrites`** via `buildTimelineTickProjectionInput` for
  timeline overlay persistence.

**Important:** Completed and current branches are **not** interchangeable; the
codebase relies on **completed work running before current-trip** processing for
the same tick.

### 1.5 Where persistence lives today (trip branch)

**Completed trips**
([`processCompletedTrips.ts`](../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts)):

- Per-vessel work is run under `Promise.allSettled`.
- Each successful path calls **`ctx.runMutation`** with
  `completeAndStartNewTrip` after `buildTrip` / `buildCompletedTrip` produce row
  shapes.

**Current trips**
([`processCurrentTrips.ts`](../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts)):

1. **`buildTrip`** for each vessel (with `Promise.allSettled` for builds).
2. Accumulates **batch upsert** candidates and timeline message artifacts.
3. **`ctx.runMutation(upsertVesselTripsBatch)`** once when there is storage work.
4. **`runLeaveDockPostPersistEffects`** — additional **`ctx.runMutation`**
   calls **only for vessels that succeeded** in the batch upsert, because
   leave-dock backfill assumes the active trip row exists in the database.

So the trip branch already has an **implicit write pipeline** (complete handoffs
→ batch upsert → conditional leave-dock mutations), but that pipeline is
**interleaved with `ActionCtx`** inside domain modules.

### 1.6 Reads during `buildTrip` (not just writes)

[`buildTrip`](../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts)
and
[`VesselTripsBuildTripAdapters`](../convex/domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters.ts)
thread **`ActionCtx`** into **resolve effective location** and **append final
schedule** (schedule continuity and enrichment).

[`applyVesselPredictions`](../convex/domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions.ts)
also takes **`ActionCtx`** for prediction append steps that may perform async
work.

So “domain” today is **not** a pure function of preloaded inputs; it performs
**live reads** (and mutations) through Convex’s action context.

---

## 2. Problems with the current shape

1. **Mixed responsibilities:** Domain modules both **decide** lifecycle changes
   and **execute** Convex mutations, which blurs boundaries and makes “what this
   tick did to storage” harder to see in one place.
2. **Orchestrator deps object:** The three callbacks are a reasonable test seam,
   but they read as **callback indirection** at the call site even when the
   **return type** of the action is a simple result envelope.
3. **Testing:** Mutation side effects are embedded in domain flow; asserting
   behavior often means standing up more infrastructure or mocking `ctx`, rather
   than comparing a **plan** to an expected plan.
4. **Inconsistent abstraction:** Timeline assembly already produces
   **`tickEventWrites`** consumed by **`applyTickEventWrites`** — a data-out,
   persist-in-functions pattern — while trip lifecycle mutations are still inline
   `ctx.runMutation` calls.

None of this implies the original layering was wrong for its time; it is a
natural place to **tighten** boundaries as the pipeline grows.

---

## 3. Intended result (target architecture)

### 3.1 Principles

1. **Domain** computes **what should happen**: trip proposals, lifecycle
   decisions, timeline projection inputs, and **explicit mutation payloads**
   (or an ordered **write plan**) suitable for Convex mutations — without
   calling `ctx.runMutation` in domain code for those steps.
2. **Functions layer** (or a dedicated persistence helper next to existing
   mutations) **applies** plans in a **documented order**, preserving today’s
   concurrency and failure semantics unless we consciously change them.
3. **Reads** during a tick are either:
   - **Prefetched** into plain data structures before domain runs, and/or
   - Expressed as **narrow, non-Convex interfaces** (“ports”) implemented in the
     functions layer, so domain does not depend on `_generated/server` types.

### 3.2 Observable outcomes

- A reader can open **`updateVesselOrchestrator`** (or a small companion module)
  and see: **fetch → load read model → domain tick → apply writes** with minimal
  nested lambdas.
- Domain unit tests can validate **plans and facts** without a Convex runtime.
- Ordering invariants remain explicit in code comments and types (especially:
   **completed before current**, **leave-dock only after successful active
   upsert**).

---

## 4. Migration stages (detailed)

### Stage 1 — Extract a **trip write plan** and a single **applier** (mutations only)

**Goal:** Remove `ctx.runMutation` from `processCompletedTrips` and
`processCurrentTrips` (and their private helpers), without yet changing how
`buildTrip` performs reads.

**Design sketch**

1. Introduce a typed structure (exact naming TBD during implementation), for
   example:
   - **`completedHandoffs`:** list of payloads matching today’s
     `completeAndStartNewTrip` arguments, plus whatever **boundary facts** the
     timeline assembler needs from each success (same as today’s returned
     facts).
   - **`activeTripBatch`:** optional batch body for `upsertVesselTripsBatch`
     (strip predictions for storage exactly as today).
   - **`leaveDockBackfills`:** list of arguments for
     `setDepartNextActualsForMostRecentCompletedTrip`, **not** executed until
     after batch upsert results are known.
   - **`tickEventWrites`:** unchanged conceptual role; still produced after
     lifecycle facts, then applied by **`applyTickEventWrites`**.

2. Refactor **completed** processing to **return** handoff rows + facts instead
   of awaiting mutations inside the domain function.

3. Refactor **current** processing to **return** the batch fragment + message
   artifacts + leave-dock **intents**, then move **`upsertVesselTripsBatch`** and
   **`runLeaveDockPostPersistEffects`** into a functions-layer function, e.g.
   **`applyVesselTripTickWritePlan(ctx, planFragment)`**, that:
   - Runs completed handoffs with the same **parallelism model** as today
     (`Promise.allSettled` per vessel, unless we intentionally change error
     isolation).
   - Runs **one** batch upsert when needed.
   - Computes **`successfulVessels`** from the batch result exactly as
     **`getSuccessfulVessels`** does today.
   - Runs leave-dock mutations **only** for successful vessels.

4. **`processVesselTripsWithDeps`** becomes: run pure(ish) pipeline steps that
   **produce** `tickEventWrites` and the **write plan**; the orchestrator action
   (or a thin wrapper) calls the applier.

**Why this stage first:** It delivers the largest readability win for storage
and aligns the trip branch with the **timeline** pattern (data out, apply in
functions), without forcing an immediate redesign of schedule/prediction reads.

**Risks / checks**

- **Ordering:** Completed phase before current phase — unchanged.
- **Partial failure:** Per-vessel completed failures vs. batch upsert per-row
   failures — preserve existing logging and “successful set” behavior.
- **Convex limits:** If a single mutation payload grows too large, the applier
   may need **chunking**; that remains a functions-layer concern.

---

### Stage 2 — Replace **`ActionCtx`** in **`buildTrip` / predictions** with **read ports**

**Goal:** Domain no longer imports Convex server context types for **reads**;
tests use in-memory fakes.

**Design sketch**

1. Define small interfaces for:
   - **Effective location resolution** and **schedule append** (today’s
     `VesselTripsBuildTripAdapters`, but without `ActionCtx` in the method
     signatures — pass a **read scope** or pass pre-resolved inputs if we move
     to prefetch).
   - **Prediction append steps** that today take `ctx` in
     `applyVesselPredictions` / `appendPredictions`.

2. Implement those interfaces in **`convex/functions/...`** using the same
   internal queries as today (behavior parity first).

3. Optionally add **prefetch** (Stage 2b): one or a few queries at tick start
   that load schedule-related data for all vessels in the tick, reducing
   per-vessel query fan-out. Only justified if metrics show it matters.

**Why separate from Stage 1:** Read refactors touch ML and continuity code paths;
keeping mutation extraction independent reduces risk and simplifies bisection when
something regresses.

---

### Stage 3 — Simplify **`runVesselOrchestratorTick`** and the orchestrator action

**Goal:** Remove the **three-callback** `deps` object if it no longer carries
its weight.

**Design sketch**

1. **`runVesselOrchestratorTick`** accepts **tick inputs** and returns:
   - Results needed for logging/metrics (`tickMetrics`, branch outcomes).
   - **Location persistence payload** (or instructions) for `bulkUpsert`.
   - **Trip write plan** + **`tickEventWrites`** (or a single combined tick
     result object).

2. **`updateVesselOrchestrator`** does:
   - `Promise.allSettled` on **location apply** vs. **trip apply** (trip apply
     internally runs completed → batch → leave-dock, then
     **`applyTickEventWrites`**), matching current parallelism semantics.

3. Keep **`runVesselOrchestratorTick`** unit tests focused on **orchestration**
   (filtering, branch isolation, metrics), with persistence **faked** at the
   apply boundary instead of per callback.

---

## 5. Testing and verification

- **Unit:** Assert **write plans** and **timeline inputs** for representative
  ticks (completed-only, current-only, mixed, prediction-only overlay, etc.).
- **Integration:** At least one path that runs the real applier against Convex
  test deployment or existing integration harness (project-dependent).
- **Parity:** Compare structured logs / metrics (`tickMetrics`, vessel processing
  logs) before and after each stage in a staging environment.

---

## 6. Rollout suggestion

1. Implement **Stage 1** behind clear types; ship when tests and staging checks
   pass.
2. **Stage 2** in one or more PRs by subsystem (adapters first, then prediction
   tail), with profiling optional for prefetch.
3. **Stage 3** once trip outputs are data-first and the orchestrator is mostly
   glue.

Defer **behavior changes** (e.g. new transaction boundaries or different error
isolation) unless product asks for them; this memo targets **structure**, not
feature changes.

---

## 7. Open questions (to resolve during implementation)

- Should **`applyVesselTripTickWritePlan`** live next to
  **`convex/functions/vesselTrips`**, next to the orchestrator, or as an
  **internal** mutation that accepts a serialized plan (only if Convex model
  benefits)?
- Do we want a **single** top-level type for “everything persistable this tick”
  (locations + trips + timeline), or keep locations separate for parallelism?
- Prefetch breadth: per **sailing day**, per **route**, or driven by active trip
  keys only?

---

## Document history

- **2026-04-17:** Initial memo (current structure, target, staged plan).
