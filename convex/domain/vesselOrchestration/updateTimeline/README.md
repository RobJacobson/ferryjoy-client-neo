# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and `buildTimelinePingProjectionInput`.

**TripComputation assembly** (`assembleTripComputationsFromBundle`) lives here, not in **`updateVesselTrips`**: the orchestrator flattens **`VesselTripsComputeBundle`** into **`TripComputation[]`** for **`buildTimelineTripComputationsForRun`** (persist gates) before **`runUpdateVesselTimeline`**. **`updateVesselTrips`** only computes the bundle and trip-table row lists.

**Apply** (Convex mutations) for timeline projection runs from **`functions/vesselOrchestrator/actions.ts`**: **`updateVesselTimeline`** calls domain **`runUpdateVesselTimeline`** with **`RunUpdateVesselTimelineInput`** (orchestrator builds **`TimelineTripComputation`** rows after persist via **`buildTimelineTripComputationsForRun`**), then runs `eventsActual` / `eventsPredicted` mutations. There is no separate timeline runner module; the sequence is inline in **`actions.ts`**.

## Production call chain

1. [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator`: bulk upsert locations → **`updateVesselTrips`** → **`updateVesselPredictions`** → **`updateVesselTimeline`**.
2. **`updateVesselTimeline`** calls **`runUpdateVesselTimeline`**, which builds **`TimelineProjectionAssembly`** from **`TimelineTripComputation`** rows, merges ML from **`predictedTripComputations`** via **`mergePredictedComputationsIntoTimelineProjectionAssembly`**, runs **`buildTimelinePingProjectionInput`**, and returns **`actualEvents`** / **`predictedEvents`** (same ping does not assemble timeline from `vesselTripPredictions` DB reads). **`vesselTripPredictions`** row dedupe (overlay equality, MAE-insensitive) lives in **`functions`** **`batchUpsertProposals`**; timeline assembly consumes the merged trip handoff, not the prediction table.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `assembleTripComputationsFromBundle.ts` | `VesselTripsComputeBundle` → `TripComputation[]` for timeline persist filtering |
| `pingEventWrites.ts` | `PingEventWrites`, `TimelinePingProjectionInput`, `mergePingEventWrites` |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildTimelinePingProjectionInput.ts` | Completed + current branch merge per ping |
| `types.ts` | DTOs shared with `processCompletedTrips` / `processCurrentTrips` |
| `index.ts` | Public barrel (`runUpdateVesselTimeline`, contracts, projection input types) |

## Imports

- **`actions.updateVesselTimeline`** — production caller path for projection input (after predictions merge).
- Lifecycle code imports boundary types from **`domain/vesselOrchestration/updateTimeline/types`**.
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and folder layout
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
