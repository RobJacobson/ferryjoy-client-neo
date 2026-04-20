# Engineering memo: decouple trip lifecycle from prediction policy (north star)

**Status:** North-star specification — implementation in progress  
**Audience:** Engineers and coding agents working on `updateVesselTrips`, `updateVesselPredictions`, `convex/functions/vesselOrchestrator`, and shared orchestrator handoff types  
**Scope:** Where prediction *policy* lives, how `tickStartedAt` is used, and how we simplify **`updateVesselTrips`** without blocking a later full rewrite of **`updateVesselPredictions`**.

**Related (layering and contracts):**

- [`docs/engineering/complete/vessel-orchestrator-idempotent-four-pipelines-prd.md`](./complete/vessel-orchestrator-idempotent-four-pipelines-prd.md)
- [`docs/engineering/imports-and-module-boundaries-memo.md`](./imports-and-module-boundaries-memo.md)

**Follow-on:** Per-stage handoff notes (checklists, files, tests) may be added separately; this document stays the **single directional anchor**.

**Stage handoffs:**

- Phase A (policy in `updateVesselPredictions`): [`docs/handoffs/vessel-trips-phase-a-prediction-policy-handoff-2026-04-19.md`](../handoffs/vessel-trips-phase-a-prediction-policy-handoff-2026-04-19.md)
- Phase B (slim `updateVesselTrips`): [`docs/handoffs/vessel-trips-phase-b-trip-layer-slim-handoff-2026-04-19.md`](../handoffs/vessel-trips-phase-b-trip-layer-slim-handoff-2026-04-19.md)

---

## 1. Summary

Today, **`updateVesselTrips`** still computes **prediction-oriented policy** (ML gate booleans and a sub-minute “fallback” window derived from **`tickStartedAt`**). That policy belongs to the **predictions** concern, not to trip lifecycle.

**Primary goal:** **`updateVesselTrips`** should produce **schedule- and lifecycle-shaped trip DTOs** and the **`TripComputation`** handoff needed for persistence and downstream stages, **without** owning *when* or *whether* ML work is attempted from a product-policy perspective.

**Secondary goal (later):** **`updateVesselPredictions`** will move toward **recompute every tick** and **`convex/functions`** will **suppress unchanged rows** (compare-then-write / equality), per the four-pipeline PRD. That is a **larger simplification** and may be phased **after** trip-layer decoupling.

**Explicit tradeoff:** It is acceptable to **temporarily** leave transitional helpers, duplicated logic, or inelegant structure **inside `updateVesselPredictions`** while we clean **`updateVesselTrips`**. Do not let perfect predictions-module design block trip simplification.

---

## 2. Current shape of the code (baseline)

### 2.1 `updateVesselTrips` (domain)

- **Public runner:** `runUpdateVesselTrips` (`runUpdateVesselTrips.ts`) calls **`computeVesselTripsWithClock`**, which threads **`tickStartedAt`** into **`computeVesselTripsBundle`**.
- **`computeShouldRunPredictionFallback(tickStartedAt)`** (`processTick/processVesselTrips.ts`) maps wall time to a boolean (first ~10 seconds of each UTC minute). That boolean is passed as **`shouldRunPredictionFallback`** into **`processCompletedTrips`** / **`processCurrentTrips`** and then into **`buildTripCore`**.
- **`buildTripCore`** (`tripLifecycle/buildTrip.ts`) returns **`BuildTripCoreResult`**: `{ withFinalSchedule, gates }`, where **`gates`** is **`VesselPredictionGates`** imported from **`updateVesselPredictions`**. Gate math combines **trip/events** with **`shouldRunPredictionFallback`** (time window).
- **`RunUpdateVesselTripsInput`** includes **`tickStartedAt`**, largely to support that fallback path.
- **`TripComputation`** (`contracts.ts`) carries **`tripCore.withFinalSchedule`** and optional **`tripCore.gates`** (typed from **`BuildTripCoreResult`**).

