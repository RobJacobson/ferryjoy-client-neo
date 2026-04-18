# Handoff: Step A — `executeVesselOrchestratorTick` (functions-owned orchestration)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Parent plan:** [`docs/engineering/vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md) — **§3 Step A**

---

## Goal (Step A only)

Add a **new** Convex orchestration entry under **`convex/functions/vesselOrchestrator/`**
that contains **today’s** `runVesselOrchestratorTick` behavior **without** going
through `VesselOrchestratorTickDeps`. Persistence is **inlined** using `ActionCtx`
(same mutations/queries as [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)).

**Scope boundary:** Step A **adds** this module and ensures it typechecks. It
does **not** require switching [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts)
off the domain entry (that is **Step B** in the parent memo). It does **not**
delete [`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)
or remove [`createVesselOrchestratorTickDeps`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)
(that is **Steps B–D**). If you land **only** Step A, the repo may temporarily
have **two** orchestration implementations until Step B wires the action.

---

## Why

The original product goal: **domain** should not **schedule** or **invoke**
persistence. Today [`runVesselOrchestratorTick`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)
still takes three injected async callbacks. Step A moves that control flow into
**functions** as a single `ctx`-first function, preserving semantics.

---

## Source of truth (copy behavior from here)

1. **Control flow, metrics, logging, errors:**  
   [`convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts)  
   — `Promise.allSettled` of `runLocations` vs `runTripLifecycleAndTimeline`,
   `tickMetrics`, `[VesselOrchestratorTick]` JSON log, `errors` shape,
   `locationsSuccess` / `tripsSuccess`.

2. **What each “dep” did in production:**  
   [`convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts`](../../convex/functions/vesselOrchestrator/createVesselOrchestratorTickDeps.ts)  
   - `persistLocations` → [`runUpdateVesselLocationsTick`](../../convex/domain/vesselOrchestration/updateVesselLocations/runUpdateVesselLocationsTick.ts)
     with `ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, args)`  
   - `processVesselTrips` → [`runProcessVesselTripsTick`](../../convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts)
     with `createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx), createVesselTripPredictionModelAccess(ctx))`  
   - `applyTickEventWrites` → [`applyTickEventWrites`](../../convex/functions/vesselOrchestrator/applyTickEventWrites.ts)(`ctx`, writes)

3. **Types:**  
   [`convex/domain/vesselOrchestration/types.ts`](../../convex/domain/vesselOrchestration/types.ts) — `VesselOrchestratorTickInput`, `VesselOrchestratorTickResult`, `VesselOrchestratorTickMetrics`

Reuse **domain pure helpers** exactly as today: `isTripEligibleLocation`,
`computeShouldRunPredictionFallback` (from
[`updateVesselTrips`](../../convex/domain/vesselOrchestration/updateVesselTrips/index.ts)),
and the same `processOptions` object.

---

## Implementation checklist

1. **Create** `convex/functions/vesselOrchestrator/executeVesselOrchestratorTick.ts`
   (or a name your reviewer prefers; keep it exported and documented).

2. **Signature** (match intent of parent memo):

   ```ts
   export const executeVesselOrchestratorTick = async (
     ctx: ActionCtx,
     input: VesselOrchestratorTickInput
   ): Promise<VesselOrchestratorTickResult> => { ... }
   ```

3. **Inline** `createScheduledSegmentLookup` if it is only used for this tick —
   either **copy** the private helper from `createVesselOrchestratorTickDeps.ts`
   into the new file or **extract** it to a small shared `functions/vesselOrchestrator/`
   helper module to avoid duplication between the factory and `executeVesselOrchestratorTick`.
   Avoid importing `createVesselOrchestratorTickDeps` from inside
   `executeVesselOrchestratorTick` (that would defeat the purpose); prefer shared
   **pure** `lookup` builders or duplicated minimal closure **until** Step C
   deletes the factory.

4. **Preserve** behavior:
   - Same trip-eligible filter as `runVesselOrchestratorTick`.
   - Same parallel/sequential structure and `Promise.allSettled` semantics.
   - Same `console.error` messages for branch failures (grep existing strings).
   - Same `[VesselOrchestratorTick]` log payload shape.

5. **Do not** change product semantics (ordering, branch isolation, metric keys).

---

## Verification

- `bun run check:fix`
- `bun run type-check`
- `bun run convex:typecheck`

**Recommended parity check** (pick one):

- **A.** Temporary test (can live next to the new file or under
  `convex/functions/vesselOrchestrator/tests/`) that calls **both**
  `runVesselOrchestratorTick(input, createVesselOrchestratorTickDeps(fakeCtx))`
  and `executeVesselOrchestratorTick(fakeCtx, input)` with the same fake `ctx`
  spies and asserts identical `tickMetrics` / success flags / error keys for a
  few scenarios; **or**

- **B.** Manual comparison in a follow-up PR (Step B) — document in PR if you
  skip automated parity in Step A.

---

## Out of scope for Step A

- Updating `actions.ts` to call the new function (**Step B**).
- Removing `runVesselOrchestratorTick`, `VesselOrchestratorTickDeps`, or
  `createVesselOrchestratorTickDeps` (**Steps C–D**).
- Moving [`runVesselOrchestratorTick.test.ts`](../../convex/domain/vesselOrchestration/tests/runVesselOrchestratorTick.test.ts)
  (**Step E**).
- Doc sweep across the repo (**Step F**) — optional one-line comment in the new
  file pointing to the parent memo is enough for Step A.

---

## References

- Parent memo §3 Steps A–F: [`vessel-orchestrator-functions-owned-orchestration-memo.md`](../engineering/vessel-orchestrator-functions-owned-orchestration-memo.md)
- Trip stack runner (unchanged): [`runProcessVesselTripsTick.ts`](../../convex/functions/vesselOrchestrator/runProcessVesselTripsTick.ts)

---

## Document history

- **2026-04-17:** Initial handoff (Step A only).
