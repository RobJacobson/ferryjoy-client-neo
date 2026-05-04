# updateEvents (domain assembly)

Sparse **`eventsActual`** / **`eventsPredicted`** payloads for one ping: types, merge, assembler, and **`buildDockWritesFromTripHandoff`**.

## Production orchestrator wiring

Domain **`updateEvents`** is pure projection: it takes **`RunUpdateVesselEventsFromAssemblyInput`** (`pingStartedAt`, **`tripUpdate`** as **`VesselTripUpdate`**, **`enrichedActiveVesselTrip`**). It derives **`PersistedTripEventHandoff`** via **`eventHandoffFromTripUpdate`**, builds event-owned **`PredictedTripEventHandoff`** branches from the enriched active trip, merges them in memory, runs **`buildDockWritesFromTripHandoff`**, and returns **`actualEvents`** / **`predictedEvents`** for persistence. Lower-level projection from an already-built handoff lives in **`projectEventsFromHandoff.ts`** (**`projectEventsFromHandoff`**, used by focused tests).

On the shipped path these rows are written through explicit stage-level persistence helpers. **`functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts`** runs **`updateEvents`** inside **`runOrchestratorPing`** after trip and prediction enrichment, then persists event rows through dedicated actual/predicted writes for each changed vessel.

## Production call chain

1. [`updateVesselOrchestrator.ts`](../../../functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts) — **`updateVesselOrchestrator`** / **`runOrchestratorPing`**: load identities (**`loadOrchestratorSnapshot`** / **`getOrchestratorIdentities`**), update locations (**`runUpdateVesselLocations`**: fetch + normalize + `AtDockObserved` + **`bulkUpsertVesselLocations`**, which returns **`activeTripsForChanged`** in the same mutation), then process per-vessel changed rows.
2. Per changed vessel: **`updateVesselTrip`** → **`VesselTripUpdate | null`** (skip when null).
3. Optional **`updateLeaveDockEventPatch`** when this ping observes leave-dock.
4. **`getVesselTripPredictionsFromTripUpdate`** (`domain/vesselOrchestration/updateVesselPredictions`) loads prediction model parameters when needed (**`loadPredictionModelParameters`**), then → **`enrichedActiveVesselTrip`**.
5. **`updateEvents`** (this folder) with **`{ pingStartedAt, tripUpdate, enrichedActiveVesselTrip }`** → **`actualEvents`**, **`predictedEvents`** (handoff derived inside **`eventHandoffFromTripUpdate`**; prediction overlay branches are built here and completed merge uses **`buildCompletedHandoffKey`** from [`completedHandoffKey.ts`](./completedHandoffKey.ts)).
6. Stage-level persistence runs in order: optional completed-trip insert, active-trip upsert, event actual writes, then event predicted writes.

## Handoff glossary

Orchestrator ping output crosses several DTOs. Canonical definitions live in this
folder (primarily [`handoffTypes.ts`](./handoffTypes.ts)); this table is the
“who produces / who consumes” map.

| Type | Produced when | Consumed by | Notes |
| --- | --- | --- | --- |
| `CompletedArrivalHandoff` | **`eventHandoffFromTripUpdate`** when **`existingVesselTrip`** and **`completedVesselTrip`** are both present on **`VesselTripUpdate`** | Event assembly | **`activeVesselTrip`** is pre-enrichment; the same enriched replacement is attached as **`activeVesselTripWithMl`** before **`buildDockWritesFromTripHandoff`** completes facts. |
| `ActualDockWriteIntent` | **`eventHandoffFromTripUpdate`** when active-trip lifecycle events imply an actual dock write | Event current branch (`pendingActualWrite`) | Gated by **`successfulVesselAbbrev`** in assembler. |
| `PredictedDockWriteIntent` | **`eventHandoffFromTripUpdate`** when an active trip update exists | Event current branch (`pendingPredictedWrite`) | Carries `existingTrip` + `scheduleTrip` for projection. |
| `ActiveTripWriteOutcome` | **`eventHandoffFromTripUpdate`** (`currentBranch`) | **`updateEvents`** internal handoff | Reflects sparse write intents for the ping; derived from **`VesselTripUpdate`**, not a separate action “write plan” bundle. |
| `PredictedTripEventHandoff` | **`updateEvents`** from same-ping **`enrichedActiveVesselTrip`** | **`projectEventsFromHandoff`** | Discriminated union; **`completed`** branch carries **`completedHandoffKey`** for merge with facts. |
| `PersistedTripEventHandoff` | **`eventHandoffFromTripUpdate(tripUpdate)`** in domain | **`updateEvents`** → **`buildDockWritesFromTripHandoff`** | Holds **`completedTripFacts`** + **`currentBranch`** — same ping semantics as before; assembly moved from orchestrator action into **`updateEvents`**. |

Further renames or public type aliases are optional: this table is the intended consolidation layer unless a future change agrees on a single rename pass across all imports.

## Canonical files (this folder)

| File | Role |
| --- | --- |
| `updateEvents.ts` | **`updateEvents`** — assembly entry (`tripUpdate` → handoff → **`projectEventsFromHandoff`**) |
| `projectEventsFromHandoff.ts` | **`projectEventsFromHandoff`** — merges prediction handoffs, **`buildDockWritesFromTripHandoff`** |
| `eventHandoffFromTripUpdate.ts` | **`VesselTripUpdate`** → **`PersistedTripEventHandoff`** |
| `projectionWire.ts` | `PingEventWrites`, `mergePingEventWrites` (canonical event projection wire helpers) |
| `completedHandoffKey.ts` | **`buildCompletedHandoffKey`** — stable key for completed-branch ML ↔ facts merge |
| `eventWriteAssembler.ts` | Lifecycle facts/messages → ping writes |
| `actualDockWritesFromTrip.ts` | Dep/arv actual dock writes from trip rows |
| `buildDockWritesFromTripHandoff.ts` | Completed + current branch merge per ping |
| `handoffTypes.ts` | Handshake DTOs (`CompletedArrivalHandoff`, dock intents, `PredictedTripEventHandoff`, ...); canonical definitions |
| `index.ts` | Public barrel (`updateEvents`, contracts, projection input types) |

## Imports

- **`functions/vesselOrchestrator/actions/updateVesselOrchestrator.ts`** + stage-level persist helpers — production caller path: action-side **`updateEvents`**, then explicit per-vessel event persistence after trip/prediction persists.
- Lifecycle and prediction code import handshake DTOs from this folder (via
  `updateEvents/handoffTypes.ts` and `updateEvents` barrel exports).
- **`domain/vesselOrchestration/updateVesselTrip/index.ts`** re-exports key symbols for queries and shared callers.

## See also

- [`../architecture.md`](../architecture.md) — full orchestrator map and canonical `Timestamp semantics (current code)` contract
- [Orchestrator module README](../../../functions/vesselOrchestrator/README.md) — overview and O1 stage list
- [vesselTrips functions README](../../../functions/vesselTrips/README.md) — Convex `vesselTrips` entrypoints
