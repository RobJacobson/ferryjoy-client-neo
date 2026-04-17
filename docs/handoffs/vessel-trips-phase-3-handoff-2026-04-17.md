# Handoff: Vessel trips refactor — Phase 3 (extract **updateTimeline**)

**Date:** 2026-04-17  
**Audience:** implementation agent  
**Prerequisites:** Phases 0–2 complete. Canonical narrative: [`convex/domain/vesselOrchestration/architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) — *Target reorganization*, *Phased cleanup / reorg*, **§10 Suggested refactor sequence** (Phase 3 item 6).

**Goal:** **Phase 3 — Extract updateTimeline** per architecture: separate **lifecycle persistence and authoritative trip outcomes** from **assembly of `TickEventWrites` / `TimelineTickProjectionInput`**, while preserving **tick ordering guarantees** (especially **mutations before timeline apply**, and **upsert-gated projection** where it exists today).

---

## What Phase 3 is (and is not)

**In scope**

- Make **updateTimeline** a **named domain step** that turns **lifecycle branch outputs** (completed facts, current-branch messages / successful vessels, etc.) into **`TimelineTickProjectionInput`**, then **apply** via the existing functions-layer `applyTickEventWrites` (or equivalent wiring).
- **Refactor for clarity**, possibly new types for “authoritative tick outcomes” vs “projection payload,” **without changing observable behavior** (same mutations in the same order, same timeline rows written for the same inputs).
- Tests: extend or add coverage so **projection** can be exercised from **fixtures** (architecture: “fixture trip outcomes into **updateTimeline**”).

**Out of scope (Phase 4+)**

- Extracting **updateVesselPredictions** from `buildTrip` — **Phase 4**.
- New Convex actions / metrics — **Phase 5**.
- Large unrelated cleanups (`tripsEqualForStorage` / overlay diff unification) — defer unless required by this extraction.

---

## Current pipeline (anchors for the refactor)

**Orchestrator** — [`runVesselOrchestratorTick.ts`](../../convex/domain/vesselOrchestration/runVesselOrchestratorTick.ts):  
`processVesselTrips` → `applyTickEventWrites(tripResult.tickEventWrites)` (sequential inside the trip branch).

**Trip entry** — [`processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts):

1. `processCompletedTrips` → `completedFacts`
2. `processCurrentTrips` → `currentBranch` (mutations + queued projection inputs)
3. **Projection assembly today (to extract conceptually):**

```text
mergeTickEventWrites(
  buildTickEventWritesFromCompletedFacts(completedFacts, tickStartedAt),
  buildTickEventWritesFromCurrentMessages(
    currentBranch.successfulVessels,
    currentBranch.pendingActualMessages,
    currentBranch.pendingPredictedMessages,
    tickStartedAt
  )
)
```

4. Return `VesselTripsTickResult` with `tickEventWrites`.

**Assembler** — [`timelineEventAssembler.ts`](../../convex/domain/vesselTrips/projection/timelineEventAssembler.ts) (and related) builds the sparse writes consumed by [`applyTickEventWrites`](../../convex/functions/vesselOrchestrator/actions.ts).

**Types** — [`tickEnvelope.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEnvelope.ts), [`tickEventWrites.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/tickEventWrites.ts); orchestration concern barrel — [`updateTimeline/index.ts`](../../convex/domain/vesselOrchestration/updateTimeline/index.ts) re-exports handoff types from `tickEventWrites` (single source of truth).

---

## Target shape (behavior-neutral)

1. **`processVesselTripsWithDeps`** (or a clearly named successor) should **finish all lifecycle mutations** required for the tick and expose a **structured result** that is sufficient for projection — e.g. `completedFacts`, `currentBranch` (or a slimmer DTO if you want to hide internal types).

2. **`updateTimeline`** (new **pure** or **domain** function, living under e.g. `domain/vesselOrchestration/updateTimeline/` **and/or** `domain/vesselTrips/…`) takes that result + `tickStartedAt` and returns **`TimelineTickProjectionInput`** (same merge/assembler calls as today, possibly moved).