### 2.2 Shared handshake and persist mapping

- **`CompletedTripBoundaryFact`**, **`CurrentTripActualEventMessage`**, **`CurrentTripPredictedEventMessage`** (`shared/tickHandshake/types.ts`) embed **`BuildTripCoreResult`** (including **`gates`**) in **`newTripCore` / `tripCore`**.
- **`tripComputationPersistMapping.ts`** requires **`tripCore.gates`** for several mappings used when translating **`RunUpdateVesselTripsOutput`** into persist/timeline-oriented shapes.

### 2.3 `updateVesselPredictions` (domain)

- **`runUpdateVesselPredictions`** (`orchestratorPredictionWrites.ts`) reads **`computation.tripCore.gates`** when calling **`applyVesselPredictions`**, with small compatibility branches when gates are missing.
- **`RunUpdateVesselPredictionsInput`** already includes **`tickStartedAt`** (used for contracts and orchestration; gate derivation may move here).

### 2.4 `convex/functions/vesselOrchestrator/actions.ts`

- **`buildPredictionContextRequests`** inspects **`computation.tripCore.gates`** to decide which terminal-pair / model-type preloads to fetch for the tick.

---

## 3. Problem statement

- **Separation of concerns:** Trip lifecycle is **mixed with prediction policy** (gates + clock-driven fallback). That violates the intent of the four-pipeline model: trips authoritatively describe **where the vessel is in the schedule/trip state machine**; predictions describe **how we attach or refresh ML-derived fields** and **what to persist** in prediction tables.
- **Cognitive load:** Readers must understand **`tickStartedAt` semantics inside `updateVesselTrips`** even when the only consumer of that policy is effectively the **predictions** phase and preload.
- **Future direction:** “Run predictions every tick; diff in `functions`” is **incompatible** with keeping fine-grained event/gate policy **inside trip builders** unless those gates are strictly **trip-semantic** (they are not — they are ML attempt flags).

---

## 4. North-star principles

1. **`updateVesselTrips`** owns **locations + existing trips + schedule context → trip rows + `TripComputation` handoff** for persistence and downstream consumers. It does **not** own **ML attempt policy** or **sub-minute windows** for ML.
2. **`updateVesselPredictions`** owns **prediction policy** (what to attempt, how **`tickStartedAt`** affects behavior, and how **`applyVesselPredictions`** is driven) until a later redesign replaces internals wholesale.
3. **`convex/functions`** owns **preload sizing**, **persistence**, and **write suppression** (unchanged from the four-pipeline PRD).
4. **Incremental delivery is mandatory:** land **trip simplification** with **behavior-preserving** checkpoints where possible; **prediction module** may accumulate temporary adapters rather than blocking on a full rewrite.

---

## 5. What is changing (directional)

### 5.1 Phase A — Move policy into `updateVesselPredictions` (behavior parity)

- Introduce **prediction-side** derivation of **`VesselPredictionGates`** (and move **`computeShouldRunPredictionFallback`** here or retire it when policy changes — see §6).
- **`runUpdateVesselPredictions`** (and **`actions.ts`** preload helpers) should use **one** derivation path so preload and **`applyVesselPredictions`** stay aligned.
- **Acceptance:** same inputs → same effective gates / same ML behavior as today (tests or targeted parity checks).

**Note:** During transition, **`TripComputation`** may still carry **`gates`** for compatibility, or trips may stop emitting them once derivation is proven — either is acceptable if types and mappings are updated consistently.

### 5.2 Phase B — Simplify `updateVesselTrips` (primary focus)

