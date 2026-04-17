# updateVesselLocations (orchestrator concern)

**updateVesselLocations** is the live vessel location snapshot for each orchestrator
tick: the same converted `ConvexVesselLocation` batch is persisted before trip
processing uses it.

## Domain modules

| File | Role |
| --- | --- |
| [`bulkUpsertArgsFromLocations.ts`](./bulkUpsertArgsFromLocations.ts) | Map a read-only tick batch to `bulkUpsert` mutation args |
| [`index.ts`](./index.ts) | Barrel re-exports |

## Production wiring

Convex `ctx.runMutation` runs in
[`convex/functions/vesselOrchestrator/actions.ts`](../../../functions/vesselOrchestrator/actions.ts)
(`deps.persistLocations` / `updateVesselOrchestrator` → `runVesselOrchestratorTick`).
See [`../architecture.md`](../architecture.md) §10.
