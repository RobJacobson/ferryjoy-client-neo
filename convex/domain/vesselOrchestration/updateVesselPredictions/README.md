# updateVesselPredictions (orchestrator concern)

ML attachment for vessel trips: at-dock predictions, at-sea predictions, and
leave-dock actualization for one ping. On the **orchestrator** path **`updateVesselOrchestrator`** calls **`updateVesselPredictions`** in the action per-vessel loop with input **`{ tripUpdate, predictionContext }`** (**`tripUpdate`** comes from **`updateVesselTrip`**). Persistence stays outside this domain function and runs through stage-level helpers in the pipeline (trip writes first, then prediction writes, then timeline writes).

## Canonical code

- **Implementation:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts) — `applyVesselPredictions`, handoff type `VesselTripCoreProposal`.
- **Phase selection:** [`./predictionPolicy.ts`](./predictionPolicy.ts) — simple helpers that decide which prediction family applies to the current trip phase.
- **Prediction specs / `computePredictions`:** [`./appendPredictions.ts`](./appendPredictions.ts) — do not duplicate.
- **Strip for DB:** [`../shared/orchestratorPersist/stripTripPredictionsForStorage.ts`](../shared/orchestratorPersist/stripTripPredictionsForStorage.ts) — used from lifecycle mutations where persistence must omit ML blobs.

## Handoff types

- **`VesselTripCoreProposal`** — Trip **immediately before this ping’s**
  `appendArriveDock` / `appendLeaveDock` phases. The row may still carry **prior**
  ML or joined minimal fields from storage; the boundary is not a stripped row.
- **`MlTimelineOverlay`** — defined in [`../shared/pingHandshake/types.ts`](../shared/pingHandshake/types.ts); same-ping ML merge input for timeline (alongside prediction table rows).

## Persistence vs overlay

- **Persist:** mutations use `stripTripPredictionsForStorage` on proposed trips
  where applicable (`processCurrentTrips`, `processCompletedTrips`).
- **Overlay / timeline:** comparisons use the **full** proposed trip (including
  ML) so timeline messaging sees enriched fields — do not strip before overlay
  diff.

## Imports

Public API: [`index.ts`](./index.ts) — **`updateVesselPredictions`**, **`predictionInputsFromTripUpdate`**, **`predictionModelLoadRequestsForTripUpdate`**, contract types, and **`predictionModelTypesForTrip`** (phase routing). Other modules in this folder are internal; colocated tests import them via relative paths. Timeline assembly lives under [`../updateTimeline`](../updateTimeline).

Primary runner implementation now lives in
[`updateVesselPredictions.ts`](./updateVesselPredictions.ts).
