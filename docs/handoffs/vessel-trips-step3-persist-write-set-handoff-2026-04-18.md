# Handoff: Step 3 — Persist `VesselTripTickWriteSet` (replace trip mutation path)

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 3 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Step 1 — [`vessel-trips-step1-tick-anchor-handoff-2026-04-18.md`](./vessel-trips-step1-tick-anchor-handoff-2026-04-18.md); Step 2 — [`vessel-trips-step2-pure-write-set-handoff-2026-04-18.md`](./vessel-trips-step2-pure-write-set-handoff-2026-04-18.md)

## Purpose

Route orchestrator trip persistence through **`VesselTripTickWriteSet`**: implement **`persistVesselTripWriteSet`** (or equivalent) that performs the **same idempotent mutations** as today’s `persistVesselTripsCompute`, but takes **`buildVesselTripTickWriteSetFromBundle`** output (or the write set built inside a thin adapter) instead of branching on **`buildVesselTripsExecutionPayloads`** as the primary shape.

This step **still returns `TripLifecycleApplyOutcome`** for predictions and timeline until Step 6; the focus is **trip-table writes + leave-dock sequencing**, not removing timeline types yet.

## Goal

- Add **`persistVesselTripWriteSet(tripsCompute | writeSet, mutations)`** (exact signature TBD) that:
  - Derives or accepts a **`VesselTripTickWriteSet`** and runs **`completeAndStartNewTrip`**, **`upsertVesselTripsBatch`**, and **`setDepartNextActualsForMostRecentCompletedTrip`** with **identical ordering and gating** as `persistVesselTripsCompute` today (`successfulVessels` filter for leave-dock, `Promise.allSettled` for handoffs, `completedFactsForSuccessfulHandoffs` for outcome).
- Wire **`updateVesselTrips`** in `actions.ts` to use the new persist entry **once parity is proven** (or feature-flag the switch with both paths tested).
- **Retire or narrow** **`buildVesselTripsExecutionPayloads`** as the orchestrator’s source of truth for trip mutations—either delete duplicated logic or keep it only as an implementation detail inside the write-set builder until callers are gone.

## Non-goals (this step)

- **No** bulk schedule snapshot or `ScheduledSegmentLookup` refactor (Step 4).
- **No** removal of **`TripLifecycleApplyOutcome`** from the orchestrator trip step’s **return value** yet if timeline/predictions still consume it (Step 6).
- **No** folder rename to `runUpdateVesselTrips` / barrel collapse (Step 5) unless a trivial rename clarifies the new persist entry.
- **No** change to **`updateVesselPredictions`** / **`updateVesselTimeline`** contracts beyond what falls out of keeping **`persistVesselTripsCompute`** behavior equivalent.

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Write set | `convex/domain/vesselOrchestration/orchestratorTick/vesselTripTickWriteSet.ts` — `VesselTripTickWriteSet`, `buildVesselTripTickWriteSetFromBundle`. |
| Leave-dock helper | `convex/domain/vesselOrchestration/orchestratorTick/leaveDockActualization.ts` — `actualDepartMsForLeaveDockEffect`. |
| Current persist | `convex/domain/vesselOrchestration/orchestratorTick/persistVesselTripsCompute.ts` — `buildVesselTripsExecutionPayloads` → mutations → `TripLifecycleApplyOutcome`. |
| Execution payloads | `convex/domain/vesselOrchestration/orchestratorTick/vesselTripsExecutionPayloads.ts` — strip + grouping; **candidate to inline or delete** once write set is sole driver. |
| Orchestrator | `convex/functions/vesselOrchestrator/actions.ts` — `updateVesselTrips` calls `computeVesselTripsWithClock` + `persistVesselTripsCompute`. |
| Tick tests | `convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts` — sequencing; extend or duplicate assertions for write-set persist path. |

## Suggested implementation outline

1. **Implement `persistVesselTripWriteSet`** — Prefer taking **`VesselTripTickWriteSet`** plus **`VesselTripTableMutations`** (reuse existing type). Reuse the **body** of `persistVesselTripsCompute` by mapping write-set fields to the same mutation calls; **extract shared helpers** if both paths exist during migration (e.g. handoff settle loop, upsert result → `successfulVessels`, leave-dock runner).
2. **Single builder internally** — Either `persistVesselTripWriteSet` calls `buildVesselTripTickWriteSetFromBundle(tripsCompute)` once, or `updateVesselTrips` builds the write set and passes it in—avoid double `buildVesselTripsExecutionPayloads` if possible.
3. **Parity verification** — Run existing orchestrator tick tests; add tests that **`persistVesselTripWriteSet`** and legacy **`persistVesselTripsCompute`** produce the **same mutation ordering and arguments** for fixed fixtures (or replace legacy with golden assertions on the new path only once flipped).
4. **Delete or shim `persistVesselTripsCompute`** — When green, reduce to a thin wrapper or remove; update **`orchestratorTick/index.ts`** exports.

## Acceptance criteria

- Orchestrator trip behavior matches **pre-Step 3** semantics (handoffs, active batch, leave-dock gating, `TripLifecycleApplyOutcome` contents used downstream).
- **`buildVesselTripsExecutionPayloads`** is no longer required for the **production** trip persist path, or is clearly a private helper used only by `buildVesselTripTickWriteSetFromBundle`.
- CI: `bun run type-check`, `bun run test`; targeted **`processVesselTrips.tick`** coverage passes.

## Verification

```bash
bun run type-check
bun run test
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — Step 3 acceptance and layering (functions own I/O, domain owns pure rows)
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md) — export surfaces when adding `persistVesselTripWriteSet`
