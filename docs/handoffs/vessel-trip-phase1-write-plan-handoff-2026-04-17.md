# Handoff: Phase 1 — Trip tick write plan and functions-layer applier

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Parent doc:** [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) (Stage 1 / migration section 4)

---

## Goal (Phase 1 only)

Remove **`ctx.runMutation`** from domain trip-lifecycle modules by:

1. Having domain code **produce an explicit write plan** (completed handoffs, active-trip batch payload, leave-dock backfill intents) plus the **non-persisted** inputs needed to assemble timeline projection **after** persistence succeeds.
2. Adding a **single applier** in the **functions** layer that runs mutations in the **same order and with the same failure semantics** as today.
3. Keeping **`buildTrip` / `applyVesselPredictions` / `ActionCtx` reads unchanged** in this phase (that is Phase 2).

**Out of scope for Phase 1:** Replacing `ActionCtx` in `buildTrip`, prefetching schedule data, simplifying `runVesselOrchestratorTick` deps (Stage 3), or changing product behavior beyond structural parity.

---

## Why timeline assembly order matters (read this first)

Today, `processVesselTripsWithDeps`:

1. Runs **`processCompletedTrips`** (mutations inline, then collects **successful** boundary facts).
2. Runs **`processCurrentTrips`** (builds trips, **`upsertVesselTripsBatch`**, leave-dock mutations, **`successfulVessels`** from batch result).
3. Calls **`buildTimelineTickProjectionInput`** with `completedFacts` and `currentBranch` that **already reflect what persisted successfully**.

So **`tickEventWrites` must not be built from “pre-persist intentions” alone.** After you extract mutations, you must still call **`buildTimelineTickProjectionInput` only after** the applier has applied writes and you know:

- which **completed** handoffs actually succeeded, and  
- which vessels **`successfulVessels`** includes for the current branch.

Otherwise timeline overlays can reference trips that did not persist — a behavioral regression.

**Practical implication:** `processVesselTripsWithDeps` (or a thin orchestration helper it calls) should follow:

1. Compute transitions and run **build** steps (completed + current) to produce a **write plan** and any **intermediate branch data** needed to correlate facts to vessels.
2. **`applyVesselTripTickWritePlan(ctx, plan)`** (name TBD) runs mutations and returns **persist outcomes** (successful completed facts subset, `currentBranch` result with `successfulVessels`, etc.).
3. **`buildTimelineTickProjectionInput({ completedFacts, currentBranch, tickStartedAt })`** runs **after** step 2.

The public result **`VesselTripsTickResult`** (`tickEnvelope.ts`) can stay **`{ tickStartedAt, tickEventWrites }`**; only the **construction order** changes.

---

## Current mutation sites (must move to applier)

| Location | Mutation | Parallelism / notes |
| --- | --- | --- |
| [`processCompletedTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts) | `api.functions.vesselTrips.mutations.completeAndStartNewTrip` | Per-vessel `Promise.allSettled`; failures logged, facts dropped |
| [`processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts) | `upsertVesselTripsBatch` | Single batch after artifact merge |
| Same file | `setDepartNextActualsForMostRecentCompletedTrip` | After batch; **only** if vessel in **`successfulVessels`** |

Strip predictions with **`stripTripPredictionsForStorage`** exactly as today before each mutation payload.

**Ordering invariant:** **Completed phase before current phase** (already enforced in `processVesselTrips.ts`). Do not reorder.

---

## Suggested implementation shape (not prescriptive)

1. **Types (domain or shared types file under `updateVesselTrips/`):**  
   Define a **`VesselTripTickWritePlan`** (name TBD) holding, at minimum:
   - Items for each completed transition: **mutation args** for `completeAndStartNewTrip` and the **`CompletedTripBoundaryFact`** (or equivalent) to attach **if and only if** that mutation succeeds.
   - Current branch: **`activeUpserts`** array for batch (or empty), **`pendingLeaveDockEffects`** (today’s shape), **`pendingActualMessages` / `pendingPredictedMessages`** for the branch result used by the assembler.

   You may split “build-time artifacts” vs “persist payloads” if it keeps types clearer; the memo allows TBD naming.

