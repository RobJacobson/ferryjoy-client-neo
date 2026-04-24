# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and `buildTimelinePingProjectionInput`.

**`VesselTripPersistResult`** and prediction-stage ML rows are produced upstream (trip persistence / orchestrator handoff). The shipped orchestrator path calls **`runUpdateVesselTimelineFromAssembly`** from **`persistOrchestratorPing`** (`functions/vesselOrchestrator/mutations.ts`) with projection assembly built after trip writes.

**Apply** (Convex mutations) for timeline projection runs inside **`persistOrchestratorPing`**: domain **`runUpdateVesselTimelineFromAssembly`** takes **`RunUpdateVesselTimelineFromAssemblyInput`**, merges ML from **`predictedTripComputations`** via **`mergePredictedComputationsIntoTimelineProjectionAssembly`**, runs **`buildTimelinePingProjectionInput`**, and returns **`actualEvents`** / **`predictedEvents`** for `eventsActual` / `eventsPredicted` mutations.

## Production call chain

1. [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator`: bulk upsert locations → **`updateVesselTrips`** → **`runAndPersistVesselPredictionPing`** → single mutation **`persistOrchestratorPing`** (locations already written; trips, predictions rows, then timeline).
2. **`persistOrchestratorPing`** calls **`runUpdateVesselTimelineFromAssembly`** with **`projectionAssembly`** from trip persist results plus **`predictedTripComputations`**, then applies dock writes. **`vesselTripPredictions`** row dedupe (overlay equality, MAE-insensitive) lives in **`functions`** **`batchUpsertProposals`**; timeline assembly consumes the merged trip handoff, not the prediction table.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `orchestratorTimelineProjection.ts` | `runUpdateVesselTimelineFromAssembly`, ML merge |
| `../shared/pingHandshake/projectionWire.ts` | `PingEventWrites`, `TimelinePingProjectionInput`, `mergePingEventWrites` (canonical; timeline imports here) |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildTimelinePingProjectionInput.ts` | Completed + current branch merge per ping |
| `../shared/pingHandshake/types.ts` | Handshake DTOs (`CompletedTripBoundaryFact`, lifecycle messages, …); canonical definitions |
| `index.ts` | Public barrel (`runUpdateVesselTimelineFromAssembly`, contracts, projection input types) |

## Imports

- **`persistOrchestratorPing`** — production caller path for timeline projection (after predictions merge).
- Lifecycle code imports handshake DTOs from **`domain/vesselOrchestration/shared/pingHandshake/types`** (re-exported from **`updateTimeline`** barrel for convenience).
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and folder layout
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
