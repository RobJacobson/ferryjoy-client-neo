# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and **`buildDockWritesFromTripHandoff`**.

## Production orchestrator wiring

Domain **`updateTimeline`** is pure projection: it takes **`RunUpdateVesselTimelineFromAssemblyInput`** (`pingStartedAt`, **`tripHandoffForTimeline`** as **`PersistedTripTimelineHandoff`**, **`mlTimelineOverlays`**), applies ML overlays onto the handoff in memory, runs **`buildDockWritesFromTripHandoff`**, and returns **`actualEvents`** / **`predictedEvents`** for persistence.

On the shipped path these rows are **not** written by a separate “timeline-only” mutation. **`functions/vesselOrchestrator/action/actions.ts`** runs **`updateTimeline`** inside **`runOrchestratorPing`** *before* calling **`persistPerVesselOrchestratorWrites`**, which applies trip lifecycle writes, prediction upserts, **and** those timeline rows in one internal mutation per changed vessel ([`persistPerVesselOrchestratorWrites`](../../../functions/vesselOrchestrator/mutation/mutations.ts)).

**`vesselTripPredictions`** proposal upserts use **`batchUpsertProposalsInDb`** inside that same mutation phase; timeline assembly consumes the handshake + ML overlays in action memory, not a reload from the prediction table.

## Production call chain

1. [`action/actions.ts`](../../../functions/vesselOrchestrator/action/actions.ts) — **`updateVesselOrchestrator`** / **`runOrchestratorPing`**: load snapshot (**`loadOrchestratorSnapshot`**), update locations (**`updateVesselLocations`** stage: fetch + normalize + `AtDockObserved` + persist), then process per-vessel changed rows.
2. Per changed vessel: **`computeTripStageForLocation`** runs **`updateVesselTrip`**, **`runPredictionStage`**, and **`buildTripWritesForVessel`** → sparse **`tripWrites`**, **`predictionRows`**, **`mlTimelineOverlays`**.
3. **`toTimelineHandoffFromTripWrites`** maps **`tripWrites`** → **`PersistedTripTimelineHandoff`** for **`updateTimeline`**.
4. **`updateTimeline`** merges ML overlays (**`completedHandoffKey`** alignment uses shared **`buildCompletedHandoffKey`** from [`../shared/pingHandshake/completedHandoffKey.ts`](../shared/pingHandshake/completedHandoffKey.ts)).
5. **`persistPerVesselOrchestratorWrites`** applies **`persistVesselTripWrites`**, **`persistVesselPredictions`**, **`persistVesselTimelineWrites`** (actual + predicted dock rows).

## Handoff glossary

Orchestrator ping output crosses several DTOs. Canonical definitions live in [`../shared/pingHandshake/types.ts`](../shared/pingHandshake/types.ts); this table is the “who produces / who consumes” map.

| Type | Produced when | Consumed by | Notes |
| --- | --- | --- | --- |
| `CompletedArrivalHandoff` | Sparse **`tripWrites.completedTripWrite`** / prediction **`completedHandoffs`** | Prediction (`updateVesselPredictions`), then timeline assembly | `scheduleTrip` is pre-ML; **`newTrip`** is ML-filled before **`buildDockWritesFromTripHandoff`** completes facts. |
| `ActualDockWriteIntent` | **`tripWrites.actualDockWrite`** after lifecycle inference | Timeline current branch (`pendingActualWrite`) | Gated by **`successfulVesselAbbrev`** in assembler. |
| `PredictedDockWriteIntent` | **`tripWrites.predictedDockWrite`** | Timeline current branch (`pendingPredictedWrite`) | Carries `existingTrip` + `scheduleTrip` for projection. |
| `ActiveTripWriteOutcome` | Mapped from **`tripWrites`** via **`toTimelineHandoffFromTripWrites`** (`currentBranch`) | **`updateTimeline`** input assembly | Reflects sparse write intents for the ping; does not wait on DB persistence. |
| `MlTimelineOverlay` | **`updateVesselPredictions`** (same pass as prediction row build) | **`updateTimeline`** | **`completed`** branch carries **`completedHandoffKey`** for merge with facts. |
| `PersistedTripTimelineHandoff` | **`toTimelineHandoffFromTripWrites`** in orchestrator action | **`updateTimeline`** → **`buildDockWritesFromTripHandoff`** | Holds **`completedTripFacts`** + **`currentBranch`** — same shape whether or not rows are persisted yet. |

Further renames or public type aliases are optional: this table is the intended consolidation layer unless a future change agrees on a single rename pass across all imports.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `updateTimeline.ts` | `updateTimeline`, ML overlay application + projection wiring |
| `../shared/pingHandshake/projectionWire.ts` | `PingEventWrites`, `mergePingEventWrites` (canonical; timeline imports here) |
| `../shared/pingHandshake/completedHandoffKey.ts` | **`buildCompletedHandoffKey`** — stable key for completed-branch ML ↔ facts merge |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildDockWritesFromTripHandoff.ts` | Completed + current branch merge per ping |
| `../shared/pingHandshake/types.ts` | Handshake DTOs (`CompletedArrivalHandoff`, dock intents, …); canonical definitions |
| `index.ts` | Public barrel (`updateTimeline`, contracts, projection input types) |

## Imports

- **`functions/vesselOrchestrator/action/actions.ts`** + **`persistPerVesselOrchestratorWrites`** — production caller path: action-side **`updateTimeline`**, then unified per-vessel persistence.
- Lifecycle code imports handshake DTOs from **`domain/vesselOrchestration/shared/pingHandshake/types`** (re-exported from **`domain/vesselOrchestration/shared`** and the **`updateTimeline`** barrel for convenience).
- **`domain/vesselOrchestration/updateVesselTrip/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and canonical `Timestamp semantics (current code)` contract
- [Orchestrator module README](../../../functions/vesselOrchestrator/README.md) — overview and O1 stage list
- [vesselTrips functions README](../../../functions/vesselTrips/README.md) — Convex `vesselTrips` entrypoints
