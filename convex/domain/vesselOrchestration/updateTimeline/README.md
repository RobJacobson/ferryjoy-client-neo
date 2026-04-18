# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one tick: types, merge, assembler, and `buildTimelineTickProjectionInput`.

**Apply** (Convex mutations) lives in **`functions/vesselOrchestrator/orchestratorPipelines.ts`**: `updateVesselTimeline` builds projection input via `buildTimelineTickProjectionInput`, then runs internal `eventsActual` / `eventsPredicted` projection mutations (same module, not exported as a separate file).

## Production call chain

1. [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator` loads the tick snapshot and delegates to the pipelines module.
2. [`orchestratorPipelines.ts`](../../../functions/vesselOrchestrator/orchestratorPipelines.ts) — `runVesselOrchestratorPhases`: **`updateVesselTrips`** → **`updateVesselPredictions`** (`enrichTripApplyResultWithPredictions`, then `vesselTripPredictions` upserts) → **`updateVesselTimeline`**.
3. `updateVesselTimeline` passes **ML-enriched** `TripLifecycleApplyOutcome` slices into `buildTimelineTickProjectionInput` (same tick does not assemble timeline from `vesselTripPredictions` DB reads).

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

- **`orchestratorPipelines`** / **`actions`** — production callers of `buildTimelineTickProjectionInput` (after predictions merge).
- Lifecycle code imports boundary types from **`domain/vesselOrchestration/updateTimeline/types`**.
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full tick map and folder layout
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
