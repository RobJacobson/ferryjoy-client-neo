# updateTimeline (orchestrator concern)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one tick: types, merge, assembler, and `buildTimelineTickProjectionInput`. **Apply** is **not** in this folder: the single entry is **`applyTickEventWrites`** in [`../../../functions/vesselOrchestrator/applyTickEventWrites.ts`](../../../functions/vesselOrchestrator/applyTickEventWrites.ts), which runs the internal timeline projection mutations after lifecycle writes for the tick. Production calls it from [`executeVesselOrchestratorTick`](../../../functions/vesselOrchestrator/executeVesselOrchestratorTick.ts) (invoked from [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts)).

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `tickEventWrites.ts` | `TickEventWrites`, `TimelineTickProjectionInput`, `mergeTickEventWrites` |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → tick writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildTimelineTickProjectionInput.ts` | Completed + current branch merge per tick |
| `types.ts` | DTOs shared with `processCompletedTrips` / `processCurrentTrips` |
| `index.ts` | Barrel re-exports |

## Imports

- **`runProcessVesselTripsTick`** (`functions/vesselOrchestrator`) imports `buildTimelineTickProjectionInput` from **`domain/vesselOrchestration/updateTimeline`** (folder entry).
- Lifecycle code imports boundary types from **`domain/vesselOrchestration/updateTimeline/types`**.
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full tick map and folder layout
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
