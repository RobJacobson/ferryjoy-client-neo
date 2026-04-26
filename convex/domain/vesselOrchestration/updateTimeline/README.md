# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and **`buildDockWritesFromTripHandoff`**.

**`PersistedTripTimelineHandoff`** and prediction-stage **`MlTimelineOverlay`** rows are produced upstream (trip persistence / orchestrator handoff). The shipped orchestrator path calls **`updateTimeline`** in **`actions.ts`** after trip+prediction persistence, then persists final timeline rows through a dedicated mutation.

**Apply** (Convex mutations) for timeline projection runs in a dedicated timeline mutation: domain **`updateTimeline`** takes **`RunUpdateVesselTimelineFromAssemblyInput`**, applies ML overlays onto trip handoff rows, runs **`buildDockWritesFromTripHandoff`**, and returns **`actualEvents`** / **`predictedEvents`** that `persistTimelineEventWrites` applies to `eventsActual` / `eventsPredicted`.

## Production call chain

1. [`actions.ts`](../../../functions/vesselOrchestrator/actions.ts) — `updateVesselOrchestrator` / `runOrchestratorPing`: **`updateVesselTrips`** (per-vessel loop over the full normalized feed) → **`runPredictionStage`**.
2. Mutation **`persistTripAndPredictionWrites`** applies trip writes + prediction upserts and returns persisted handoff rows.
3. `actions.ts` runs **`updateTimeline`** with that persisted-trip handoff + **`mlTimelineOverlays`**.
4. Mutation **`persistTimelineEventWrites`** applies final dock writes to `eventsActual` / `eventsPredicted`. **`vesselTripPredictions`** row dedupe (overlay equality, MAE-insensitive) lives in **`functions`** **`batchUpsertProposals`**; timeline assembly consumes the merged handoff, not the prediction table.

## Handoff glossary

Orchestrator ping output crosses several DTOs. Canonical definitions live in [`../shared/pingHandshake/types.ts`](../shared/pingHandshake/types.ts); this table is the “who produces / who consumes” map.

| Type | Produced when | Consumed by | Notes |
| --- | --- | --- | --- |
| `CompletedArrivalHandoff` | Trip persistence planning / completed rollover | Prediction gating, then timeline assembly (`buildDockWritesFromTripHandoff`) | `scheduleTrip` is pre-ML; `newTrip` is ML overlay when present. |
| `ActualDockWriteIntent` | Persistence plan for vessels with dock boundary signals | Timeline current branch (`pendingActualWrite`) | Applied only when `successfulVesselAbbrev` matches the intent vessel. |
| `PredictedDockWriteIntent` | Persistence plan for predicted dock effects on current path | Timeline current branch (`pendingPredictedWrite`) | Carries `existingTrip` + `scheduleTrip` for projection. |
| `ActiveTripWriteOutcome` | After `persistVesselTripWriteSet` | `updateTimeline` input assembly | Holds one-vessel upsert success plus optional current-branch intents. |
| `MlTimelineOverlay` | Same pass as prediction row build (`updateVesselPredictions`) | `updateTimeline` | ML overlay for timeline; not read back from `vesselTripPredictions` during projection. |
| `PersistedTripTimelineHandoff` | `persistVesselTripWriteSet` return value | `updateTimeline` → `buildDockWritesFromTripHandoff` | Holds `completedTripFacts` + `currentBranch` as the single shared handoff shape. |

Further renames or public type aliases are optional: this table is the intended consolidation layer unless a future change agrees on a single rename pass across all imports.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `updateTimeline.ts` | `updateTimeline`, ML overlay application + projection wiring |
| `../shared/pingHandshake/projectionWire.ts` | `PingEventWrites`, `mergePingEventWrites` (canonical; timeline imports here) |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildDockWritesFromTripHandoff.ts` | Completed + current branch merge per ping |
| `../shared/pingHandshake/types.ts` | Handshake DTOs (`CompletedArrivalHandoff`, dock intents, …); canonical definitions |
| `index.ts` | Public barrel (`updateTimeline`, contracts, projection input types) |

## Imports

- **`actions.ts` + `persistTimelineEventWrites`** — production caller path for timeline projection (after predictions merge).
- Lifecycle code imports handshake DTOs from **`domain/vesselOrchestration/shared/pingHandshake/types`** (re-exported from **`updateTimeline`** barrel for convenience).
- **`domain/vesselOrchestration/updateVesselTrips/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and canonical `Timestamp semantics (current code)` contract
- [`../../vesselTrips/README.md`](../../vesselTrips/README.md) — `vesselTrips` package entry
