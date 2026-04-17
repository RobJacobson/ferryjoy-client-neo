# updateVesselLocations (orchestrator concern)

**updateVesselLocations** is the live vessel location snapshot for each orchestrator
tick: the same converted `ConvexVesselLocation` batch is persisted before trip
processing uses it.

## Domain modules

| File | Role |
| --- | --- |
| [`bulkUpsertArgsFromLocations.ts`](./bulkUpsertArgsFromLocations.ts) | Map a read-only tick batch to `bulkUpsert` mutation args |
| [`runUpdateVesselLocationsTick.ts`](./runUpdateVesselLocationsTick.ts) | Tick entry: args + injected `bulkUpsert` effect |
| [`index.ts`](./index.ts) | Barrel re-exports |

## Production wiring

Convex `ctx.runMutation` is injected into
[`runUpdateVesselLocationsTick`](./runUpdateVesselLocationsTick.ts) from
[`convex/functions/vesselOrchestrator/actions.ts`](../../../functions/vesselOrchestrator/actions.ts)
(`deps.persistLocations` / `updateVesselOrchestrator` → `runVesselOrchestratorTick`).
See [`../architecture.md`](../architecture.md) §10.
