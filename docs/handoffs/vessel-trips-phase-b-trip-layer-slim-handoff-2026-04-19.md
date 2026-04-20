# Handoff: Phase B — slim `updateVesselTrips` (no ML gates or clock-only policy)

**Status:** Ready to implement (depends on Phase A — [`vessel-trips-phase-a-prediction-policy-handoff-2026-04-19.md`](./vessel-trips-phase-a-prediction-policy-handoff-2026-04-19.md))

**Parent spec:** [`docs/engineering/vessel-trips-prediction-policy-north-star-memo.md`](../engineering/vessel-trips-prediction-policy-north-star-memo.md) (§5.2 Phase B, §6 table)

**Date:** 2026-04-19  
**Audience:** Implementing agent(s)

**Out of scope:** Phase C (every-tick predictions + functions-only diffing, `applyVesselPredictions` rewrite). Do not change prediction persistence semantics beyond what types and call signatures require.

---

## 1. Mission

Remove **ML attempt policy** and **orchestrator clock wiring** from the **`updateVesselTrips`** pipeline so that concern owns only:

- **Schedule + lifecycle-shaped trip rows**, and  
- **`TripComputation`** handoffs sufficient for **persistence** and **downstream consumers**,

without **`VesselPredictionGates`** on public trip outputs or **`tickStartedAt`** on **`RunUpdateVesselTripsInput`** when it exists only for ML fallback.

**Phase A already:** centralizes gate derivation in **`updateVesselPredictions/predictionPolicy.ts`** (`derivePredictionGatesForComputation`, etc.). Phase B **stops emitting** `gates` from **`buildTripCore`** and **`TripComputation`**, and **stops threading** `shouldRunPredictionFallback` / `tickStartedAt` through the trip tick stack.

**Orchestrator behavior** for predictions and preload should remain correct because Stage D and **`buildPredictionContextRequests`** already derive gates from **`TripComputation` + `tickStartedAt`** (Phase A).

---

## 2. Preconditions

- Phase A merged: **`predictionPolicy.ts`** is canonical for gates + fallback clock interpretation.
- Read **`derivePredictionGatesForComputation`** TSDoc in **`predictionPolicy.ts`** (especially **`tripStart`** inference vs `branch`).
- Read north star §5.2 and §6.

---

## 3. Target end state (Phase B)

| Area | Requirement |
|------|-------------|
| **`buildTripCore`** | Returns **schedule/lifecycle data only** — e.g. `{ withFinalSchedule }` — **no** `gates` field. Rename type if helpful (`TripScheduleCoreResult`, etc.). |
| **`buildTrip`** (composer) | Still composes **`buildTripCore`** + **`applyVesselPredictions`** for tests / legacy callers: compute gates via **`computeVesselPredictionGates`** (from **`updateVesselPredictions`**) using the **same** `gateTrip` / `events` / `tripStart` / **`shouldRunPredictionFallback`** as today — **or** pass explicit `shouldRunPredictionFallback` from test harness. Orchestrator path uses **`buildTripCore` only** via deps; ML attaches in Stage D. |
| **`computeVesselTripsBundle` / `processCompletedTrips` / `processCurrentTrips`** | Remove **`shouldRunPredictionFallback`** parameter chain entirely. **`buildTripCore`** drops that parameter. |
| **`computeVesselTripsBundle`** | Remove **`tickStartedAt`** from the signature if it becomes unused (today often only forwarded for fallback default). |
| **`computeVesselTripsWithClock`** | Either **delete** and inline into **`runUpdateVesselTrips`**, or **narrow** to “bundle compute” without clock / fallback (rename if misleading). Eliminate **`tickStartedAt`** echo on the result if nothing trip-semantic needs it. |
| **`RunUpdateVesselTripsInput`** | **No `tickStartedAt`** unless you find a **trip-only** use (e.g. logging); ML must not be the reason. |
| **`TripComputation`** (`contracts.ts`) | **`tripCore`** contains **`withFinalSchedule`** (and optional non-ML fields you still need, e.g. `gates` **deleted**). |
| **`shared/tickHandshake/types.ts`** | **`CompletedTripBoundaryFact.newTripCore`**, **`CurrentTrip*Message.tripCore`** no longer use **`BuildTripCoreResult`** if that type included gates. Prefer a **shared** “trip core without ML gates” type (e.g. `{ withFinalSchedule; gates?: never }` or a dedicated **`TripScheduleCore`**) imported from a trips-owned type module **or** defined in **`shared/`** to avoid `updateTimeline` importing `buildTrip` internals — follow [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md). |
| **`tripComputationPersistMapping.ts`** | Stop requiring **`computation.tripCore.gates`**. Persist and messages carry **`withFinalSchedule`** (and **`events`** where needed). If timeline merge still needs gate-shaped data, **derive** with **`derivePredictionGatesForComputation`** at the **merge site** (timeline / predictions), not from Stage C rows. |
| **`functions/vesselOrchestrator/actions.ts`** | **`runUpdateVesselTrips({ ... })`** call **drops** `tickStartedAt` from the object if removed from input. Orchestrator **still** owns **`tickStartedAt`** for locations, schedule query, predictions, timeline. |
| **Barrel exports** | **`updateVesselTrips/index.ts`**: remove **`computeShouldRunPredictionFallback`** re-export if nothing outside needs it from the trips barrel (prefer imports from **`updateVesselPredictions`**). Update **`convex/domain/vesselOrchestration/index.ts`** comments/exports accordingly. |