- Remove **`shouldRunPredictionFallback`**, **`computeShouldRunPredictionFallback`**, and the **clock-only** wiring from **`computeVesselTripsBundle`** / **`computeVesselTripsWithClock`** / **`runUpdateVesselTrips`** as they exist solely for ML policy.
- **`buildTripCore`** should return **schedule/lifecycle outputs only** (rename/split types as needed so **`updateVesselTrips`** does not import **`VesselPredictionGates`**).
- Revisit **`RunUpdateVesselTripsInput`**: drop **`tickStartedAt`** if nothing **trip-semantic** requires it after Phase B.
- Update **`contracts`**, **`shared/tickHandshake`**, and **`tripComputationPersistMapping`** so handshake types **do not require trips to manufacture `gates`**. Where messages still need ML-related metadata for timeline merge, attach it from **predictions** or derive from **`TripEvents` + trip rows** — **prefer explicit types over reusing `BuildTripCoreResult`**.

### 5.3 Phase C — Optional / later (not blocking Phases A–B)

- **`updateVesselPredictions`:** every-tick recompute, thinner **`applyVesselPredictions`** surface, stronger **`functions`**-layer diffing.
- **Cleanup** of transitional code paths inside **`updateVesselPredictions`** once trips and handshake types are stable.

---

## 6. Final intended direction of the code

| Area | Intended end state |
|------|---------------------|
| **`updateVesselTrips`** | Pure **trip lifecycle + schedule enrichment**; **no** ML gate types from **`updateVesselPredictions`** in **`buildTripCore`**; **no** orchestrator **clock** used only for ML fallback. **`TripComputation`** describes **trips**, not ML policy. |
| **`updateVesselPredictions`** | Owns **all** “should we run / which slots” policy that is not strictly **trip geometry**; may still be messy internally until Phase C. |
| **`actions.ts`** | Continues to **preload**, **call domain**, **persist**, **diff**; preload rules follow **prediction-side** policy helpers, not trips. |
| **`shared` handshake** | **Trip-native** shapes for persist and timeline wiring; **no** requirement that trips emit **`VesselPredictionGates`**. |

**Longer horizon (aligned with product architecture, not a prerequisite for Phase B):** predictions run **every tick**, outputs are **always** “current truth,” and **unchanged rows are filtered in `functions`** — reducing event-gated ML logic over time.

---

## 7. Explicit non-goals (for this memo’s refactor track)

- Perfect, minimal **`updateVesselPredictions`** internals in the same milestone as **`updateVesselTrips`** slimming — **allowed to lag** behind with deliberate tech debt.
- Changing **WSF fetch cadence**, **cron** behavior, or **timeline semantics** unless required by type or handshake fixes (call out in stage handoffs if touched).
- Rewriting **compare-then-write** for predictions in **`functions`** before **`updateVesselPredictions`** strategy is settled (may follow Phase C).

---

## 8. Success criteria (for the overall track)

1. **`buildTripCore` / `updateVesselTrips`** do not depend on **`VesselPredictionGates`** or **clock-derived ML fallback**.
2. **Prediction policy** has a **single home** in **`updateVesselPredictions`** (plus **`functions`** preload using the same rules).
3. **Orchestrator behavior** remains correct: **parity** or **intentionally documented** deltas only.
4. **Public import boundaries** respect [`imports-and-module-boundaries-memo.md`](./imports-and-module-boundaries-memo.md): no new long-lived deep imports across concerns.

---

## 9. Revision history

- **2026-04-19 (Phase A landed):** Central policy module
  [`convex/domain/vesselOrchestration/updateVesselPredictions/predictionPolicy.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/predictionPolicy.ts)
  owns `computeShouldRunPredictionFallback`, `computeVesselPredictionGates`, and
  `derivePredictionGatesForComputation`; `buildTripCore`, Stage D, and orchestrator
  preload use one derivation path. Completed boundary handoffs carry `events` for
  gate derivation. Phase B (strip gates / `tickStartedAt` from trips) remains.
- **2026-04-19:** Initial north-star memo (trip vs prediction policy decoupling; Phases A–C; explicit deferral of predictions-module beautification).
