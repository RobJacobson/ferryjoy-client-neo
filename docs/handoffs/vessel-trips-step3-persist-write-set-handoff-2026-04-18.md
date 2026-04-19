# Handoff: Step 3 — Persist `VesselTripTickWriteSet` (replace trip mutation path)

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 3 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Step 1 — [`vessel-trips-step1-tick-anchor-handoff-2026-04-18.md`](./vessel-trips-step1-tick-anchor-handoff-2026-04-18.md); Step 2 — [`vessel-trips-step2-pure-write-set-handoff-2026-04-18.md`](./vessel-trips-step2-pure-write-set-handoff-2026-04-18.md)

## Purpose

Route orchestrator trip persistence through **`VesselTripTickWriteSet`**: implement **`persistVesselTripWriteSet`** (or equivalent) that performs the **same idempotent mutations** as today’s `persistVesselTripsCompute`, but takes **`buildVesselTripTickWriteSetFromBundle`** output (or the write set built inside a thin adapter) instead of branching on **`buildVesselTripsExecutionPayloads`** as the primary shape.

This step **still returns `TripLifecycleApplyOutcome`** for predictions and timeline until Step 6; the focus is **trip-table writes + leave-dock sequencing**, not removing timeline types yet.

**Status (2026-04-18):** Implemented — `persistVesselTripWriteSet` in `persistVesselTripsCompute.ts`, `persistVesselTripsCompute` same-reference alias, leave-dock via write-set intents, invariant on handoff lengths, tests and docs updated.

## Goal

- **`persistVesselTripWriteSet(tripsCompute, mutations)`** — builds **`VesselTripTickWriteSet`** once via **`buildVesselTripTickWriteSetFromBundle`**, runs mutations with the same ordering and gating as before (`successfulVessels` for leave-dock, `Promise.allSettled` for handoffs, **`completedFactsForSuccessfulHandoffs`** for outcome).
- **`updateVesselTrips`** in `actions.ts` calls **`persistVesselTripWriteSet`**.
- **`buildVesselTripsExecutionPayloads`** is no longer imported by the persist module; it remains an implementation detail of **`buildVesselTripTickWriteSetFromBundle`** until a later inline/refactor.

## Non-goals (this step)

- **No** bulk schedule snapshot or `ScheduledSegmentLookup` refactor (Step 4).
- **No** removal of **`TripLifecycleApplyOutcome`** from the orchestrator trip step’s **return value** yet if timeline/predictions still consume it (Step 6).
- **No** folder rename to `runUpdateVesselTrips` / barrel collapse (Step 5) unless a trivial rename clarifies the new persist entry.
- **No** change to **`updateVesselPredictions`** / **`updateVesselTimeline`** contracts beyond what falls out of keeping **`persistVesselTripsCompute`** behavior equivalent.

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Write set | `convex/domain/vesselOrchestration/orchestratorTick/vesselTripTickWriteSet.ts` — `VesselTripTickWriteSet`, `buildVesselTripTickWriteSetFromBundle`. |
| Leave-dock helper | `convex/domain/vesselOrchestration/orchestratorTick/leaveDockActualization.ts` — `actualDepartMsForLeaveDockEffect` (used when building intents from effects). |
| Persist | `convex/domain/vesselOrchestration/orchestratorTick/persistVesselTripsCompute.ts` — **`persistVesselTripWriteSet`** (canonical); **`persistVesselTripsCompute`** = same reference (legacy name). |
| Execution payloads | `convex/domain/vesselOrchestration/orchestratorTick/vesselTripsExecutionPayloads.ts` — strip + grouping; used only inside **`buildVesselTripTickWriteSetFromBundle`**, not by persist directly. |
| Orchestrator | `convex/functions/vesselOrchestrator/actions.ts` — `updateVesselTrips` calls `computeVesselTripsWithClock` + **`persistVesselTripWriteSet`**. |
| Tick tests | `convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts` — uses **`persistVesselTripWriteSet`**. |

## Implementation notes (shipped)

- **`persistVesselTripWriteSet`** calls **`buildVesselTripTickWriteSetFromBundle` once**; throws if `attemptedHandoffs.length !== completedHandoffs.length`; active upserts use **`Array.from(writeSet.activeTripRows)`** for mutable mutation args; leave-dock uses **`runLeaveDockFromWriteSetIntents`** (filters **`leaveDockIntents`** by **`successfulVessels`**).
- **`persistVesselTripsCompute`** is a **same-reference** alias for backward imports; both exported from **`orchestratorTick/index.ts`**.
- Tests: **`persistVesselTripsCompute.test.ts`** (alias + leave-dock), tick and **`processCompletedTrips`** suites updated; **`convex:typecheck`** included in verification.

## Acceptance criteria

- Orchestrator trip behavior matches **pre-Step 3** semantics (handoffs, active batch, leave-dock gating, `TripLifecycleApplyOutcome` contents used downstream).
- **`buildVesselTripsExecutionPayloads`** is no longer required for the **production** trip persist path, or is clearly a private helper used only by `buildVesselTripTickWriteSetFromBundle`.
- CI: `bun run type-check`, `bun run test`; targeted **`processVesselTrips.tick`** coverage passes.

## Verification

```bash
bun run check:fix
bun run type-check
bun run test
bun run convex:typecheck
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — Step 3 acceptance and layering (functions own I/O, domain owns pure rows)
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) — export surfaces when adding `persistVesselTripWriteSet`
