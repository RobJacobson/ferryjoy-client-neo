# Handoff: Phase A — prediction policy lives in `updateVesselPredictions` (parity)

**Status:** Implemented (2026-04-19) — see `predictionPolicy.ts` and north-star §9.

**Parent spec:** [`docs/engineering/vessel-trips-prediction-policy-north-star-memo.md`](../engineering/vessel-trips-prediction-policy-north-star-memo.md) (§5.1 Phase A)  
**Date:** 2026-04-19  
**Audience:** Implementing agent (single PR or small stack)  
**Out of scope for this handoff:** Phase B (slim `updateVesselTrips` / remove `tickStartedAt` from trips / drop `gates` from `TripComputation` types), Phase C (every-tick predictions + `functions` diffing). Do **not** start Phase B here unless explicitly asked.

---

## 1. Mission

Establish a **single, prediction-owned implementation** for:

1. **`computeShouldRunPredictionFallback(tickStartedAt)`** (today in `convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts`).
2. **The boolean math behind `VesselPredictionGates`** (today inline in `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts` inside `buildTripCore`).

Wire **three call sites** to that implementation so **preload**, **`applyVesselPredictions`**, and **`buildTripCore`** cannot drift:

| Call site | File (current) |
|-----------|----------------|
| Trip lifecycle (still calls the helper in Phase A) | `tripLifecycle/buildTrip.ts` — `buildTripCore` |
| Stage D runner | `updateVesselPredictions/orchestratorPredictionWrites.ts` — `predictionGatesForComputation` / `buildPredictedTripComputation` |
| Orchestrator preload | `convex/functions/vesselOrchestrator/actions.ts` — `buildPredictionContextRequests` |

**Acceptance:** For the same orchestrator tick inputs as **main**, effective **`VesselPredictionGates`** per `TripComputation` and **`buildPredictionContextRequests`** output match **pre-change** behavior (tests or explicit parity assertions).

**Non-goal:** Making `updateVesselPredictions` pretty. Temporary duplication, verbose params, or a shim layer under `updateVesselPredictions/` is fine if it lands parity and avoids circular imports.

---

## 2. Read first (ground truth)

