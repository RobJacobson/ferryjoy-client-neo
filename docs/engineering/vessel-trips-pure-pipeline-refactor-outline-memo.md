# Vessel trips pure pipeline — refactor outline

**Status:** Proposed roadmap (implementation TBD).  
**Audience:** Engineers and agents refactoring `updateVesselTrips`, orchestrator actions, and related domain folders.  
**Scope:** Trip tick semantics, persistence shape, schedule inputs, and decoupling from predictions/timeline handoff types. **Not** a full `updateVesselPredictions` redesign—that work is tracked separately; this memo’s “end state” is “trips-only purity” plus a sketch of how the orchestrator stays coherent until predictions is refactored.

**Related:** [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md), [`vessel-orchestrator-decoupling-agents-memo.md`](vessel-orchestrator-decoupling-agents-memo.md), [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md), [`convex/domain/vesselOrchestration/architecture.md`](../convex/domain/vesselOrchestration/architecture.md).

---

## Goals (why this refactor)

1. **`updateVesselTrips` as a pure concern** — One primary domain entry that, given tick inputs, returns **only serializable rows / write sets** for vessel-trip tables (no mutation-oriented “execution payloads,” no timeline message queues, no `TripLifecycleApplyOutcome` on the trip path long-term).
2. **Bulk schedule snapshots (preferred)** — Prefer **one (or few) prefetched schedule snapshots** per tick at the DB layer, passed as plain data into domain, instead of many per-segment callbacks. Monitor production cost; keep a **narrow adapter (Plan B)** if bulk reads prove too large or too stale.
3. **Single tick anchor** — `tickStartedAt` (or equivalent) created **once** in `actions.ts` and passed **in** to steps that need it; not returned from inner steps as the source of truth.
4. **Folder hygiene** — Subfolders by sub-concern; **one public runner** from `updateVesselTrips/` (plus explicit type exports where needed). See [`imports-and-module-boundaries-memo.md`](imports-and-module-boundaries-memo.md).
5. **Incremental delivery** — Multiple small PRs; transitional duplication is acceptable until old paths are deleted.

6. **Orchestration layering** — Each orchestrator step should follow: **gather inputs** → **call one domain function** → **persist plain outputs** → done. **`convex/functions`** owns I/O only; **`convex/domain`** owns rules and pure transforms. Avoid business logic in persistence helpers.

7. **No “write plans” as domain output** — Domain returns **rows / write sets**; the functions layer performs **idempotent** upserts and deduping. Avoid ambiguous names like “payloads” or “policies” for domain outputs.

---

## Design principles & discussion archive

Topics from design review that should survive as **intent**, not only as implementation detail:

### Minimal inputs (semantic)

- **State:** current **`convexLocations`** + **`activeTrips`** (loaded in the DB layer and passed in). These are non-negotiable inputs to the trip tick.
- **Schedule:** provided as **bulk snapshot** (preferred) or **narrow read port** (Plan B)—not a bag of unrelated injected “builder” functions on every call.
- **Tick anchor:** **`tickStartedAt`** (or equivalent) for **one shared tick** across all four phases. It is a **correlation id**, not a requirement for millisecond-level accuracy; sub-minute uses (e.g. fallback windows) are policy, not physics.

### Derived keys vs database

- Some facts (**e.g. sailing day**) may be **derived** from **`tickStartedAt`** plus agency rules (timezone, cutover) in a **pure helper**, reducing what the schedule snapshot must redundantly carry. The snapshot still supplies **sailing-specific tables** that cannot be inferred from the clock alone.

### “Builders” vs the two-bucket story

- **Preferred mental model:** (1) decide if a trip **completed** → **completed** bucket; (2) else treat as **in-service** (new + continuing **together**) → **in-service** bucket. Today’s **`buildTripCore`** / **`buildCompletedTrip`** names reflect **implementation** factoring; long term they should be **private** helpers under **`runUpdateVesselTrips`**, not the exported architecture.

### Types and coupling

- **`TripLifecycleApplyOutcome`:** Treat as **legacy bridge** for predictions and timeline while refactor is in flight; **eliminate from the trip path** when downstream steps no longer need it (may require **`updateVesselPredictions`** work in parallel).
- **Boundary facts (`CompletedTripBoundaryFact`, etc.):** **Not** the long-term **public** output of the trip module—they are **downstream handoff** shapes. Long term they live with **timeline**, **predictions**, or a **thin bridge** module, not as the trip tick’s primary contract.
- **Shared types** drifting between **`updateTimeline`** and **`updateVesselTrips`:** Prefer a **neutral** location or **consumer-owned** types once boundaries stabilize (see architecture memo).

### Anti-patterns called out explicitly