2. **Refactor `processCompletedTrips`:**
   - Remove **`ActionCtx`** from the signature if it exists only for mutations (keep **`ctx`** only if still required for `buildTrip` inside `processCompletedTripTransition` — it is, until Phase 2).
   - **`processCompletedTripTransition`** should **stop** at `stripTripPredictionsForStorage` + return **args + fact**; **no** `await ctx.runMutation`.
   - **`normalizeCompletedTripResults`** still handles **rejected builds** (e.g. `buildTrip` threw); successful rows become plan entries. **Mutation success** is unknown until the applier runs — so “completed facts” passed to timeline assembly must be **filtered by applier results**, not only by Promise fulfillment of the transition function.

3. **Refactor `processCurrentTrips`:**
   - After **`collectCurrentTripArtifacts` / merge**, return **plan fragments** + message lists **without** calling **`upsertVesselTripsBatch`** or **`runLeaveDockPostPersistEffects`**.
   - Preserve **`getSuccessfulVessels`** logic inside the **applier** after the batch mutation returns (move the function or duplicate with a comment — prefer one shared helper next to the applier).

4. **Applier (functions layer):**  
   New module, e.g. under [`convex/functions/vesselTrips/`](../../convex/functions/vesselTrips/) or next to orchestrator — pick the least awkward import graph; **must not** create circular imports with domain.

   Responsibilities:
   - `Promise.allSettled` over completed mutations (same as today).
   - Build **successful `CompletedTripBoundaryFact[]`** in input order (or documented order) matching **`normalizeCompletedTripResults`** behavior.
   - Run **`upsertVesselTripsBatch`** when `activeUpserts.length > 0`.
   - Run leave-dock mutations for vessels in **`successfulVessels`**.
   - Return **`{ completedFacts, currentBranch }`** (or whatever `buildTimelineTickProjectionInput` needs — match existing types in [`updateTimeline/types.ts`](../../convex/domain/vesselOrchestration/updateTimeline/types.ts)).

5. **Wire `processVesselTripsWithDeps`:**  
   Orchestrate: **build plan** → **apply** → **buildTimelineTickProjectionInput** → return **`VesselTripsTickResult`**.

6. **Orchestrator:**  
   [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts) (invoked from [`vesselOrchestrator/actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)) should still wire **`processVesselTripsWithDeps`**; if the applier must live outside domain, pass nothing new from the action **unless** you split applier into a separate import — avoid duplicating the three callbacks if **`processVesselTripsWithDeps`** fully encapsulates plan + apply + timeline.

---

## Files likely to touch

- [`convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts)
- [`convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts)
- [`convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts)
- New: applier module under `convex/functions/` (path TBD)
- [`convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts`](../../convex/domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput.ts) — **call site only** (ordering); avoid behavior change inside unless a signature update is required
- Tests listed below
- Optional: update [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) “open questions” if you lock in applier location

---

## Tests to update or extend

- [`convex/domain/vesselOrchestration/updateVesselTrips/tests/processCompletedTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processCompletedTrips.test.ts) — today may mock `ctx.runMutation`; switch to asserting **plan outputs** and/or drive the **applier** with a fake `ctx`.
- [`convex/domain/vesselOrchestration/updateVesselTrips/tests/processVesselTrips.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/processVesselTrips.test.ts) — update mocks and expectations for the new flow.
- Add **unit tests for the applier** (successful batch, per-row failure, leave-dock gated on `successfulVessels`, completed handoff failure drops fact).

Run after changes:

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

---

## Definition of done

- [ ] No `ctx.runMutation` in `processCompletedTrips.ts` or `processCurrentTrips.ts` (grep to confirm).
- [ ] Domain still performs **completed-before-current** ordering for **build** and for **apply** (single applier or documented sequence).
- [ ] **`buildTimelineTickProjectionInput`** runs **after** persistence outcomes are known; behavior matches pre-refactor semantics for success/partial-failure cases.
- [ ] Logging for per-vessel failures (completed trip, batch upsert, leave-dock) remains equivalent or intentionally improved (document any change in PR).
- [ ] All relevant tests pass; new tests cover the applier and mutation-failure filtering of timeline inputs.

---

## PR / review notes for the author

- Prefer **small commits**: (1) types + plan production, (2) applier + wire-up, (3) test migration.
- If payload size becomes a concern, note it for follow-up (chunking in functions layer); do not silently change batching in Phase 1 without team agreement.
- Phase 2 will remove **`ActionCtx`** from **`buildTrip`** / adapters; avoid drive-by refactors there.

---

## Document history

- **2026-04-17:** Initial handoff for Phase 1 implementation.
