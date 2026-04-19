# Handoff: Step 1 — Tick anchor ownership (vessel trips pure pipeline)

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 1 of the vessel-trips refactor (see roadmap link below)  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)

## Purpose

Establish a **single source of truth** for the orchestrator tick clock (`tickStartedAt`): create it **once** in the functions layer (`updateVesselOrchestrator` in `actions.ts`, or a helper used only from there), pass it **into** domain and downstream steps, and stop treating **returned** values from inner compute wrappers as the canonical anchor.

**Status (2026-04-18):** Implemented — see `actions.ts`, `computeVesselTripsWithClock.ts`, tests, and orchestrator README.

This step is **ownership and wiring only**. It does **not** introduce `VesselTripTickWriteSet`, bulk schedule snapshots, or persistence refactors (later steps).

## Goal

- **`tickStartedAt` is created in one place** tied to the orchestrator tick (after snapshot validation), not defaulted inside `computeVesselTripsWithClock` for production paths.
- **Thread `tickStartedAt` explicitly** into:
  - `computeVesselTripsWithClock` (required or clearly passed every time from orchestrator code paths)
  - `updateVesselTrips` → predictions → timeline (already take `tickStartedAt` in some signatures; align so nothing downstream relies on “whatever the trip step returned”).
- **Domain contract:** `computeVesselTripsWithClock` should **not** be the production owner of `Date.now()` when called from the orchestrator; tests may still inject fixed times via the same path the action uses.

## Non-goals (this step)

- No change to trip bundle shape, `persistVesselTripsCompute`, or `TripLifecycleApplyOutcome` plumbing.
- No bulk schedule snapshot or `ScheduledSegmentLookup` refactor.
- No barrel / folder moves under `updateVesselTrips/` (Step 5).

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Orchestrator tick | `convex/functions/vesselOrchestrator/actions.ts` — after the snapshot guard, `tickStartedAt = Date.now()`; same variable into `updateVesselTrips`, `updateVesselPredictions`, `updateVesselTimeline`. |
| Trip step | `actions.ts` — `updateVesselTrips(ctx, …, tickStartedAt)` calls `computeVesselTripsWithClock(..., { tickStartedAt })`; return is `{ tripApplyResult }` only. |
| Clock + bundle | `convex/domain/vesselOrchestration/computeVesselTripsWithClock.ts` — **required** third arg `{ tickStartedAt }`; no `Date.now()` default; result `tickStartedAt` is an echo of the input. |
| Predictions reuse | `actions.ts` — `updateVesselPredictions` already passes `{ tickStartedAt }` into `computeVesselTripsWithClock` for isolation. |
| Tests | `convex/domain/vesselOrchestration/tests/computeVesselTripsWithClock.test.ts`, `convex/functions/vesselOrchestrator/tests/processVesselTrips.tick.test.ts` — exercise `tickStartedAt` options; extend so the **orchestrator-facing path** uses a single injected anchor where applicable. |

## Suggested implementation outline (worker plan)

1. **Create the anchor** in `updateVesselOrchestrator` immediately after the snapshot guard (same place you already know the tick is valid), e.g. `const tickStartedAt = Date.now()` or a one-line `createOrchestratorTickAnchor()` in the same module if it keeps `actions.ts` readable.
2. **Pass `tickStartedAt` into `updateVesselTrips`** (new parameter). Inside `updateVesselTrips`, call `computeVesselTripsWithClock(..., { tickStartedAt })` — **never** `undefined` for production orchestrator calls.
3. **Narrow `updateVesselTrips` return type** to `{ tripApplyResult }` (or keep `tickStartedAt` only if you need a transitional re-export; prefer removing it so `updateVesselOrchestrator` uses the variable from step 1 for predictions and timeline).
4. **Adjust `computeVesselTripsWithClock`** so callers from orchestrator code **must** supply `tickStartedAt` (make it required in options, or add a separate overload for tests). Reserve `Date.now()` only for explicit test helpers or non-orchestrator entry points if any remain—document the rule in the file header.
5. **Update tests** so fixed timestamps flow through the same **action-level** concept: e.g. helper that mimics `updateVesselOrchestrator` order with an injected clock, or parameterized tests on `updateVesselTrips` with required `tickStartedAt`.

## Acceptance criteria

- **Single source of truth:** `tickStartedAt` for a full orchestrator run originates in `actions.ts` (or helper called only from `updateVesselOrchestrator`), not from the return value of `computeVesselTripsWithClock` / `updateVesselTrips` as the primary clock.
- **Predictions and timeline** use the **same** `tickStartedAt` instance as the trip step for that tick (no second `Date.now()` hidden in a parallel path).
- **Tests** prove deterministic behavior: passing a fixed `tickStartedAt` through the orchestrator-shaped call chain yields stable policy (e.g. `computeShouldRunPredictionFallback`) and does not depend on inner functions inventing their own time.

## Verification

Run project checks after changes (adjust if your local script names differ):

```bash
bun run type-check
bun run test
```

Include any targeted test files you touched (e.g. `computeVesselTripsWithClock`, orchestrator tick tests).

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — full roadmap and design principles
- [`vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md`](../engineering/vessel-orchestrator-four-pipelines-and-prediction-separation-memo.md) — pipeline context
- [`convex/functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) — orchestrator overview
