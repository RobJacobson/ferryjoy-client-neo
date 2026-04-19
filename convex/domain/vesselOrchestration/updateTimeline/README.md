# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one tick: types, merge, assembler, and `buildTimelineTickProjectionInput`.

**Apply** (Convex mutations) for timeline projection runs from **`functions/vesselOrchestrator/actions.ts`**: **`updateVesselTimeline`** calls domain **`runUpdateVesselTimeline`** with **`RunUpdateVesselTimelineInput`** (orchestrator builds **`TimelineTripComputation`** rows after persist via **`buildTimelineTripComputationsForRun`**), then runs `eventsActual` / `eventsPredicted` mutations. There is no separate timeline runner module; the sequence is inline in **`actions.ts`**.

## Production call chain

1. [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator`: bulk upsert locations → **`updateVesselTrips`** → **`updateVesselPredictions`** → **`updateVesselTimeline`**.
2. **`updateVesselTimeline`** calls **`runUpdateVesselTimeline`**, which builds **`TimelineProjectionAssembly`** from **`TimelineTripComputation`** rows, merges ML from **`predictedTripComputations`** via **`mergePredictedComputationsIntoTimelineProjectionAssembly`**, runs **`buildTimelineTickProjectionInput`**, and returns **`actualEvents`** / **`predictedEvents`** (same tick does not assemble timeline from `vesselTripPredictions` DB reads).

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `tickEventWrites.ts` | `TickEventWrites`, `TimelineTickProjectionInput`, `mergeTickEventWrites` |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → tick writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildTimelineTickProjectionInput.ts` | Completed + current branch merge per tick |
| `types.ts` | DTOs shared with `processCompletedTrips` / `processCurrentTrips` |
| `index.ts` | Public barrel (`runUpdateVesselTimeline`, contracts, projection input types) |

## Imports

- **`actions.updateVesselTimeline`** — production caller path for projection input (after predictions merge).
- Lifecycle code imports boundary types from **`domain/vesselOrchestration/updateTimeline/types`**.
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full tick map and folder layout
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