3. **Orchestrator wiring** remains: **run lifecycle first**, **then** `applyTickEventWrites` — either by keeping `processVesselTrips` returning only lifecycle + calling `buildTimelineWrites` in `runVesselOrchestratorTick`, or by having `processVesselTrips` call the new function internally but with **two clear sub-steps** in code. Prefer **one obvious function name** (e.g. `buildTimelineTickProjection`) exported for tests.

**Non-goals for Phase 3**

- Moving **`applyTickEventWrites`** out of `functions/vesselOrchestrator/actions.ts` unless there is a clear win — it can stay the Convex **mutation** shell; domain owns **DTO assembly**.

---

## Constraints to preserve (risks)

| Constraint | Why |
| --- | --- |
| **Mutations before projection** | `runVesselOrchestratorTick` already sequences `applyTickEventWrites` after `processVesselTrips`; do not interleave timeline mutations inside lifecycle without analysis. |
| **Upsert-gated projection** | [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md) §7 — some timeline writes depend on successful active-trip upsert; [`processCurrentTrips`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/processCurrentTrips.ts) encodes this; extraction must not widen projection when upsert failed. |
| **Completed before current** | [`processVesselTrips.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips.ts) runs `processCompletedTrips` before `processCurrentTrips` — keep. |
| **Single source for row shapes** | Timeline row DTOs stay centralized in projection/assembler paths until a later “facts-only” redesign (architecture *Further thoughts*). |

---

## Suggested implementation strategy

1. **Introduce a pure function**  
   `buildTimelineTickProjectionInput(args): TimelineTickProjectionInput`  
   that contains **only** the logic currently in `processVesselTrips` after both branches return (the `mergeTickEventWrites` + two `buildTickEventWrites*` calls). Unit-test it with the same inputs you already get from tests or minimal fixtures.

2. **Narrow `processVesselTrips` return type** (optional intermediate): e.g. split types so the lifecycle step is explicit — or keep `VesselTripsTickResult` but document that `tickEventWrites` is **only** produced by the updateTimeline step (called inside the same function body at first).

3. **Wire `runVesselOrchestratorTick`** (if desired for maximum clarity):  
   `tripResult = await deps.processVesselTrips(...)` returning **lifecycle outcome**;  
   `writes = deps.buildTimelineProjection(tripResult)` or include `tickEventWrites` on `tripResult` but set it via the extracted builder — **choose the smallest diff** that makes the boundary visible in code reviews.

4. **Home folder:** Prefer implementing the new builder under [`convex/domain/vesselOrchestration/updateTimeline/`](../../convex/domain/vesselOrchestration/updateTimeline/) (real `.ts` beside the current re-export barrel) **or** under `domain/vesselTrips/projection/` with re-export from `updateTimeline` — **pick one** and document in `updateTimeline/README.md` to avoid two “owners.”

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

- [ ] **Clear boundary** in code between “lifecycle + DB mutations for trips” and “build `TimelineTickProjectionInput` for this tick,” with architecture doc / TSDoc updated to match (domain **builds** payload; orchestrator **`applyTickEventWrites`** **applies** it).
- [ ] **`updateTimeline/README.md`** documents the chosen code home and build-vs-apply split (single owner; no duplicate narratives).
- [ ] **No intentional behavior change** for the same inputs (golden-path and existing tests pass; add a focused test for the extracted builder if coverage is thin).
- [ ] **Ordering** preserved: timeline mutations still run **after** lifecycle work in the trip branch; upsert-gated rules unchanged.
- [ ] Green CI checks as above.

---

## After Phase 3

**Phase 4** — Extract **updateVesselPredictions** from `buildTrip` with explicit handoff types — see [`vessel-trips-phase-4-handoff-2026-04-17.md`](./vessel-trips-phase-4-handoff-2026-04-17.md).

**Reference:** [`architecture.md` §10](../../convex/domain/vesselOrchestration/architecture.md) Phases 4–5.
