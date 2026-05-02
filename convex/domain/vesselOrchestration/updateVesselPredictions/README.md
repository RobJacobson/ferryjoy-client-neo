# updateVesselPredictions (orchestrator concern)

ML attachment for vessel trips: at-dock predictions, at-sea predictions, and
leave-dock actualization for one ping. On the **orchestrator** path
**`runOrchestratorPing`** derives a **`predictionPreloadFromVesselTripUpdate`**
from **`VesselTripUpdate`**, preloads production models when that request is
non-null, then calls **`updateVesselPredictions`** with
**`{ tripUpdate, predictionContext }`**. Persistence stays outside this domain
function and runs through the orchestrator aggregate mutation.

```text
VesselTripUpdate
  -> predictionPreloadFromVesselTripUpdate
  -> loadPredictionContext(modelLoadRequest)
  -> updateVesselPredictions({ tripUpdate, predictionContext })
  -> predictionRows + mlTimelineOverlays
```

Completion pings predict the replacement active trip once. The same enriched
trip is reused for both the `completed` timeline overlay and the `current`
timeline overlay, while `predictionRows` are generated once from that enriched
trip.

## Stage 4 control flow

| Step | Module / function | Main input | Main output | Synopsis |
| --- | --- | --- | --- | --- |
| 1 | `actions/ping/runOrchestratorPing.ts` Stage 4 block | Non-null `VesselTripUpdate` from `updateVesselTrip` | `predictionRows`, `mlTimelineOverlays` | Orchestrates the prediction stage: derive preload request, load model context, compute prediction proposals and same-ping timeline overlays. |
| 2 | `predictionPreloadFromVesselTripUpdate` (`predictionContextRequests.ts`) | `VesselTripUpdate` | `PredictionPreloadRequest \| null` | Uses `modelTypesForTripPhase` on `activeVesselTrip`, verifies terminal abbrevs, builds the terminal-pair key for the production model query. |
| 3 | `modelTypesForTripPhase` / `predictionSpecsForTripPhase` (`predictionPolicy.ts`) | Candidate trip | `ModelType[]` / `PredictionSpec[]` | Routes by physical phase: at-dock trips use at-dock specs, at-sea trips use at-sea specs. Model types are derived from `PREDICTION_SPECS`. |
| 4 | `loadPredictionContext` (`actions/ping/updateVesselPredictions/load.ts`) | `ActionCtx`, `PredictionPreloadRequest \| null \| undefined` | `VesselPredictionContext` | Skips the Convex query when no request exists; otherwise calls `getProductionModelParametersForPing` and returns production model parameters keyed by pair and model type. |
| 5 | `getProductionModelParametersForPing` (`functions/predictions/queries.ts`) | `{ pairKey, modelTypes }` | `{ [pairKey]: { [modelType]: model \| null } }` | Reads the active production version tag, dedupes requested model types, loads matching `modelParameters`, and returns plain inference-ready model parameters. |
| 6 | `updateVesselPredictions` (`updateVesselPredictions.ts`) | `{ tripUpdate, predictionContext }` | `{ predictionRows, mlTimelineOverlays }` | Applies loaded-model predictions to `tripUpdate.activeVesselTrip` once, then emits timeline overlays and proposal rows from that enriched trip. |
| 7 | `applyVesselPredictionsFromLoadedModels` (`applyVesselPredictions.ts`) | Preloaded models, active/replacement trip | `ConvexVesselTripWithML` | Looks up phase-valid specs, applies predictions from already-loaded model docs, then actualizes `AtDockDepartCurr` if a leave-dock actual is present. |
| 8 | `appendPredictionsFromLoadedModels` (`appendPredictions.ts`) | Preloaded models, trip, specs | `ConvexVesselTripWithML` | Checks prediction readiness, resolves model docs from the preloaded map, runs each spec, and overlays successful prediction fields on the trip. |
| 9 | `predictFromSpec` (`domain/ml/prediction/vesselTripPredictions.ts`) | Trip, `PredictionSpec`, optional preloaded model | `ConvexPrediction \| null` | Validates required fields and anchors, runs the linear model when a model doc exists, converts predicted minutes to an absolute timestamp, clamps scheduled minimums, and returns prediction bounds/metrics. |
| 10 | `predictTripValueWithModel` (`domain/ml/prediction/predictTrip.ts`) | Trip, model type, production model parameters | `{ predictedValue, mae, stdDev }` | Converts the trip to the ML training-window shape, extracts features, applies the linear coefficients/intercept, and rounds the prediction and uncertainty metrics. |
| 11 | `buildCompletedOverlay` / `buildCurrentOverlay` (`updateVesselPredictions.ts`) | Final ML-enriched trip, optional completed handoff | `MlTimelineOverlay[]` | Emits one `current` overlay for active-only pings, or both `completed` and `current` overlays for completion pings, reusing the same predicted trip object. |
| 12 | `vesselTripPredictionProposalsFromMlTrip` (`vesselTripPredictionProposalsFromMlTrip.ts`) | Final ML-enriched trip | `VesselTripPredictionProposal[]` | Emits one `vesselTripPredictions` proposal per full ML prediction field present on the trip; joined/minimal prediction shapes are ignored. |

## Canonical code

- **Implementation:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts) — `applyVesselPredictions`, handoff type `VesselTripCoreProposal`.
- **Preload request:** [`./predictionContextRequests.ts`](./predictionContextRequests.ts) —
  `predictionPreloadFromVesselTripUpdate` and `PredictionPreloadRequest`.
- **Phase selection:** [`./predictionPolicy.ts`](./predictionPolicy.ts) —
  simple helpers that decide which prediction specs apply to the current trip
  phase. Model types are derived from `PREDICTION_SPECS`.
- **Prediction specs / compute:** [`./appendPredictions.ts`](./appendPredictions.ts) — do not duplicate.
- **Strip for DB:** [`../shared/orchestratorPersist/stripTripPredictionsForStorage.ts`](../shared/orchestratorPersist/stripTripPredictionsForStorage.ts) — used from lifecycle mutations where persistence must omit ML blobs.

## Handoff types

- **`VesselTripCoreProposal`** — Trip **immediately before this ping’s**
  `appendAtDockPredictions` / `appendAtSeaPredictions` phases. The row may
  still carry **prior** ML or joined minimal fields from storage; the boundary
  is not a stripped row.
- **`MlTimelineOverlay`** — defined in
  [`../updateTimeline/handoffTypes.ts`](../updateTimeline/handoffTypes.ts);
  same-ping ML merge input for timeline alongside prediction table rows.

## Persistence vs overlay

- **Persist:** mutations use `stripTripPredictionsForStorage` on proposed trips
  where applicable (`processCurrentTrips`, `processCompletedTrips`).
- **Overlay / timeline:** comparisons use the **full** proposed trip (including
  ML) so timeline messaging sees enriched fields — do not strip before overlay
  diff.

## Imports

Public API: [`index.ts`](./index.ts) — **`updateVesselPredictions`**,
**`predictionPreloadFromVesselTripUpdate`**, contract types, and phase
routing helpers. Other modules in this folder are internal; colocated tests
import them via relative paths. Timeline assembly lives under
[`../updateTimeline`](../updateTimeline).

Primary runner implementation now lives in
[`updateVesselPredictions.ts`](./updateVesselPredictions.ts).
