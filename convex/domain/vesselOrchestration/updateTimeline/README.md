# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and **`buildDockWritesFromTripHandoff`**.

**`PersistedTripTimelineHandoff`** and prediction-stage **`MlTimelineOverlay`** rows are produced upstream (trip persistence / orchestrator handoff). The shipped orchestrator path calls **`runUpdateVesselTimelineFromAssembly`** from **`persistOrchestratorPing`** (`functions/vesselOrchestrator/mutations.ts`) with that handoff directly after trip writes.

**Apply** (Convex mutations) for timeline projection runs inside **`persistOrchestratorPing`**: domain **`runUpdateVesselTimelineFromAssembly`** takes **`RunUpdateVesselTimelineFromAssemblyInput`**, merges ML from **`mlTimelineOverlays`** via **`mergeMlOverlayIntoTripHandoffForTimeline`**, runs **`buildDockWritesFromTripHandoff`**, and returns **`actualEvents`** / **`predictedEvents`** for `eventsActual` / `eventsPredicted` mutations.

## Production call chain

1. [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator` / `runOrchestratorPing`: **`updateVesselTrips`** (per-vessel loop over the full normalized feed) → **`runPredictionStage`** → single mutation **`persistOrchestratorPing`** (`feedLocations` + **`performBulkUpsertVesselLocations`** first, then trips, prediction rows, then timeline).
2. **`persistOrchestratorPing`** calls **`runUpdateVesselTimelineFromAssembly`** with the persisted-trip handoff from trip writes plus **`mlTimelineOverlays`**, then applies dock writes. **`vesselTripPredictions`** row dedupe (overlay equality, MAE-insensitive) lives in **`functions`** **`batchUpsertProposals`**; timeline assembly consumes the merged handoff, not the prediction table.

## Handoff glossary

Orchestrator ping output crosses several DTOs. Canonical definitions live in [`../shared/pingHandshake/types.ts`](../shared/pingHandshake/types.ts); this table is the “who produces / who consumes” map.

| Type | Produced when | Consumed by | Notes |
| --- | --- | --- | --- |
| `CompletedArrivalHandoff` | Trip persistence planning / completed rollover | Prediction gating, then timeline assembly (`buildDockWritesFromTripHandoff`) | `scheduleTrip` is pre-ML; `newTrip` is ML overlay when present. |
| `ActualDockWriteIntent` | Persistence plan for vessels with dock boundary signals | Timeline current branch (`pendingActualMessages`) | Often upsert-gated via `requiresSuccessfulUpsert`. |
| `PredictedDockWriteIntent` | Persistence plan for predicted dock effects on current path | Timeline current branch (`pendingPredictedMessages`) | Carries `existingTrip` + `scheduleTrip` for projection. |
| `ActiveTripWriteOutcome` | After `persistVesselTripWriteSet` (with `successfulVessels` from batch upsert) | `runUpdateVesselTimelineFromAssembly` input assembly | Joins actual + predicted pending messages with success set. |
| `MlTimelineOverlay` | Same pass as prediction row build (`updateVesselPredictions`) | `mergeMlOverlayIntoTripHandoffForTimeline` | ML overlay for timeline; not read back from `vesselTripPredictions` during projection. |
| `PersistedTripTimelineHandoff` | `persistVesselTripWriteSet` return value | `mergeMlOverlayIntoTripHandoffForTimeline` → `buildDockWritesFromTripHandoff` | Holds `completedFacts` + `currentBranch` as the single shared handoff shape. |

Further renames or public type aliases are optional: this table is the intended consolidation layer unless a future change agrees on a single rename pass across all imports.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `orchestratorTimelineProjection.ts` | `runUpdateVesselTimelineFromAssembly`, ML merge |
| `../shared/pingHandshake/projectionWire.ts` | `PingEventWrites`, `mergePingEventWrites` (canonical; timeline imports here) |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildDockWritesFromTripHandoff.ts` | Completed + current branch merge per ping |
| `../shared/pingHandshake/types.ts` | Handshake DTOs (`CompletedArrivalHandoff`, dock intents, …); canonical definitions |
| `index.ts` | Public barrel (`runUpdateVesselTimelineFromAssembly`, contracts, projection input types) |

## Imports

- **`persistOrchestratorPing`** — production caller path for timeline projection (after predictions merge).
- Lifecycle code imports handshake DTOs from **`domain/vesselOrchestration/shared/pingHandshake/types`** (re-exported from **`updateTimeline`** barrel for convenience).
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and canonical `Timestamp semantics (current code)` contract
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
