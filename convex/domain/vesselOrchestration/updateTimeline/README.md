# updateTimeline (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and **`buildDockWritesFromTripHandoff`**.

## Production orchestrator wiring

Domain **`updateTimeline`** is pure projection: it takes **`RunUpdateVesselTimelineFromAssemblyInput`** (`pingStartedAt`, **`tripUpdate`** as **`VesselTripUpdate`**, **`mlTimelineOverlays`**). It derives **`PersistedTripTimelineHandoff`** via **`timelineHandoffFromTripUpdate`**, applies ML overlays onto that handoff in memory, runs **`buildDockWritesFromTripHandoff`**, and returns **`actualEvents`** / **`predictedEvents`** for persistence. Lower-level projection from an already-built handoff is available as **`projectTimelineFromHandoff`** in **`updateTimeline.ts`** (used by focused tests).

On the shipped path these rows are written through explicit stage-level persistence helpers. **`functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts`** runs **`updateTimeline`** inside **`runOrchestratorPing`** after trip and prediction persistence, then persists timeline rows through dedicated actual/predicted writes for each changed vessel.

**`vesselTripPredictions`** proposal upserts run as their own stage-level write before timeline persistence; timeline assembly consumes the handoff + ML overlays in action memory, not a reload from the prediction table.

## Production call chain

1. [`updateVesselOrchestrator.ts`](../../../functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts) — **`updateVesselOrchestrator`** / **`runOrchestratorPing`**: load identities (**`loadOrchestratorSnapshot`** / **`getOrchestratorIdentities`**), update locations (**`runUpdateVesselLocations`**: fetch + normalize + `AtDockObserved` + **`bulkUpsertVesselLocations`**, which returns **`activeTripsForChanged`** in the same mutation), then process per-vessel changed rows.
2. Per changed vessel: **`updateVesselTrip`** → **`VesselTripUpdate | null`** (skip when null).
3. **`loadPredictionContext`** ([`actions/ping/updateVesselPredictions/index.ts`](../../../functions/vesselOrchestrator/actions/ping/updateVesselPredictions/index.ts)) queries production model parameters when **`predictionModelLoadRequestForTripUpdate`** returns a request.
4. **`updateVesselPredictions`** (`domain/vesselOrchestration/updateVesselPredictions`) with **`{ tripUpdate, predictionContext }`** → **`predictionRows`**, **`mlTimelineOverlays`**.
5. **`updateTimeline`** (this folder) with **`{ pingStartedAt, tripUpdate, mlTimelineOverlays }`** → **`actualEvents`**, **`predictedEvents`** (handoff derived inside **`timelineHandoffFromTripUpdate`**; ML merge uses **`buildCompletedHandoffKey`** from [`completedHandoffKey.ts`](./completedHandoffKey.ts)).
6. Stage-level persistence runs in order: optional completed-trip insert, active-trip upsert, prediction upserts, timeline actual writes, then timeline predicted writes.

## Handoff glossary

Orchestrator ping output crosses several DTOs. Canonical definitions live in this
folder (primarily [`handoffTypes.ts`](./handoffTypes.ts)); this table is the
“who produces / who consumes” map.

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
| `projectionWire.ts` | `PingEventWrites`, `mergePingEventWrites` (canonical timeline projection wire helpers) |
| `completedHandoffKey.ts` | **`buildCompletedHandoffKey`** — stable key for completed-branch ML ↔ facts merge |
| `timelineEventAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildDockWritesFromTripHandoff.ts` | Completed + current branch merge per ping |
| `handoffTypes.ts` | Handshake DTOs (`CompletedArrivalHandoff`, dock intents, `MlTimelineOverlay`, ...); canonical definitions |
| `index.ts` | Public barrel (`updateTimeline`, contracts, projection input types) |

## Imports

- **`functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts`** + stage-level persist helpers — production caller path: action-side **`updateTimeline`**, then explicit per-vessel timeline persistence after trip/prediction persists.
- Lifecycle and prediction code import handshake DTOs from this folder (via
  `updateTimeline/handoffTypes.ts` and `updateTimeline` barrel exports).
- **`domain/vesselOrchestration/updateVesselTrip/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and canonical `Timestamp semantics (current code)` contract
- [Orchestrator module README](../../../functions/vesselOrchestrator/README.md) — overview and O1 stage list
- [vesselTrips functions README](../../../functions/vesselTrips/README.md) — Convex `vesselTrips` entrypoints
