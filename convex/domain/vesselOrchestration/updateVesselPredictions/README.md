# updateVesselPredictions (orchestrator concern)

ML attachment for vessel trips: at-dock predictions, at-sea predictions, and
leave-dock actualization for one tick. On the **orchestrator** path this runs in
**Stage D** after trip persistence, over the trip rows produced by
`updateVesselTrips` (not inside `buildTripCore`).

## Canonical code

- **Implementation:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts) — `applyVesselPredictions`, handoff type `VesselTripCoreProposal`.
- **Phase selection:** [`./predictionPolicy.ts`](./predictionPolicy.ts) — simple helpers that decide which prediction family applies to the current trip phase.
- **Composer (tests / non-orchestrator):** [`../updateVesselTrips/tripLifecycle/buildTrip.ts`](../updateVesselTrips/tripLifecycle/buildTrip.ts) — `buildTrip` calls `buildTripCore` and then applies predictions using the same phase helpers as Stage D.
- **Prediction specs / `computePredictions`:** [`./appendPredictions.ts`](./appendPredictions.ts) — do not duplicate.
- **Strip for DB:** [`./stripTripPredictionsForStorage.ts`](./stripTripPredictionsForStorage.ts) — used from lifecycle mutations where persistence must omit ML blobs.

## Handoff types

- **`VesselTripCoreProposal`** — Trip **immediately before this tick’s**
  `appendArriveDock` / `appendLeaveDock` phases. The row may still carry **prior**
  ML or joined minimal fields from storage; the boundary is not a stripped row.
- **`PredictedTripComputation`** — transitional downstream handoff containing the
  source branch (`current` or `completed`) and the final ML-enriched trip row.
  The name is legacy and may be retired in a later cleanup.

## Persistence vs overlay

- **Persist:** mutations use `stripTripPredictionsForStorage` on proposed trips
  where applicable (`processCurrentTrips`, `processCompletedTrips`).
- **Overlay / timeline:** comparisons use the **full** proposed trip (including
  ML) so timeline messaging sees enriched fields — do not strip before overlay
  diff.

## Imports

Re-export from this folder’s [`index.ts`](./index.ts). The same symbols are
re-exported from
[`../updateVesselTrips/index.ts`](../updateVesselTrips/index.ts) alongside
**updateTimeline** for discoverability. Timeline assembly lives under
[`../updateTimeline`](../updateTimeline).
