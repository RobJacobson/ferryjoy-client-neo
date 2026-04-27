# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and **`buildDockWritesFromTripHandoff`**.

## Production orchestrator wiring

Domain **`updateTimeline`** is pure projection: it takes **`RunUpdateVesselTimelineFromAssemblyInput`** (`pingStartedAt`, **`tripUpdate`** as **`VesselTripUpdate`**, **`mlTimelineOverlays`**). It derives **`PersistedTripTimelineHandoff`** via **`timelineHandoffFromTripUpdate`**, applies ML overlays onto that handoff in memory, runs **`buildDockWritesFromTripHandoff`**, and returns **`actualEvents`** / **`predictedEvents`** for persistence. Lower-level projection from an already-built handoff is available as **`projectTimelineFromHandoff`** in **`updateTimeline.ts`** (used by focused tests).

On the shipped path these rows are **not** written by a separate “timeline-only” mutation. **`functions/vesselOrchestrator/action/actions.ts`** runs **`updateTimeline`** inside **`runOrchestratorPing`** *before* calling **`persistPerVesselOrchestratorWrites`**, which applies trip lifecycle writes, prediction upserts, **and** those timeline rows in one internal mutation per changed vessel ([`persistPerVesselOrchestratorWrites`](../../../functions/vesselOrchestrator/mutation/mutations.ts)).

**`vesselTripPredictions`** proposal upserts use **`batchUpsertProposalsInDb`** inside that same mutation phase; timeline assembly consumes the handshake + ML overlays in action memory, not a reload from the prediction table.

## Production call chain

1. [`action/actions.ts`](../../../functions/vesselOrchestrator/action/actions.ts) — **`updateVesselOrchestrator`** / **`runOrchestratorPing`**: load snapshot (**`loadOrchestratorSnapshot`**), update locations (**`runStage1UpdateVesselLocations`**: fetch + normalize + `AtDockObserved` + persist), then process per-vessel changed rows.
2. Per changed vessel: **`updateVesselTrip`** → **`VesselTripUpdate | null`** (skip when null).
3. **`loadPredictionContext`** ([`predictionContextLoader.ts`](../../../functions/vesselOrchestrator/action/predictionContextLoader.ts)) queries production model parameters when **`predictionModelLoadRequestsForTripUpdate`** returns requests.
4. **`updateVesselPredictions`** (`domain/vesselOrchestration/updateVesselPredictions`) with **`{ tripUpdate, predictionContext }`** → **`predictionRows`**, **`mlTimelineOverlays`**.
5. **`updateTimeline`** (this folder) with **`{ pingStartedAt, tripUpdate, mlTimelineOverlays }`** → **`actualEvents`**, **`predictedEvents`** (handoff derived inside **`timelineHandoffFromTripUpdate`**; ML merge uses **`buildCompletedHandoffKey`** from [`../shared/pingHandshake/completedHandoffKey.ts`](../shared/pingHandshake/completedHandoffKey.ts)).
6. **`persistPerVesselOrchestratorWrites`** applies **`persistVesselTripWrites`**, prediction upserts, and timeline writes (actual + predicted dock rows).

## Handoff glossary

Orchestrator ping output crosses several DTOs. Canonical definitions live in [`../shared/pingHandshake/types.ts`](../shared/pingHandshake/types.ts); this table is the “who produces / who consumes” map.

| Type | Produced when | Consumed by | Notes |
| --- | --- | --- | --- |
| `CompletedArrivalHandoff` | Derived inside **`predictionInputsFromTripUpdate`** / completion facts when **`VesselTripUpdate`** has **`existingActiveTrip`** + **`completedVesselTripUpdate`** | Prediction (`updateVesselPredictions`), then timeline assembly | `scheduleTrip` is pre-ML; **`newTrip`** is ML-filled before **`buildDockWritesFromTripHandoff`** completes facts. |
| `ActualDockWriteIntent` | **`timelineHandoffFromTripUpdate`** when active-trip lifecycle events imply an actual dock write | Timeline current branch (`pendingActualWrite`) | Gated by **`successfulVesselAbbrev`** in assembler. |
| `PredictedDockWriteIntent` | **`timelineHandoffFromTripUpdate`** when an active trip update exists | Timeline current branch (`pendingPredictedWrite`) | Carries `existingTrip` + `scheduleTrip` for projection. |
| `ActiveTripWriteOutcome` | **`timelineHandoffFromTripUpdate`** (`currentBranch`) | **`updateTimeline`** internal handoff | Reflects sparse write intents for the ping; derived from **`VesselTripUpdate`**, not a separate action “write plan” bundle. |
| `MlTimelineOverlay` | **`updateVesselPredictions`** (same pass as prediction row build) | **`updateTimeline`** | **`completed`** branch carries **`completedHandoffKey`** for merge with facts. |
| `PersistedTripTimelineHandoff` | **`timelineHandoffFromTripUpdate(tripUpdate)`** in domain | **`updateTimeline`** → **`buildDockWritesFromTripHandoff`** | Holds **`completedTripFacts`** + **`currentBranch`** — same ping semantics as before; assembly moved from orchestrator action into **`updateTimeline`**. |

Further renames or public type aliases are optional: this table is the intended consolidation layer unless a future change agrees on a single rename pass across all imports.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `updateTimeline.ts` | `updateTimeline`, `projectTimelineFromHandoff` (tests / lower-level), ML overlay application + projection wiring |
| `timelineHandoffFromTripUpdate.ts` | **`VesselTripUpdate`** → **`PersistedTripTimelineHandoff`** |
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