- **`buildVesselTripsExecutionPayloads`** — Ambiguous name; encodes **transport + strip + grouping**. Replace with **storage-shaped rows** derived from the two buckets, with strip/for-storage rules in **one** obvious place (typically the functions persistence layer).
- **Wide `updateVesselTrips/index.ts`** — Re-exporting **`updateTimeline`** / **`updateVesselPredictions`** for “discoverability” blurs ownership; **collapse** to **`runUpdateVesselTrips`** (+ narrow type exports).
- **Mutation-shaped domain APIs** — End state is **pure data out**; transitional mutation-oriented persistence is acceptable only until **Step 3** retires it.

### Messages, cron, and timeline

- The trip tick **need not** emit **`pendingActualMessages` / `pendingPredictedMessages`** for a **cron** backend whose job is **persist authoritative trip rows**; aside from **error logs**, there is no requirement for rich backend “output” from the trip step.
- **Implication:** **`updateVesselTimeline`** (or a successor) must obtain inputs by **reading persisted state**, **recomputing** in a later phase, or a **temporary bridge**—not by requiring the trip step to queue message DTOs forever.

### Read-model vs tick code

- **`mergeTripsWithPredictions`** and similar **query-time** helpers are **not** the identity of **`updateVesselTrips`**; keep them **out** of the public barrel (or relocate under **`read/`** or **`functions/vesselTrips`** as appropriate).

### Cost and Plan B

- Bulk snapshots are motivated first by **semantics and fewer round-trips**; **Convex cache / small tables** are a **secondary** cost argument. **Monitor** read volume and payload size in production; **Plan B** is a **well-scoped adapter** with **only** the queries the trip tick needs—not a return to unbounded callback sprawl.

---

## (a) Current state

### How the code works (high level)

1. **`updateVesselOrchestrator`** (`convex/functions/vesselOrchestrator/actions.ts`) loads a snapshot (vessels, terminals, **active trips**), sets up deps, then runs **four sequential steps**: locations → trips → predictions → timeline.

2. **`updateVesselLocations`** — Fetches live positions from WSF (`fetchWsfVesselLocations`), then **`bulkUpsert`** to `vesselLocations`. **No dependency on predictions**; it does not call trip or ML code.

3. **`updateVesselTrips`** — Calls **`computeVesselTripsWithClock`** (domain), which wraps **`computeVesselTripsBundle`**. That path:
   - pairs each location with an active trip row,
   - **`detectTripEvents`**, splits completed vs current transitions,
   - **`processCompletedTrips`** / **`processCurrentTrips`** using injected **`buildTripCore`**, **`buildCompletedTrip`**, **`buildTripAdapters`** from **`createDefaultProcessVesselTripsDeps`**, where adapters are backed by **`ScheduledSegmentLookup`** — **snapshot-backed** in production: one internal **`getScheduleSnapshotForTick`** query per tick, then **`createScheduledSegmentLookupFromSnapshot`** (sync in-memory lookups; no per-segment `runQuery` from the action).
   - Produces a **`VesselTripsComputeBundle`** (handoffs + active branch + pending timeline messages).

   Then **`persistVesselTripWriteSet`** (domain `orchestratorTick/`) uses **`buildVesselTripTickWriteSetFromBundle`**, strips predictions for storage, and drives trip-table mutations: **`completeAndStartNewTrip`**, **`upsertVesselTripsBatch`**, **`setDepartNextActualsForMostRecentCompletedTrip`**.

   Returns **`tripApplyResult: TripLifecycleApplyOutcome`** (timeline-oriented); **`tickStartedAt`** is owned by **`updateVesselOrchestrator`** (Step 1).

4. **`updateVesselPredictions`** — **Recomputes** the same trip bundle via **`computeVesselTripsWithClock`** (isolation), then ML overlay + proposal upserts. Still **coupled conceptually** to the same bundle shape and trip-domain types.

5. **`updateVesselTimeline`** — Merges trip persist outcome with ML overlay; projects dock writes to **`eventsActual`** / **`eventsPredicted`**.

**Cross-cutting types today:** `TripLifecycleApplyOutcome`, **`CompletedTripBoundaryFact`**, pending “messages” — live under **`updateTimeline/types`** but flow through the **trip** and **predictions** steps for assembly.

### File structure (outline)

