# Handoff: Vessel trips refactor — Phase 4 (extract **updateVesselPredictions**)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisites:** Phases 0–3 complete (including `buildTimelineTickProjectionInput` and `updateTimeline` barrel pattern). Canonical narrative: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — *Target reorganization*, *Phased cleanup / reorg*, **§10 Suggested refactor sequence** (Phase 4 item 7), [`updateVesselPredictions/README.md`](../../convex/domain/vesselOrchestration/updateVesselPredictions/README.md).

**Goal:** Make **updateVesselPredictions** a **named domain step** with explicit **handoff types** between “trip-shaped state without ML attachment” and “trip with ML fields ready for overlay / persistence comparisons,” **without changing observable behavior** (same prediction attempts, same fields written, same mutations and timeline outcomes for the same inputs).

---

## What Phase 4 is (and is not)

**In scope**

- **Separate ML attachment from the rest of `buildTrip`** while preserving the **exact order of operations** that exists today: effective location → base trip → schedule / derived-state rules → **final schedule append** → **at-dock predictions** → **at-sea predictions** → **leave-dock actualization** (`actualizePredictionsOnLeaveDock`).
- Introduce **clear types** (names illustrative; choose what fits the codebase):
  - A **“core trip proposal”** type after schedule enrichment and gating, **before** `appendArriveDockPredictions` / `appendLeaveDockPredictions`.
  - A **“trip with ML”** type after prediction phases (today `ConvexVesselTripWithML` from [`buildTrip.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts)).
- **Primary implementation home:** new or moved modules under [`convex/domain/vesselOrchestration/updateVesselPredictions/`](../../convex/domain/vesselOrchestration/updateVesselPredictions/) **and/or** `domain/vesselTrips/…` with **re-exports** from the orchestration folder (mirror the Phase 3 pattern: **one narrative owner** in README).
- **Tests:** extend [`buildTrip.test.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tests/buildTrip.test.ts) and/or add focused unit tests for the extracted prediction phase so behavior is pinned **without** relying only on full `processVesselTrips` integration tests.

**Out of scope (Phase 5+ or later)**

- New Convex **actions** solely for predictions (metrics / retries) — **Phase 5** in architecture unless product needs them sooner.
- Large cleanups: **`tripsEqualForStorage` / `tripsEqualForOverlay` unification**, mirror-field audits — **defer** unless Phase 4 cannot ship without them.
- Changing **ML model contracts** (`domain/ml/...`) beyond what is required to move call sites.

---

## Current pipeline (anchors)

**`buildTrip`** — [`convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip.ts)

Rough sequence (read the file for full guards):

1. `resolveEffectiveLocation` (adapters)
2. `baseTripFromLocation` + arrival / identity / schedule-detachment handling
3. Optional `appendFinalSchedule` (when `shouldAppendFinalSchedule`)
4. **`shouldAttemptAtDockPredictions`** → `appendArriveDockPredictions` ([`appendPredictions.ts`](../../convex/domain/vesselOrchestration/updateVesselPredictions/appendPredictions.ts))
5. **`shouldAttemptAtSeaPredictions`** → `appendLeaveDockPredictions`
6. If `events.didJustLeaveDock` → **`actualizePredictionsOnLeaveDock`** (`domain/ml/prediction`)

**Consumers** — `buildTrip` is invoked from:

- [`processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts) (parallel per vessel; storage vs overlay diff, batch upsert)
- [`processCompletedTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts) (boundary paths; `tripStart: true` for new trip)

**Persistence vs overlay**

- Mutations use **`stripTripPredictionsForStorage`** where applicable ([`processCurrentTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts), [`processCompletedTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCompletedTrips.ts)).
- **Overlay** comparisons still need the **enriched** trip (including ML) to decide timeline messages — extraction must **not** strip predictions before overlay diff runs.

---

## Target shape (behavior-neutral)

1. **`buildTrip`** (or a clearly named successor) should end in one of two equivalent patterns — pick the **smallest diff** that makes the boundary obvious in code review:
   - **A)** `buildTrip` builds **core** trip only; **`applyVesselPredictions`** (name TBD) takes `(ctx, coreTrip, …)` and returns `ConvexVesselTripWithML`, called **immediately** by the same caller that used to get one `buildTrip` result; or  
   - **B)** `buildTrip` remains the public entry but **delegates** to an internal `buildTripCore` + `applyVesselPredictions` so call sites stay one function (less churn, weaker boundary visibility).

2. **Orchestration mental model** (from architecture):  
   **updateVesselTrips** (lifecycle) → **updateVesselPredictions** (ML) → **updateTimeline** (already extracted for assembly).  
   At runtime this remains **one tick branch**; Phase 4 is **module clarity**, not new network hops.

3. **Folder / barrel:** Implement prediction phase helpers beside [`updateVesselPredictions/README.md`](../../convex/domain/vesselOrchestration/updateVesselPredictions/README.md); re-export types/functions from `updateVesselPredictions/index.ts` when stable. **Avoid** duplicating `computePredictions` / spec lists — keep a **single** implementation of ML attachment logic (`appendPredictions.ts` may stay canonical with thin wrappers).

---

## Constraints to preserve (risks)

| Constraint | Why |
| --- | --- |
| **Schedule before ML** | `appendFinalSchedule` must complete before at-dock / at-sea prediction attempts; gating flags (`shouldAttemptAtDockPredictions`, `shouldAttemptAtSeaPredictions`) depend on post-schedule trip shape. |
| **Event + fallback alignment** | `shouldRunPredictionFallback` participates in the same guards as today; do not change when fallback runs relative to lifecycle. |
| **Leave-dock actualization** | `actualizePredictionsOnLeaveDock` must stay tied to `didJustLeaveDock` exactly as today. |
| **Storage strip** | `stripTripPredictionsForStorage` must run at the **same** points relative to **persisted** proposals; overlay path must still see ML fields. |
| **Parallelism** | `processCurrentTrips` runs `buildTrip` in parallel per vessel; extraction must not introduce **shared mutable** state or ordering assumptions between vessels. |

---

## Suggested implementation strategy

1. **Inventory** all `buildTrip` call sites and list **inputs/outputs** per path (current vs completed transition). Confirm no hidden reliance on “ML fields always present” before a specific line.

2. **Extract a pure “gating + invoke” function** for predictions that takes the **same** intermediate trip + **same** boolean guards as today (`shouldAttemptAtDockPredictions`, `shouldAttemptAtSeaPredictions`, `events.didJustLeaveDock`) so behavior is **diff-minimal**.

3. **Types:** Prefer **explicit** aliases or interfaces for the handoff:
   - e.g. `VesselTripCoreProposal` / `VesselTripWithMLPredictions` — exact shapes can wrap existing `ConvexVesselTripWithPredictions` / `ConvexVesselTripWithML` from [`functions/vesselTrips/schemas`](../../convex/functions/vesselTrips/schemas) if that avoids churn.

4. **Module cycles:** If `vesselOrchestration/updateVesselPredictions` imports heavy `vesselTrips` graphs, use the same technique as Phase 3: **canonical implementation** under `domain/vesselTrips/...`, **barrel** under `vesselOrchestration/updateVesselPredictions` for the named concern. Document the rule in `updateVesselPredictions/README.md`.

5. **Docs:** Update [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) *Phased cleanup* Phase 4 bullet and [`vesselTrips/README.md`](../../convex/domain/vesselOrchestration/updateVesselTrips/README.md) if the public story changes.

---

## Verification

```bash
bun run check:fix
bun run type-check
bun run convex:typecheck
bun test convex/domain/vesselOrchestration/tests/
bun test convex/domain/vesselOrchestration/updateVesselTrips/tests/
```

Run `bun run convex:codegen` after substantive Convex changes; [`convex/_generated/api.d.ts`](../../convex/_generated/api.d.ts) must stay **tool-generated only** (never hand-edit).

---

## Acceptance criteria

- [ ] **Clear boundary** in code (and TSDoc) between **trip core proposal** (schedule + derived-state rules, **no ML**) and **ML attachment** (append + leave-dock actualize), with **no intentional behavior change**.
- [ ] **`updateVesselPredictions/README.md`** updated: canonical file paths, build-vs-persist vs overlay notes, and **import / cycle** rules if applicable.
- [ ] **Tests** cover the extracted prediction phase or equivalent golden assertions (existing suites green).
- [ ] **Ordering and gating** unchanged: schedule enrichment → at-dock ML → at-sea ML → leave-dock actualization; strip-for-storage only where it belongs today.
- [ ] Green CI checks as above.

---

## After Phase 4

**Phase 5** — Optional tracks **5A** (Convex / orchestrator surface) and/or **5B** (narrow domain cleanups): [`vessel-trips-phase-5-handoff-2026-04-17.md`](./vessel-trips-phase-5-handoff-2026-04-17.md). Narrative in [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) *Phased cleanup / reorg* and §10.

**Reference:** [`architecture.md` §10](../../convex/domain/vesselOrchestration/architecture.md) Phases 4–5; Phase 3 handoff for barrel / no-cycle pattern ([`vessel-trips-phase-3-handoff-2026-04-17.md`](./vessel-trips-phase-3-handoff-2026-04-17.md)).
