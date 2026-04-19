# Handoff: Step 4 — Bulk schedule snapshot (Plan A)

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 4 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Steps 1–3 complete — handoffs [`vessel-trips-step1-tick-anchor-handoff-2026-04-18.md`](./vessel-trips-step1-tick-anchor-handoff-2026-04-18.md), [`vessel-trips-step2-pure-write-set-handoff-2026-04-18.md`](./vessel-trips-step2-pure-write-set-handoff-2026-04-18.md), [`vessel-trips-step3-persist-write-set-handoff-2026-04-18.md`](./vessel-trips-step3-persist-write-set-handoff-2026-04-18.md)

## Purpose

Replace **per-segment `runQuery` schedule calls from the action** with **one bounded internal query** (`getScheduleSnapshotForTick`) that loads a **schedule snapshot**, then a **sync** **`ScheduledSegmentLookup`** from **`createScheduledSegmentLookupFromSnapshot`** (in-memory maps; no Convex I/O in domain).

This matches memo **Plan A**; document **Plan B** (narrow `ScheduleReadPort`) if production size or freshness forces a rollback-style adapter.

**Status (2026-04-18):** Implemented — `updateVesselTrips/snapshot/` (`ScheduleSnapshot`, `buildScheduleSnapshotQueryArgs`, `createScheduledSegmentLookupFromSnapshot`, caps), **`getScheduleSnapshotForTick`** in `vesselOrchestrator/queries.ts`, **sync** `ScheduledSegmentLookup`, shared **`tripProcessDeps`** for **`updateVesselTrips`** and **`updateVesselPredictions`**, snapshot size/duration logging (omit byte length when payload &gt; 400k).

## Goal

- **`getScheduleSnapshotForTick`** internal query returns bounded **`departuresBySegmentKey`** + **`sameDayEventsByCompositeKey`** (see query JSDoc for Plan B and internal read cost).
- **`updateVesselOrchestrator`** runs **`buildScheduleSnapshotQueryArgs`**, **`runQuery` once** after **`updateVesselLocations`**, builds **`tripProcessDeps`** once, passes **`tripDeps`** into trips and predictions.
- **`ScheduledSegmentLookup`** is **sync** (no Promises); domain continuity uses **`createScheduledSegmentLookupFromSnapshot`** only.

## Non-goals (this step)

- **No** `runUpdateVesselTrips` rename or **`updateVesselTrips/`** barrel collapse (Step 5).
- **No** removal of **`TripLifecycleApplyOutcome`** / timeline coupling (Step 6).
- **No** full redesign of **`updateVesselPredictions`** beyond what naturally shares the same schedule data.

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Snapshot domain | `convex/domain/vesselOrchestration/updateVesselTrips/snapshot/` — query args builder, limits, **`createScheduledSegmentLookupFromSnapshot`**. |
| Internal query | `convex/functions/vesselOrchestrator/queries.ts` — **`getScheduleSnapshotForTick`**. |
| Orchestrator | `convex/functions/vesselOrchestrator/actions.ts` — snapshot after locations; **`tripProcessDeps`** into **`updateVesselTrips`** / **`updateVesselPredictions`**. |
| Bindings | `convex/functions/vesselOrchestrator/utils.ts` — **`createVesselOrchestratorConvexBindings`** (mutations + prediction access only; schedule lookup removed). |
| Domain interface | `convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment.ts` — **sync** **`ScheduledSegmentLookup`**. |
| Deps | `convex/domain/vesselOrchestration/updateVesselTrips/processTick/defaultProcessVesselTripsDeps.ts` — **`createDefaultProcessVesselTripsDeps(lookup)`**. |
| Barrel | `convex/domain/vesselOrchestration/updateVesselTrips/index.ts` — re-exports snapshot symbols for `functions` façade. |

## Implementation notes (shipped)

1. **Caps** — `scheduleSnapshotLimits.ts`; args validated in **`getScheduleSnapshotForTick`** handler.
2. **Tests** — `snapshot/tests/createScheduledSegmentLookupFromSnapshot.test.ts`, `buildScheduleSnapshotQueryArgs.test.ts`; continuity/trip tests use sync lookup stubs.
3. **Removed** — **`createScheduledSegmentLookup`** from **`utils.ts`** (no longer on the orchestrator hot path).

## Acceptance criteria

- **Fewer** `runQuery` calls attributable to **per-segment** schedule resolution on the hot path (measure before/after in tests or logging).
- Trip tick **behavior** matches prior semantics for the same underlying schedule data (or differences are explicitly justified and tested).
- Snapshot query is **bounded** (documented limits); staging logs/metrics for size/duration as agreed.

## Verification

```bash
bun run check:fix
bun run type-check
bun run test
bun run convex:typecheck
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — “Bulk snapshots and cost control”
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- [`convex/domain/vesselOrchestration/architecture.md`](../convex/domain/vesselOrchestration/architecture.md) — orchestrator / lookup wiring