---

## 4. Implementation sequence (suggested)

1. **Types first (compile-guided)**  
   - Introduce **`TripScheduleCoreResult`** (name flexible): `{ withFinalSchedule: VesselTripCoreProposal }` (or equivalent).  
   - Change **`buildTripCore`** to return that type and **delete** inline **`computeVesselPredictionGates`** call from **`buildTripCore`** (gate math moves out of this function entirely).

2. **`buildTrip` composer**  
   - After `const core = await buildTripCore(...)`, call **`computeVesselPredictionGates(gateTrip, events, tripStart, shouldRunPredictionFallback)`** — you may need to keep **`shouldRunPredictionFallback`** as a **parameter to `buildTrip` only** for test parity, or thread from a test clock. **Do not** add fallback back into **`runUpdateVesselTrips`**.

3. **Processors**  
   - **`processCompletedTrips` / `processCurrentTrips`**: remove **`shouldRunPredictionFallback`** from signatures and **`buildTripCore`** calls.  
   - **`processVesselTrips`**: remove **`computeShouldRunPredictionFallback`** usage and **`ProcessVesselTripsOptions`** fields tied to fallback.  
   - **`computeVesselTripsWithClock`**: simplify per §3.

4. **`runUpdateVesselTrips`**  
   - Drop **`tickStartedAt`** from input; adjust **`computeVesselTripsWithClock`** caller.

5. **Handshake + mapping**  
   - Replace **`BuildTripCoreResult`** in **`tickHandshake/types.ts`** with schedule-only core type.  
   - Update **`tripComputationPersistMapping`**, **`persistVesselTripWriteSet`**, **`buildTimelineTripComputationsForRun`**, and any **merge** code that assumed **`tripCore.gates`** on Stage C rows.

6. **Consumers**  
   - **Timeline / updateTimeline tests**, **orchestrator tick tests**, **`persistVesselTripWriteSet.test.ts`**, **`vesselTripTickWriteSet`**, **`runUpdateVesselTrips.test.ts`** — update fixtures (remove `gates` from trip outputs where redundant).  
   - **`predictionPolicy.test.ts`**: update parity tests that compared to **`tripCore.gates`** — derive expected gates from **`derivePredictionGatesForComputation`** only, or from **`computeVesselPredictionGates`** with explicit inputs.

7. **Cleanup**  
   - Remove dead exports; run **`bun run type-check`**, **`bunx biome check`**, and targeted **`bun test convex/`** (or project test command).

---

## 5. Risk notes

1. **`buildTrip` tests** — Any test that asserted on **`core.gates`** from **`buildTripCore`** must switch to **`buildTrip`** or explicit **`computeVesselPredictionGates`**.

2. **Timeline projection** — If assembly used **`gates`** from handshake for something other than ML preload, re-derive or use **`TripEvents`**; search for **`tripCore.gates`** and **`BuildTripCoreResult`** in **`updateTimeline`** and **`shared`**.

3. **Import cycles** — Prefer **`shared`** types for handshake “schedule core” if **`updateTimeline`** must not deep-import **`updateVesselTrips/tripLifecycle/buildTrip`**.

4. **Parity** — After removal, Stage D behavior should be unchanged (gates from **`derivePredictionGatesForComputation`**). Trip **row** equality tests may need expectation updates if they accidentally depended on gate fields on DTOs.

---

## 6. Testing strategy

| Area | Action |
|------|--------|
| `updateVesselTrips/tests/*` | Remove/adjust assertions on **`tripCore.gates`**; fix **`runUpdateVesselTrips`** input (no **`tickStartedAt`**). |
| `updateVesselPredictions/tests/predictionPolicy.test.ts` | Stop depending on trips emitting **`gates`**; test derivation in isolation. |
| `functions/vesselOrchestrator/tests/*` | Mock **`buildTripCore`** / bundle shapes without **`gates`** if applicable. |
| `functions/vesselTrips/tests/persistVesselTripWriteSet.test.ts` | Handshake fixtures without **`gates`** on **`newTripCore`**. |
| `shared/orchestratorPersist/tests/*` | Align with new mapping rules. |
| Integration | Optional: one orchestrator-path test that **`tripComputations`** lack **`gates`** but predictions + preload still run. |

---

## 7. Definition of done

- [ ] **`buildTripCore`** does not return **`gates`** and does not take **`shouldRunPredictionFallback`**.
- [ ] **`RunUpdateVesselTripsInput`** has no **`tickStartedAt`** unless documented trip-only need.
- [ ] **`TripComputation`**, **`CompletedTripBoundaryFact`**, and current-trip messages do not require trips to populate **`VesselPredictionGates`**.
- [ ] **`tripComputationPersistMapping`** / persist path updated; **`bun run type-check`** and lint pass.
- [ ] **`actions.ts`** still passes orchestrator **`tickStartedAt`** to predictions, timeline, and schedule — only trips input shrinks.
- [ ] North star §8 success criteria (1) satisfied for the trip layer: no **`VesselPredictionGates`** or clock-derived fallback **in `updateVesselTrips` public pipeline**.

---

## 8. Explicit deferrals

- Rewriting **`updateVesselPredictions`** to “every tick + diff in functions” (Phase C).
- Removing **`derivePredictionGatesForComputation`** or simplifying **`applyVesselPredictions`** (can follow Phase B in a separate PR).

---

## 9. Revision history

- **2026-04-19:** Initial Phase B handoff (trip layer slim; types, mapping, tests).