1. North star memo §2 (current shape) and §5.1 (Phase A).
2. `buildTripCore` gate block — `convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts` (returns `gates: { shouldAttemptAtDockPredictions, shouldAttemptAtSeaPredictions, didJustLeaveDock }`).
3. `computeShouldRunPredictionFallback` — `processTick/processVesselTrips.ts`.
4. `predictionGatesForComputation` — `updateVesselPredictions/orchestratorPredictionWrites.ts`.
5. `buildPredictionContextRequests` — `convex/functions/vesselOrchestrator/actions.ts` (uses `computation.tripCore.gates` + terminal pair from `withFinalSchedule`).
6. Biome: `convex/functions/vesselOrchestrator/**/*.ts` must not deep-import `domain/.../updateVesselTrips/**` internals — use **`domain/vesselOrchestration/updateVesselTrips`** (peer entry) for types/helpers the barrel exports. See [`docs/engineering/imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md).

---

## 3. Suggested implementation strategy

### 3.1 Add a small policy module under `updateVesselPredictions`

Create something like:

- `convex/domain/vesselOrchestration/updateVesselPredictions/predictionPolicy.ts` (name is flexible)

It should own:

- **`computeShouldRunPredictionFallback(tickStartedAt: number): boolean`** — move the body verbatim from `processVesselTrips.ts` (first ~10s of each UTC minute, epoch-ms input).

- **`computeVesselPredictionGates(...)`** — pure inputs matching what `buildTripCore` already uses for the gate block:
  - A **trip-shaped row** used for the `gateTrip` checks (at-dock / at-sea / ML slot presence). Today that is the **pre-`appendFinalSchedule`** candidate in `buildTripCore`; the public handoff stores **`tripCore.withFinalSchedule`**. For parity, the extracted function must be called with whatever object **`buildTripCore`** used for `gateTrip` when computing gates, **or** document and prove that using **`withFinalSchedule`** is equivalent for those field reads. If you find ambiguity when `shouldAppendFinalSchedule` is true, **call the extracted helper from `buildTripCore` at the same point in the pipeline** (still on `gateTrip`) and pass `gateTrip` — that keeps one code path without changing trip output shape.

- Inputs must include **`shouldRunPredictionFallback: boolean`** (computed from `tickStartedAt` via `computeShouldRunPredictionFallback` at the **call site** that has the clock).

Also export **`didJustLeaveDock`** from **`TripEvents`** (already passed into `buildTripCore`) — it is part of `VesselPredictionGates`.

**Refactor `buildTripCore`** to call `computeVesselPredictionGates` instead of duplicating the arithmetic. **`buildTrip`** (composer with ML) should keep passing the same gates into `applyVesselPredictions`.

### 3.2 Export surface

Add exports from **`convex/domain/vesselOrchestration/updateVesselPredictions/index.ts`** for whatever **`actions.ts`** and **`processVesselTrips`** need (at minimum `computeShouldRunPredictionFallback` and a gate helper that can be driven from `TripComputation` + `tickStartedAt`).

Keep the public story coherent: it is OK to export “policy” helpers alongside `runUpdateVesselPredictions` for this migration.

### 3.3 `processVesselTrips.ts`

- Remove the local **`computeShouldRunPredictionFallback`** definition.
- Import it from **`updateVesselPredictions`** peer entry (see §4 on cycles).

### 3.4 `orchestratorPredictionWrites.ts`

Replace **`predictionGatesForComputation`** logic so gates come from **`computeVesselPredictionGates`** (or a thin wrapper **`derivePredictionGatesForComputation(computation, tickStartedAt)`** in the same folder) using **`input.tickStartedAt`** from **`RunUpdateVesselPredictionsInput`**.

You may need **`tripStart`** for each vessel; derive it the same way `buildTripCore` callers do today (`processCurrentTrips` / `processCompletedTrips`). If that is not on `TripComputation`, thread it through the wrapper using **`events`** + **`existingTrip`** + **`withFinalSchedule`** consistent with existing lifecycle rules — **do not guess**; trace call sites.

### 3.5 `actions.ts` — `buildPredictionContextRequests`

Stop relying on **`computation.tripCore.gates`** as the source of truth. Instead:

- For each `TripComputation`, compute the **same** gates using the **same** helper as Stage D, with the orchestrator’s **`tickStartedAt`** (same value passed into `runUpdateVesselPredictions`).

- Preserve existing behavior when **`gates` is undefined** (e.g. skip pair, or derive — match current preload size).

**Import path:** use **`domain/vesselOrchestration/updateVesselPredictions`** only (no deep `updateVesselPredictions/foo` paths from `functions/vesselOrchestrator` if Biome forbids it).

### 3.6 Tests

- Update **`computeVesselTripsWithClock.test.ts`** if it imported **`computeShouldRunPredictionFallback`** from `processVesselTrips` — point at the new export.
- Add or extend tests under **`updateVesselPredictions/tests/`** so **`derivePredictionGatesForComputation(computation, tickStartedAt)`** matches **`computation.tripCore.gates`** for representative **`TripComputation`** fixtures **while trips still emit gates** (golden parity during Phase A).
- If **`runUpdateVesselPredictions.test.ts`** asserts “missing gates” errors, adjust expectations once derivation always runs.

---

## 4. Circular import hazard

**Risk:** `updateVesselTrips` imports `updateVesselPredictions` (already true for `buildTripCore` → `applyVesselPredictions`). `updateVesselPredictions/index.ts` re-exports heavy modules that import `TripComputation` from `updateVesselTrips`. **`processVesselTrips.ts`** importing from `updateVesselPredictions/index` may create a **runtime cycle** (load order / undefined exports).

**Mitigations (pick one, verify with `bun run type-check` and a quick runtime smoke):**

1. Implement **`predictionPolicy.ts`** with **no** import of `updateVesselTrips` (only `TripEvents`, schema types, etc.). Export it from `index.ts` **without** changing export order if possible.
2. If the cycle persists, import **`computeShouldRunPredictionFallback`** from a **direct file path** only where the barrel causes cycles — **document a one-line biome-ignore** with rationale, or split a tiny **`updateVesselPredictions/policyEntry.ts`** re-export used only by `processVesselTrips` (last resort).
3. Transitional placement of the tick helper in **`domain/vesselOrchestration/shared/`** is acceptable **only** if (1)–(2) fail; note it in the PR for Phase B cleanup.

---

## 5. Definition of done

- [ ] **`computeShouldRunPredictionFallback`** lives under **`updateVesselPredictions`** (not `processVesselTrips`).
- [ ] **Gate math** for `shouldAttemptAtDockPredictions` / `shouldAttemptAtSeaPredictions` / `didJustLeaveDock` is implemented **once** and reused by **`buildTripCore`**, **`runUpdateVesselPredictions`**, and **`buildPredictionContextRequests`**.
- [ ] **`bun run type-check`** (or project equivalent) passes.
- [ ] **Biome / lint** passes for touched paths (respect `functions/vesselOrchestrator` import rules).
- [ ] Tests updated or added for parity / regressions (§3.6).
- [ ] Short PR description: what moved, why, and that Phase B will remove gates from **`buildTripCore`** / **`TripComputation`** next.

---

## 6. Explicit deferrals (do not do in Phase A)

- Removing **`tickStartedAt`** from **`RunUpdateVesselTripsInput`**.
- Removing **`tripCore.gates`** from **`TripComputation`** or handshake types.
- Changing **`applyVesselPredictions`** semantics or prediction persistence / compare-then-write.
- “Every tick full recompute + diff only in `actions`” — that is Phase C / separate memo.

---

## 7. Revision history

- **2026-04-19:** Initial Phase A handoff (parity, three call sites, tests, cycle notes).
