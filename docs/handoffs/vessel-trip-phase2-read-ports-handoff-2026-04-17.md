# Handoff: Phase 2 — Remove `ActionCtx` from trip build and prediction reads

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisite:** Phase 1 complete ([`vessel-trip-phase1-write-plan-handoff-2026-04-17.md`](vessel-trip-phase1-write-plan-handoff-2026-04-17.md), [`applyVesselTripTickWritePlan`](../../convex/functions/vesselTrips/applyVesselTripTickWritePlan.ts)).  
**Parent doc:** [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) (Stage 2)

---

## Goal

**Domain code must not depend on `ActionCtx` from `_generated/server` for reads**
during trip building and prediction attachment. Replace that with **narrow,
testable ports** (interfaces) implemented in the **functions** layer using the
**same** Convex queries and behavior as today.

**Out of scope**

- Changing tick semantics, mutation ordering, or timeline assembly rules.
- Stage 3 orchestrator / `runVesselOrchestratorTick` callback cleanup (separate
  handoff).
- **Prefetch (optional Stage 2b)** unless you explicitly add a perf spike; design
  ports so prefetch can plug in later without another signature churn.

---

## Current state (what to refactor)

### Trip schedule / effective location (mostly type-level debt)

[`VesselTripsBuildTripAdapters`](../../convex/domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters.ts)
still types **`resolveEffectiveLocation`** and **`appendFinalSchedule`** with
**`ctx: ActionCtx`**, but production implementations in
[`buildTripRuntimeAdapters.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/buildTripRuntimeAdapters.ts)
already use **`_ctx: unknown`** and rely entirely on
[`ScheduledSegmentLookup`](../../convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment.ts)
(`getScheduledDepartureEventBySegmentKey`, `getScheduledDockEventsForSailingDay`).

[`buildTrip.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts)
and **`buildTripCore`** still take **`ctx: ActionCtx`** and pass it into adapters
and **`applyVesselPredictions`**.

### Predictions (real `ctx` usage)

[`applyVesselPredictions`](../../convex/domain/vesselOrchestration/updateVesselPredictions/applyVesselPredictions.ts)
→
[`appendPredictions.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/appendPredictions.ts)
→ **`computePredictions`** → **`loadModelsForPairBatch`** /
**`predictFromSpec`** in
[`predictTrip.ts`](../../convex/domain/ml/prediction/predictTrip.ts) /
[`vesselTripPredictions.ts`](../../convex/domain/ml/prediction/vesselTripPredictions.ts).

Those call **`ctx.runQuery`** (e.g. `getModelParametersForProductionBatch`) and
**`predictTripValue`** paths that need a Convex runtime. This is the substantive
part of Phase 2.

---

## Intended result

1. **`buildTrip` / `buildTripCore`** accept **no `ActionCtx`**. They receive either:
   - **nothing** extra (if adapters are fully self-contained via closure), or  
   - a **small read-only bag** (e.g. `TripPredictionReadScope` / `MlModelAccess`)
     that is **not** imported from `_generated/server`.

2. **`VesselTripsBuildTripAdapters`** method signatures **drop `ActionCtx`**;
   first parameter removed or replaced with an opaque / domain-owned type if you
   still need a hook for tests.

3. **Prediction stack:** Introduce one or two interfaces, for example:
   - **`loadModelsForPairBatch`-shaped** access to model parameters (mirrors
     today’s batch query), and/or  
   - **`predictTripValue`-shaped** access (whatever `predictFromSpec` needs from
     `ctx` today),

   implemented in **`convex/functions/...`** (or a small `predictionRuntime`
   module) by forwarding to **`ctx.runQuery`** with the **same** `api` refs as
   now.

4. **Tests:** Domain tests use **fakes** (in-memory model docs, no Convex).
   Existing tests that cast `{} as ActionCtx` should be replaced or narrowed.

5. **Grep gate:** No `ActionCtx` import in the trip lifecycle / prediction path
   files that are meant to be domain-pure, except where you deliberately keep a
   thin **functions-only** adapter file (document the boundary).

---

## Suggested implementation order (reduce risk)

### Step A — Trip adapters and `buildTrip` signature

1. Update **`VesselTripsBuildTripAdapters`** to remove **`ActionCtx`** from both
   methods.
2. Update **`buildTrip` / `buildTripCore`** to stop threading **`ctx`** into
   adapters (delete parameter or pass nothing).
3. Adjust **`createBuildTripRuntimeAdapters`** implementations: remove `_ctx`
   parameters entirely.
4. Update **`applyVesselPredictions`** call site in **`buildTrip`**: temporarily
   you may still pass **`ctx`** until Step B is done (or stub).

### Step B — Prediction read port

1. Inventory every **`ctx` use** under:
   - `updateVesselPredictions/appendPredictions.ts`
   - `domain/ml/prediction/predictTrip.ts` (e.g. `loadModelsForPairBatch`)
   - `domain/ml/prediction/vesselTripPredictions.ts` (`predictFromSpec` →
     `predictTripValue`)

2. Define a **`PredictionRuntime`** (name TBD) interface with methods matching
   those needs **without** Convex types.

3. **Implement** it once next to orchestrator wiring or **`defaultProcessVesselTripsDeps`**:
   closure over **`ActionCtx`** calling the same **`api.functions.predictions`**
   queries as today.

4. Thread the port into **`applyVesselPredictions`** (and down through
   **`computePredictions`**) instead of **`ActionCtx`**.

5. Remove **`ActionCtx`** from **`applyVesselPredictions`** public signature.

### Step C — Tests and verification

- Update
  [`applyVesselPredictions.test.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/tests/applyVesselPredictions.test.ts)
  and any **`buildTrip`** tests.
- Run: `bun run check:fix`, `bun run type-check`, `bun run convex:typecheck`.

---

## Optional: Stage 2b (prefetch)

If profiling shows too many schedule or model queries per tick:

- Add **one** internal query (or batched queries) at orchestrator or
  **`processVesselTripsWithDeps`** entry that loads data for **all vessels in
  the tick**, then implement **`ScheduledSegmentLookup`** / model access from
  in-memory maps.

Only do this when justified; ports from Step B should make prefetch a **swap**
of implementation, not another domain API break.

---

## Definition of done

- [ ] `buildTrip` / `buildTripCore` do not take **`ActionCtx`**.
- [ ] **`VesselTripsBuildTripAdapters`** does not mention **`ActionCtx`**.
- [ ] **`applyVesselPredictions`** (and the append path it uses) do not take
      **`ActionCtx`**; they use an explicit port type implemented in functions.
- [ ] No behavioral regression: same queries, same mutation payloads from Phase
      1 applier, same timeline outputs for representative ticks (staging or
      test suite).
- [ ] Tooling passes: `check:fix`, `type-check`, `convex:typecheck`.

---

## References

- Memo Stage 2: [`docs/vessel-orchestrator-domain-persistence-refactor-memo.md`](../vessel-orchestrator-domain-persistence-refactor-memo.md) (section 4, Stage 2).
- Phase 1 handoff: [`docs/handoffs/vessel-trip-phase1-write-plan-handoff-2026-04-17.md`](vessel-trip-phase1-write-plan-handoff-2026-04-17.md).

---

## Document history

- **2026-04-17:** Initial Phase 2 handoff.
