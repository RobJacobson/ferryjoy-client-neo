# Handoff: Step 7 — Cleanup and documentation

**Date:** 2026-04-18  
**Audience:** engineers or agents executing Step 7 (final cleanup) of the vessel-trips pure-pipeline refactor  
**Roadmap:** [`docs/engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md)  
**Prerequisites:** Steps 1–6 — especially [`vessel-trips-step6-remove-timeline-baggage-handoff-2026-04-18.md`](./vessel-trips-step6-remove-timeline-baggage-handoff-2026-04-18.md) (`tickLifecycle`, no `updateTimeline` imports under `updateVesselTrips/`)

## Status

**Complete (2026-04-18).** Rename-only hygiene shipped: **`vesselTripsExecutionPayloads.ts`** replaced by [`tripsComputeStorageRows.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/tripsComputeStorageRows.ts) (`TripsComputeStorageRows`, `buildTripsComputeStorageRows`, `completedFactsForSuccessfulHandoffs`). Barrels were **not** shrunk; public exports updated in [`orchestratorTick/index.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/index.ts). Docs: [`architecture.md`](../../convex/domain/vesselOrchestration/architecture.md), roadmap memo, [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md), `updateVesselTrips` / `tripLifecycle` / `updateTimeline` READMEs, [`readme-ml.md`](../../convex/domain/ml/readme-ml.md). Verification: `check:fix`, `type-check`, `test`, `convex:typecheck` (and `convex:codegen` as needed).

## Purpose (historical)

Deliver memo **Step 7 — Cleanup and documentation**: align **docs and naming** with the steady-state trip tick story (canonical API, orchestrator layering), and close the loop on the roadmap memo.

## Goal (what Step 7 targeted)

- **Execution-payload naming** — The strip/group helper is now **`buildTripsComputeStorageRows`** in **`tripsComputeStorageRows.ts`** (formerly `buildVesselTripsExecutionPayloads` / `vesselTripsExecutionPayloads.ts`). Behavior preserved; name matches “storage-shaped rows,” not mutation execution.
- **Naming (memo acceptance)** — Documentation describes **shipped** symbols: **`computeVesselTripsWithClock`**, **`computeVesselTripsBundle`**, **`persistVesselTripWriteSet`**, **`updateVesselTrips`** in [`actions.ts`](../../convex/functions/vesselOrchestrator/actions.ts). Long-term **`runUpdateVesselTrips`** remains optional; memo Step 7 acceptance matches actual API names.
- **Docs** — Architecture, roadmap memo, imports memo, and READMEs updated; [`functions/vesselOrchestrator/README.md`](../../convex/functions/vesselOrchestrator/README.md) was already current and left unchanged.
- **Barrels** — [`orchestratorTick/index.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/index.ts) re-exports the new module; no dangling references to the deleted file.

## Non-goals (this step)

- **No** full **`updateVesselPredictions`** redesign (tracked separately unless cleanup forces a tiny import trim).
- **No** bulk snapshot or **`getScheduleSnapshotForTick`** semantic changes.
- **No** removal of **`pendingActualMessages` / `pendingPredictedMessages`** on the bundle (timeline path still consumes them unless a later contract change lands).

## Landmarks (steady state)

| Area | Notes |
|------|--------|
| Storage rows from bundle | [`orchestratorTick/tripsComputeStorageRows.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/tripsComputeStorageRows.ts) — **`buildTripsComputeStorageRows`**, **`completedFactsForSuccessfulHandoffs`**; used by **`vesselTripTickWriteSet.ts`**, **`persistVesselTripsCompute.ts`**, tests. |
| Write set | [`orchestratorTick/vesselTripTickWriteSet.ts`](../../convex/domain/vesselOrchestration/orchestratorTick/vesselTripTickWriteSet.ts) — bundle → **`VesselTripTickWriteSet`**. |
| Bundle | [`updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts`](../../convex/domain/vesselOrchestration/updateVesselTrips/tripLifecycle/vesselTripsComputeBundle.ts) — includes `pending*Messages` for timeline merge. |
| Tick handshake | [`tickLifecycle/`](../../convex/domain/vesselOrchestration/tickLifecycle/) — lifecycle outcome shapes (Step 6). |

## Acceptance criteria (memo)

- CI green: **`bun run check:fix`**, **`bun run type-check`**, **`bun run test`**, **`bun run convex:typecheck`**.
- Engineering memo and domain/orchestrator docs **describe the shipped pipeline** (`tickLifecycle`, write-set persist, snapshot-backed deps) and state **actual** API names where **`runUpdateVesselTrips`** was aspirational.
- No orphaned **`vesselTripsExecutionPayloads`** module path in production code; `orchestratorTick` exports consistent with implementation.

## Verification

```bash
bun run check:fix
bun run type-check
bun run test
bun run convex:typecheck
```

## Related docs

- [`vessel-trips-pure-pipeline-refactor-outline-memo.md`](../engineering/vessel-trips-pure-pipeline-refactor-outline-memo.md) — §Step 7, §(b) target end state
- [`imports-and-module-boundaries-memo.md`](../engineering/imports-and-module-boundaries-memo.md)
- Step 5–6 handoffs — barrel and **`tickLifecycle`** boundaries

## Note on older handoffs

Steps 2–3 handoff tables may still mention **`vesselTripsExecutionPayloads.ts`** by historical name; treat those as **time-stamped context**. The current module is **`tripsComputeStorageRows.ts`**.
