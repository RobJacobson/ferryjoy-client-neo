# Engineering memo: decouple trip lifecycle from prediction policy (north star)

**Status:** North-star specification — Phases A–C complete (Phase C: predictions refill mode + functions dedupe — see §5.3, §9)  
**Audience:** Engineers and coding agents working on `updateVesselTrips`, `updateVesselPredictions`, `convex/functions/vesselOrchestrator`, and shared orchestrator handoff types  
**Scope:** Where prediction *policy* lives, how `tickStartedAt` is used, and how we simplify **`updateVesselTrips`** without blocking a later full rewrite of **`updateVesselPredictions`**.

**Related (layering and contracts):**

- [`docs/engineering/complete/vessel-orchestrator-idempotent-four-pipelines-prd.md`](./complete/vessel-orchestrator-idempotent-four-pipelines-prd.md)
- [`docs/engineering/imports-and-module-boundaries-memo.md`](./imports-and-module-boundaries-memo.md)

**Follow-on:** Per-stage handoff notes (checklists, files, tests) may be added separately; this document stays the **single directional anchor**.

**Stage handoffs:**

- Phase A (policy in `updateVesselPredictions`): [`docs/handoffs/vessel-trips-phase-a-prediction-policy-handoff-2026-04-19.md`](../handoffs/vessel-trips-phase-a-prediction-policy-handoff-2026-04-19.md)
- Phase B (slim `updateVesselTrips`): [`docs/handoffs/vessel-trips-phase-b-trip-layer-slim-handoff-2026-04-19.md`](../handoffs/vessel-trips-phase-b-trip-layer-slim-handoff-2026-04-19.md)
- Phase C (predictions refill + functions diffing): [`docs/handoffs/vessel-trips-phase-c-predictions-simplification-handoff-2026-04-19.md`](../handoffs/vessel-trips-phase-c-predictions-simplification-handoff-2026-04-19.md) — **implemented**

---

## 1. Summary

**Trips vs predictions (Phases A–B done):** ML attempt policy and clock-derived fallback live under **`updateVesselPredictions`** (`predictionPolicy.ts`); **`updateVesselTrips`** exposes **`TripScheduleCoreResult`** / **`TripComputation`** without **`tripCore.gates`**, and **`runUpdateVesselTrips`** does not take orchestrator **`tickStartedAt`**.

**Primary goal (achieved for Phases A–B):** **`updateVesselTrips`** produces **schedule- and lifecycle-shaped trip DTOs** and the **`TripComputation`** handoff for persistence and downstream stages, **without** owning *when* or *whether* ML work is attempted from a product-policy perspective.

**Secondary goal (later — Phase C landed 2026-04-19):** **`updateVesselPredictions`** uses **`PREDICTION_ATTEMPT_MODE: refill-when-gates`** by default: phase-shaped gates plus **`appendPredictions`** refill when gates allow; **`convex/functions`** **`batchUpsertProposals`** suppresses unchanged **`vesselTripPredictions`** rows via overlay equality (`decideVesselTripPredictionUpsert`), per PRD §10.

**Explicit tradeoff:** It is acceptable to **temporarily** leave transitional helpers, duplicated logic, or inelegant structure **inside `updateVesselPredictions`** while we clean **`updateVesselTrips`**. Do not let perfect predictions-module design block trip simplification.

---

## 2. Snapshot after Phases A–C (canonical)

### 2.1 `updateVesselTrips` (domain)

- **`runUpdateVesselTrips`** calls **`computeVesselTripsBundle(locations, deps, activeTrips)`** — no **`tickStartedAt`** on **`RunUpdateVesselTripsInput`**.
- **`buildTripCore`** returns **`TripScheduleCoreResult`** (`{ withFinalSchedule }` only). The **`buildTrip`** composer (tests / non-orchestrator) calls **`computeVesselPredictionGates`** then **`applyVesselPredictions`**.
- **`TripComputation.tripCore`** is **`TripScheduleCoreResult`** (no ML gates on Stage C rows).
- **`computeVesselTripsWithClock`** removed; orchestrator clock is not threaded into the trips domain input.

### 2.2 Shared handshake and persist mapping

- **`CompletedTripBoundaryFact`**, current-trip messages (`shared/tickHandshake/types.ts`) use **`TripScheduleCoreResult`** from the trips contracts / barrel.
- **`tripComputationPersistMapping.ts`** is **gate-free**; predicted-message suppression uses **trip-semantic** rules (e.g. missing **`events`** and **`existingTrip`**).

### 2.3 `updateVesselPredictions` (domain)

- **`derivePredictionGatesForComputation(computation, tickStartedAt)`** drives **`applyVesselPredictions`** and orchestrator preload (**`buildPredictionContextRequests`**) — same policy module.
- **Phase C:** **`PREDICTION_ATTEMPT_MODE`** (`refill-when-gates` default) coordinates **`computeVesselPredictionGates`** with **`appendPredictions`** refill; **`empty-slot-only`** preserves legacy behavior for tests/cost-sensitive use.