```
convex/functions/vesselOrchestrator/
  actions.ts                 # four phases; wires deps, bindings, mutations
  utils.ts                   # ScheduledSegmentLookup, VesselTripTableMutations, prediction access
  queries.ts                 # orchestrator snapshot (incl. activeTrips)
  ...

convex/domain/vesselOrchestration/
  computeVesselTripsWithClock.ts
  index.ts                   # re-exports computeVesselTripsWithClock, orchestratorTick namespace
  orchestratorTick/
    persistVesselTripsCompute.ts
    vesselTripsExecutionPayloads.ts
    materializePostTripTableWrites.ts   # predictions + timeline bridge
    ...
  updateVesselTrips/
    index.ts                   # wide barrel (trip + re-exports timeline/predictions symbols)
    processTick/
      processVesselTrips.ts  # computeVesselTripsBundle
      defaultProcessVesselTripsDeps.ts
      buildTripRuntimeAdapters.ts
      tickPredictionPolicy.ts
    tripLifecycle/           # detect, buildTripCore, processCompleted/Current, bundle types
    continuity/              # scheduled segment resolution (callback style)
    read/                    # mergeTripsWithPredictions (query read-model; not tick core)
  updateVesselPredictions/
  updateTimeline/
```

---

## (b) Target end state (trips lane; predictions/timeline imperfect)

This is the **steady state for the vessel-trips refactor**, not the final state of the entire product after **`updateVesselPredictions`** is fully redesigned.

### How the code should work (high level)

1. **`actions.ts`**
   - Creates **`tickStartedAt`** once per tick (after validating snapshot).
   - Loads **bulk schedule snapshot(s)** for the relevant **sailing day / window** via **one or a small number of internal queries** (size-bounded, documented).
   - Passes **flat arguments** into domain: e.g. **`tickStartedAt`**, **`convexLocations`**, **`activeTrips`**, **`scheduleSnapshot`**, and any derived keys (e.g. sailing day) computed in the action or a pure helper—not buried in opaque “input objects” unless the team agrees on a single DTO name.

2. **`updateVesselTrips` (domain)** — **Single exported runner** (e.g. `runUpdateVesselTrips`):
   - **Pure** (no `ActionCtx`, no Convex): inputs → output.
   - **Two logical write buckets** (aligned to storage):
     - **Completed** — rows for the **completed-trips** table (exact mechanics follow schema).
     - **In-service** — **new + in-progress** together for the **active / in-service** table (single upsert stream; idempotent by natural key).
   - **No** `TripLifecycleApplyOutcome`, **no** “boundary facts” as a public trip output, **no** pending actual/predicted **messages** from this function (timeline derives from persisted state or a separate pipeline later).
   - **No** mutation-oriented return value; persistence is **only** “here are the rows / keys to write.”
   - **Prediction fallback policy** (`shouldRunPredictionFallback` or equivalent): computed **once** in the action from **`tickStartedAt`**, or inside domain from passed booleans—**not** a second clock source.

3. **Functions layer persistence**
   - Takes the pure output and performs **idempotent upserts** / table-appropriate writes. **Deduping** and Convex-specific behavior stay here.
   - **Plan A:** bulk schedule data prefetched in the action. **Plan B:** if payload size or freshness fails in production, swap to a **narrow `ScheduleReadPort`** with **only** the queries trip logic needs (documented interface; one implementation with Convex, one with in-memory test doubles).

4. **`updateVesselLocations`** — **Unchanged in spirit:** WSF → normalize → **`bulkUpsert`**. Optionally the same **`tickStartedAt`** is available for logging or correlation; **no** prediction or trip imports.

5. **`updateVesselPredictions` / `updateVesselTimeline`** — **Out of scope for “perfect” here.** Until predictions is refactored, they may still consume **legacy shapes** or **recomputed** trip-like data **without** requiring the trip step to emit timeline handoffs. Long term, predictions should not force **`VesselTripsComputeBundle`** + **`TripLifecycleApplyOutcome`** as the only bridge.

### File structure (outline)

*Illustrative; exact names can differ.*

```
convex/functions/vesselOrchestrator/
  actions.ts
  utils.ts                         # bindings; optional ScheduleSnapshotQuery wiring
  tickContext.ts                   # optional: tickStartedAt + sailingDay helpers (pure)
  ...

convex/functions/...               # new or existing internal queries for bulk schedule read

convex/domain/vesselOrchestration/
  updateVesselTrips/
    index.ts                       # export runUpdateVesselTrips (+ types only as needed)
    runUpdateVesselTrips.ts        # THE public entry
    completed/                     # pure: completed bucket (private modules)
    inService/                     # pure: in-service bucket
    shared/                        # detect events, equality, debounce, etc.
    snapshot/                      # pure helpers to slice bulk schedule (if not inlined)
  orchestratorTick/
    persistVesselTripRows.ts       # thin: maps pure output → mutations (or lives under functions/)
    # vesselTripsExecutionPayloads.ts — REMOVED once obsolete
  computeVesselTripsWithClock.ts   # replaced or slimmed: clock owned by action
  ...
```

**Read-model helpers** (e.g. **`mergeTripsWithPredictions`**) move **out** of `updateVesselTrips/` or sit under **`read/`** with **no** export from the trip tick `index.ts`.

