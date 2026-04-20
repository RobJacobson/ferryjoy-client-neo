# updateVesselPredictions (orchestrator concern)

ML attachment for vessel trips: at-dock predictions, at-sea predictions, and
leave-dock actualization for one ping. On the **orchestrator** path this runs in
**Stage D** after trip persistence, over the trip rows produced by
`updateVesselTrips` (not inside `buildTripCore`).

## Canonical code

- **Implementation:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts) — `applyVesselPredictions`, handoff type `VesselTripCoreProposal`.
- **Phase selection:** [`./predictionPolicy.ts`](./predictionPolicy.ts) — simple helpers that decide which prediction family applies to the current trip phase.
- **Composer (tests / non-orchestrator):** [`../updateVesselTrips/tripLifecycle/buildTrip.ts`](../updateVesselTrips/tripLifecycle/buildTrip.ts) — `buildTrip` calls `buildTripCore` and then applies predictions using the same phase helpers as Stage D.
- **Prediction specs / `computePredictions`:** [`./appendPredictions.ts`](./appendPredictions.ts) — do not duplicate.
- **Strip for DB:** [`../shared/orchestratorPersist/stripTripPredictionsForStorage.ts`](../shared/orchestratorPersist/stripTripPredictionsForStorage.ts) — used from lifecycle mutations where persistence must omit ML blobs.

## Handoff types

- **`VesselTripCoreProposal`** — Trip **immediately before this ping’s**
  `appendArriveDock` / `appendLeaveDock` phases. The row may still carry **prior**
  ML or joined minimal fields from storage; the boundary is not a stripped row.
- **`PredictedTripComputation`** — defined in [`../shared/pingHandshake/types.ts`](../shared/pingHandshake/types.ts); ML merge input for timeline (same ping as prediction rows).

## Persistence vs overlay

- **Persist:** mutations use `stripTripPredictionsForStorage` on proposed trips
  where applicable (`processCurrentTrips`, `processCompletedTrips`).
- **Overlay / timeline:** comparisons use the **full** proposed trip (including
  ML) so timeline messaging sees enriched fields — do not strip before overlay
  diff.

## Imports

Public API: [`index.ts`](./index.ts) — runners, contract types, and
`predictionModelTypesForTrip` for orchestrator preload. Other modules in this
folder are internal; colocated tests import them via relative paths. Timeline
assembly lives under [`../updateTimeline`](../updateTimeline).

Primary runner implementation now lives in
[`computeVesselPredictionRows.ts`](./computeVesselPredictionRows.ts).
