# Handoff: Phase C — predictions simplification + functions-layer diffing (optional)

**Status:** Implemented (2026-04-19) — `PREDICTION_ATTEMPT_MODE`, refill in `appendPredictions`, tests + north-star §5.3 / §9.

**Prerequisite:** Phase B — [`vessel-trips-phase-b-trip-layer-slim-handoff-2026-04-19.md`](./vessel-trips-phase-b-trip-layer-slim-handoff-2026-04-19.md) (implemented).

**Parent spec:** [`docs/engineering/vessel-trips-prediction-policy-north-star-memo.md`](../engineering/vessel-trips-prediction-policy-north-star-memo.md) (§5.3 Phase C, §6 table, longer horizon in §6)

**Date:** 2026-04-19  
**Audience:** Implementing agent(s)

**Depends on:** Phases A and B complete (`predictionPolicy.ts` canonical; `updateVesselTrips` schedule/lifecycle-only on the orchestrator path).

---

## 1. Mission

Move **`updateVesselPredictions`** toward the **four-pipeline PRD** end state:

1. **Domain** always computes **current** prediction payloads from **current** trip handoffs (no reliance on “only fill empty slots” unless explicitly justified).
2. **`convex/functions`** owns **compare-then-write** / equality-based **write suppression** for prediction rows (and any related tables), consistent with [`vessel-orchestrator-idempotent-four-pipelines-prd.md`](../engineering/complete/vessel-orchestrator-idempotent-four-pipelines-prd.md) §10.

**Non-goals for this handoff:** Changing WSF fetch cadence, cron scheduling, or **timeline** semantics except where types or handoffs force a small alignment. Large schema migrations without a companion migration memo.

---

## 2. Why this is separate from Phases A–B

Phases A–B **separated trip lifecycle from ML policy** and removed gates/clock from the **trips** public pipeline. Phase C is **product and cost shaping**: how aggressively we **recompute**, how we **thin** `applyVesselPredictions` / gate machinery if “every tick” becomes the default, and where **dedupe** lives (already partly in `vesselTripPredictions` writer — extend or consolidate).

---

## 3. Suggested workstreams (pick order based on profiling and risk)

### 3.1 Policy: “recompute every tick” vs retained gates

- **`derivePredictionGatesForComputation`** and **`computeShouldRunPredictionFallback`** exist to **limit** which model slots run. For Phase C, decide whether to:
  - **Keep** gate gating for cost control, or  
  - **Always attempt** applicable models each tick and rely on **functions** diffing to avoid noise.

Document the decision in **`predictionPolicy.ts`** and orchestrator preload (`buildPredictionContextRequests`).

### 3.2 Thin **`applyVesselPredictions`**

- If every tick recomputes full payloads, **conditional appenders** keyed only on gates may simplify to a **straight pipeline** (still pure in domain).
- Preserve **strip-for-storage** and **timeline** contracts; add regression tests when changing **`applyVesselPredictions`** surface.

### 3.3 **`functions`** persistence

- Audit **`batchUpsertProposals`** / **`decideVesselTripPredictionUpsert`** (and related) so **no duplicate writes** when normalized predictions are unchanged.
- Align with PRD: **domain emits truth**; **functions** skips persist when equal.

### 3.4 Cleanup

- Remove dead branches, duplicate types, or transitional comments left from Phases A–B inside **`updateVesselPredictions/`**.
- Update **`architecture.md`** and **`updateVesselPredictions/README.md`** when behavior changes.

---

## 4. Testing and verification

- Extend **`updateVesselPredictions/tests/`** and orchestrator tests for “recompute every tick + no write when equal.”
- **`bun run type-check`**, **`bunx biome check`**, targeted **`bun test`** for `convex/domain/vesselOrchestration/updateVesselPredictions`, `convex/functions/vesselOrchestrator`, `convex/functions/vesselTripPredictions` (paths may vary).

---

## 5. Definition of done

- [x] Documented policy for tick-level ML execution (`PREDICTION_ATTEMPT_MODE`, README + `predictionPolicy.ts`).
- [x] Functions layer **suppresses** redundant prediction persists (`batchUpsertProposals` + overlay equality; tests).
- [x] No new **`ActionCtx`** or dependency bags on public **`runUpdateVesselPredictions`** contract.
- [x] North-star §6 “longer horizon” updated (refill + functions dedupe).

---

## 6. Revision history

- **2026-04-19 (implemented):** Close-out: status, DoD checked against shipped code.
- **2026-04-19:** Initial Phase C handoff (optional predictions + functions diffing).