---

## Bulk snapshots and cost control

- **Hypothesis:** Daily (or per–sailing-day) schedule tables are **small**; one snapshot per tick is **cheaper** than many segment queries and keeps domain pure.
- **Risk:** Payload size, read units, or stale data if the snapshot window is wrong.
- **Mitigation:** Bound the query (sailing day + relevant vessels/routes); add logging/metrics for snapshot byte size and duration; **document Plan B** — a **minimal adapter** that exposes only required reads if bulk fetch is not viable.

---

## Multi-step refactor plan (for a future agent)

Each step should be **mergeable** and **test-backed** (parity tests, orchestrator tick tests). Order can be adjusted if a step blocks; **do not** merge behavior changes without tests.

### Step 1 — Tick anchor ownership

- Move **`tickStartedAt`** creation to **`updateVesselOrchestrator`** (or a tiny helper called only from there).
- Thread **`tickStartedAt`** **into** `computeVesselTripsWithClock` / `updateVesselTrips` / `updateVesselPredictions` / `updateVesselTimeline`; **remove** returning it from inner functions as the canonical value.
- **Acceptance:** Single source of truth for the tick clock in `actions.ts`; tests pass fixed timestamps via the same path.

### Step 2 — Introduce pure output type (parallel path)

- Define **`VesselTripTickWriteSet`** (name TBD): **completed rows** + **in-service rows** (serializable POJOs matching table write shapes).
- Implement **parallel** computation that fills this structure **without** deleting the old bundle path yet (feature flag or internal-only caller).
- **Acceptance:** Unit tests on pure mapping from fixtures; no Convex in domain tests.

### Step 3 — Replace mutation-oriented persistence for trips

- Implement **`persistVesselTripWriteSet`** (functions or thin `orchestratorTick` helper) that performs **idempotent** writes from **`VesselTripTickWriteSet`**.
- Gradually **retire** **`buildVesselTripsExecutionPayloads`** and handoff-specific mutation sequencing once parity is proven.
- **Acceptance:** Orchestrator tick tests match current behavior; **`persistVesselTripsCompute`** deleted or reduced to a shim.

### Step 4 — Bulk schedule snapshot (Plan A)

- Add **internal query(s)** that return a **bounded** schedule snapshot for the tick.
- In **`actions.ts`**, fetch snapshot once; pass into **`runUpdateVesselTrips`**.
- Replace **`ScheduledSegmentLookup`** **callback** usage in the hot path with **in-memory slicing** from the snapshot; keep **Plan B adapter** interface documented if rollback needed.
- **Acceptance:** Fewer `runQuery` calls per tick from trip adapters; snapshot size logged in dev/staging.

### Step 5 — Collapse `updateVesselTrips` public surface

- **Single export** from `updateVesselTrips/index.ts` (plus types).
- Move internal modules under **`completed/`**, **`inService/`**, **`shared/`**; remove timeline/predictions **re-exports** from this barrel.
- **Acceptance:** Imports from outside the folder go through `index.ts` (per module-boundaries memo); tests may deep-import with team consent.

### Step 6 — Remove trip-path timeline baggage

- Stop producing **`TripLifecycleApplyOutcome`** from **`updateVesselTrips`**.
- **Interim:** Timeline/predictions steps may **read from DB** or use a **temporary bridge** module until **`updateVesselPredictions`** is refactored.
- **Acceptance:** Trip domain has **no** imports from **`updateTimeline`** for its **primary** output types.

### Step 7 — Cleanup and documentation

- Delete dead code (`vesselTripsExecutionPayloads`, obsolete bundle fields, unused “messages” on trip path).
- Update **`architecture.md`**, orchestrator README, and **this memo** status.
- **Acceptance:** CI green; memos point to **`runUpdateVesselTrips`** as the canonical trip tick API.

---

## Clarification: `updateVesselLocations` vs `updateVesselTrips`

- **`updateVesselLocations`** today is **already independent** of predictions and of the trip compute bundle. After this refactor it remains: **external API → normalize → `bulkUpsert`**, optionally receiving **`tickStartedAt`** only for correlation/logging.
- The **dependency to break** is between **`updateVesselTrips`** and **prediction/timeline handoff types** (`TripLifecycleApplyOutcome`, boundary facts, message lists). That is the focus of **§(b)** and the steps above.

---

## Revision history

- **Initial:** Outline for multi-step vessel-trips pure pipeline refactor; current vs target file layout; bulk snapshot preference with Plan B; incremental steps for agents.
- **Discussion archive:** Added §Design principles & discussion archive (layering contract, minimal inputs, tick semantics, derived sailing day, builders vs two buckets, legacy types, anti-patterns, messages/cron/timeline implication, read-model placement, cost vs semantics for snapshots).
