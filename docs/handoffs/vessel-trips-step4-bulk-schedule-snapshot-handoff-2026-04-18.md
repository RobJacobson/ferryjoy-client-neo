# Handoff: Step 4 — Bulk schedule snapshot (Plan A)

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 4 of the vessel-trips refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Steps 1–3 complete — handoffs [`vessel-trips-step1-tick-anchor-handoff-2026-04-18.md`](./vessel-trips-step1-tick-anchor-handoff-2026-04-18.md), [`vessel-trips-step2-pure-write-set-handoff-2026-04-18.md`](./vessel-trips-step2-pure-write-set-handoff-2026-04-18.md), [`vessel-trips-step3-persist-write-set-handoff-2026-04-18.md`](./vessel-trips-step3-persist-write-set-handoff-2026-04-18.md)

## Purpose

Replace **per-call `runQuery` schedule lookups** in the trip tick hot path with **one (or few) bounded internal queries** that load a **schedule snapshot** for the tick, then **pure in-memory resolution** (slicing / indexing) inside domain—so `computeVesselTripsBundle` / `createDefaultProcessVesselTripsDeps` no longer depend on **`ScheduledSegmentLookup`** as a bag of async Convex callbacks for every segment.

This matches memo **Plan A**; document **Plan B** (narrow `ScheduleReadPort`) if production size or freshness forces a rollback-style adapter.

## Goal

- Add **`internal` query(s)** (or reuse existing queries with a clear contract) that return a **size-bounded** snapshot for the relevant **sailing day / window** and vessel/route scope used by trip processing.
- In **`updateVesselOrchestrator`** / **`actions.ts`**, **`ctx.runQuery` the snapshot once per tick** (after `tickStartedAt`, alongside or after locations as the team agrees), and pass **plain data** into the trip compute path (e.g. new field on deps, or a dedicated argument threaded into **`createDefaultProcessVesselTripsDeps`** / adapters).
- Replace **`createScheduledSegmentLookup`** usage for the **default orchestrator trip deps** with a **snapshot-backed implementation** of the same **logical** operations (segment key → departure event, sailing-day dock events, etc.) via **in-memory structures** built from the snapshot.
- **Observability:** log or metric **snapshot payload size** and query duration in dev/staging (per memo mitigation).

## Non-goals (this step)

- **No** `runUpdateVesselTrips` rename or **`updateVesselTrips/`** barrel collapse (Step 5).
- **No** removal of **`TripLifecycleApplyOutcome`** / timeline coupling (Step 6).
- **No** full redesign of **`updateVesselPredictions`** beyond what naturally shares the same schedule data.
- **No** requirement to delete **`createScheduledSegmentLookup`** on day one if tests still need it—prefer **feature parity first**, then delete dead code once snapshot path is default and green.

## Current landmarks (read first)

| Area | Location |
|------|----------|
| Orchestrator wiring | `convex/functions/vesselOrchestrator/actions.ts` — `tripDepsForOrchestrator` uses **`createDefaultProcessVesselTripsDeps(createScheduledSegmentLookup(ctx))`**. |
| Lookup factory | `convex/functions/vesselOrchestrator/utils.ts` — **`createScheduledSegmentLookup`** wraps `internal.functions.events.eventsScheduled.queries` (`getScheduledDepartureEventBySegmentKey`, `getScheduledDockEventsForSailingDay`). |
| Domain interface | `convex/domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment.ts` — **`ScheduledSegmentLookup`** type. |
| Deps | `convex/domain/vesselOrchestration/updateVesselTrips/processTick/defaultProcessVesselTripsDeps.ts` — **`createDefaultProcessVesselTripsDeps(lookup)`**. |
| Predictions path | Same bundle recompute uses the same deps pattern; ensure **one snapshot** can serve **both** trip and predictions passes if they share schedule reads, or document intentional duplication. |

## Suggested implementation outline

1. **Define snapshot shape** — Serializable POJO(s) that cover what **`ScheduledSegmentLookup`** methods return today, indexed for O(1) or cheap lookup by segment key and `(vesselAbbrev, sailingDay)`.
2. **Internal query** — Implement **`getScheduleSnapshotForTick`** (name TBD): args = bounded window + identities from orchestrator snapshot; validate read limits in code review.
3. **Snapshot lookup adapter** — Implement **`createScheduledSegmentLookupFromSnapshot(snapshot)`** (pure) returning **`ScheduledSegmentLookup`** with **sync** methods that read arrays/maps (no `runQuery` inside domain). Wire **`actions.ts`** to fetch snapshot once and pass into this factory when building **`ProcessVesselTripsDeps`**.
4. **Tests** — Domain unit tests for pure slicing; orchestrator/tick tests with **stub snapshot**; optional parity: same fixture through old callback lookup vs snapshot lookup (golden or diff).
5. **Plan B** — Short markdown note in-repo (or comment on query) describing the **minimal adapter interface** if bulk fetch is reverted.

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
