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

In production, [`orchestratorPipelines.updateVesselLocations`](../../../functions/vesselOrchestrator/orchestratorPipelines.ts)
runs inside `updateVesselTrips` (after `computeOrchestratorTripWrites`, before
`applyVesselTripTickWritePlan`), called from [`updateVesselOrchestrator`](../../../functions/vesselOrchestrator/actions.ts),
using `bulkUpsertArgsFromConvexLocations`. [`runUpdateVesselLocationsTick`](./runUpdateVesselLocationsTick.ts)
remains the test/replay helper with an injected `bulkUpsert` effect.
See [`../architecture.md`](../architecture.md) §10.