### 2.4 `convex/functions/vesselOrchestrator/actions.ts`

- **`updateVesselTrips`** may keep a **`tickStartedAt`** parameter for a **stable call signature**; it is **not** passed to **`runUpdateVesselTrips`**. Predictions and timeline still receive orchestrator **`tickStartedAt`**.

---

## 3. Problem statement (historical rationale)

- **Separation of concerns:** Previously, trip lifecycle was **mixed with prediction policy** (gates + clock-driven fallback). Phases A–B move that policy to **`updateVesselPredictions`** and slim the trips public pipeline.
- **Cognitive load:** **`tickStartedAt`** is no longer required to understand **`updateVesselTrips`** beyond schedule snapshot inputs.
- **Phase C (done):** Default refill when phase gates allow; **`batchUpsertProposals`** suppresses unchanged rows (PRD §10).

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

### 5.3 Phase C — Predictions simplification + functions diffing (**shipped 2026-04-19**)

- **`updateVesselPredictions`:** **`PREDICTION_ATTEMPT_MODE`** (`refill-when-gates` vs `empty-slot-only`), refill semantics in **`appendPredictions`**, **`functions`** compare-then-write for **`vesselTripPredictions`**.
- **Ongoing:** incremental cleanup inside **`updateVesselPredictions/`** as needed; optional profiling to tune gate vs CPU cost.

---

## 6. Final intended direction of the code

| Area | Intended end state |
|------|---------------------|
| **`updateVesselTrips`** | Pure **trip lifecycle + schedule enrichment**; **no** ML gate types from **`updateVesselPredictions`** in **`buildTripCore`**; **no** orchestrator **clock** used only for ML fallback. **`TripComputation`** describes **trips**, not ML policy. |
| **`updateVesselPredictions`** | Owns **all** “should we run / which slots” policy that is not strictly **trip geometry**; **`PREDICTION_ATTEMPT_MODE`** + **`predictionPolicy`** gate **`appendPredictions`** refill; **`functions`** dedupes persists. |
| **`actions.ts`** | Continues to **preload**, **call domain**, **persist**, **diff**; preload rules follow **prediction-side** policy helpers, not trips. |
| **`shared` handshake** | **Trip-native** shapes for persist and timeline wiring; **no** requirement that trips emit **`VesselPredictionGates`**. |

**Longer horizon:** Default **`refill-when-gates`** runs ML when phase gates allow each tick; **`batchUpsertProposals`** skips rows that match overlay equality — see PRD §10.

---

## 7. Explicit non-goals (for this memo’s refactor track)

- Perfect, minimal **`updateVesselPredictions`** internals in the same milestone as **`updateVesselTrips`** slimming — **allowed to lag** behind with deliberate tech debt.
- Changing **WSF fetch cadence**, **cron** behavior, or **timeline semantics** unless required by type or handshake fixes (call out in stage handoffs if touched).
- Rewriting **compare-then-write** for predictions in **`functions`** beyond overlay equality already used in **`batchUpsertProposals`**.

---

## 8. Success criteria (for the overall track)

1. **`buildTripCore` / `updateVesselTrips`** do not depend on **`VesselPredictionGates`** or **clock-derived ML fallback**.
2. **Prediction policy** has a **single home** in **`updateVesselPredictions`** (plus **`functions`** preload using the same rules).
3. **Orchestrator behavior** remains correct: **parity** or **intentionally documented** deltas only.
4. **Public import boundaries** respect [`imports-and-module-boundaries-memo.md`](./imports-and-module-boundaries-memo.md): no new long-lived deep imports across concerns.

---

## 9. Revision history

- **2026-04-19 (Phase C landed):** `PREDICTION_ATTEMPT_MODE` / `refill-when-gates`
  default; `computeVesselPredictionGates` phase-simplified when in refill mode;
  `appendPredictions` refill vs empty-slot; tests + docs for functions dedupe and
  orchestrator sequencing.
- **2026-04-19 (Phase B landed):** `TripScheduleCoreResult` / gate-free `TripComputation`;
  `computeVesselTripsBundle` without clock options; `runUpdateVesselTrips` input
  without `tickStartedAt`; handshake + persist mapping updated; orchestrator
  `updateVesselTrips` keeps unused tick param for API stability. §2 rewritten as
  post–Phase B snapshot. Phase C handoff added.
- **2026-04-19 (Phase A landed):** Central policy module
  [`convex/domain/vesselOrchestration/updateVesselPredictions/predictionPolicy.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/predictionPolicy.ts)
  owns `computeShouldRunPredictionFallback`, `computeVesselPredictionGates`, and
  `derivePredictionGatesForComputation`; `buildTripCore`, Stage D, and orchestrator
  preload use one derivation path. Completed boundary handoffs carry `events` for
  gate derivation.
- **2026-04-19:** Initial north-star memo (trip vs prediction policy decoupling; Phases A–C; explicit deferral of predictions-module beautification).
