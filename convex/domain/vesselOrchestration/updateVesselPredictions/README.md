# updateVesselPredictions (orchestrator concern)

ML attachment for vessel trips: at-dock predictions, at-sea predictions, and
leave-dock actualization for one tick. Sequenced **after** schedule enrichment
(`appendFinalSchedule` when gated) inside the trip builder.

## Canonical code

- **Implementation:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts) — `applyVesselPredictions`, handoff types `VesselTripCoreProposal`, `VesselPredictionGates`.
- **Lifecycle + gates:** [`../updateVesselTrips/tripLifecycle/buildTrip.ts`](../updateVesselTrips/tripLifecycle/buildTrip.ts) — `buildTrip` calls `buildTripCore` (schedule + derived state, gate computation) then `applyVesselPredictions`.
- **Prediction specs / `computePredictions`:** [`./appendPredictions.ts`](./appendPredictions.ts) — do not duplicate.
- **Strip for DB:** [`./stripTripPredictionsForStorage.ts`](./stripTripPredictionsForStorage.ts) — used from lifecycle mutations where persistence must omit ML blobs.

## Handoff types

- **`VesselTripCoreProposal`** — Trip **immediately before this tick’s**
  `appendArriveDock` / `appendLeaveDock` phases. The row may still carry **prior**
  ML or joined minimal fields from storage; the boundary is not a stripped row.
- **`VesselPredictionGates`** — `shouldAttemptAtDockPredictions`,
  `shouldAttemptAtSeaPredictions`, and `didJustLeaveDock` (from `TripEvents`,
  threaded through — not recomputed in `applyVesselPredictions`).

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
