# updateVesselPredictions (orchestrator concern)

ML attachment for vessel trips: at-dock predictions, at-sea predictions, and
leave-dock actualization for one ping. On the **orchestrator** path
**`runOrchestratorPing`** builds one **`PredictionStagePlan`** from the upstream
**`VesselTripUpdate`**, preloads production models from that plan's
**`modelLoadRequest`**, then calls **`updateVesselPredictions`** with
**`{ predictionStagePlan, predictionContext }`**. Persistence stays outside this
domain function and runs through the orchestrator aggregate mutation.

The Stage 4 shape is intentionally flat:

```text
VesselTripUpdate
  -> buildPredictionStagePlan
  -> loadPredictionContext(modelLoadRequest)
  -> updateVesselPredictions({ predictionStagePlan, predictionContext })
  -> predictionRows + mlTimelineOverlays
```

Completion pings predict the replacement active trip once. The same enriched
trip is reused for both the `completed` timeline overlay and the `current`
timeline overlay, while `predictionRows` are generated once from that enriched
trip.

## Stage 4 control flow

| Step | Module / function | Main input | Main output | Synopsis |
| --- | --- | --- | --- | --- |
| 1 | `actions/ping/runOrchestratorPing.ts` Stage 4 block | Non-null `VesselTripUpdate` from `updateVesselTrip` | `predictionRows`, `mlTimelineOverlays` | Orchestrates the prediction stage: build the stage plan, load model context, compute prediction proposals and same-ping timeline overlays. |
| 2 | `buildPredictionStagePlan` (`predictionStagePlan.ts`) | `VesselTripUpdate` | `PredictionStagePlan` | Derives the active trip, optional completed-arrival handoff, and optional model preload request once from the trip update. |
| 3 | `buildModelLoadRequestForTrip` (`predictionStagePlan.ts`) | Candidate trip (`completedHandoff.activeVesselTrip` or active trip) | `PredictionModelLoadRequest \| null` | Selects the phase-valid model types, verifies the terminal pair is present, and builds the terminal-pair key used by the production model query. |
| 4 | `predictionModelTypesForTrip` / `predictionSpecsForTrip` (`predictionPolicy.ts`) | Candidate trip | `ModelType[]` / `PredictionSpec[]` | Routes by physical phase: at-dock trips use at-dock specs, at-sea trips use at-sea specs. Model types are derived from `PREDICTION_SPECS`. |
| 5 | `loadPredictionContext` (`actions/ping/updateVesselPredictions/load.ts`) | `ActionCtx`, `PredictionModelLoadRequest \| null \| undefined` | `VesselPredictionContext` | Skips the Convex query when no request exists; otherwise calls `getProductionModelParametersForPing` and returns production model parameters keyed by pair and model type. |
| 6 | `getProductionModelParametersForPing` (`functions/predictions/queries.ts`) | `{ pairKey, modelTypes }` | `{ [pairKey]: { [modelType]: model \| null } }` | Reads the active production version tag, dedupes requested model types, loads matching `modelParameters`, and returns plain inference-ready model parameters. |
| 7 | `updateVesselPredictions` (`updateVesselPredictions.ts`) | `{ predictionStagePlan, predictionContext }` | `{ predictionRows, mlTimelineOverlays }` | Applies loaded-model predictions to the active/replacement trip once, then emits timeline overlays and proposal rows from that enriched trip. |
| 8 | `applyVesselPredictionsFromLoadedModels` (`applyVesselPredictions.ts`) | Preloaded models, active/replacement trip | `ConvexVesselTripWithML` | Looks up phase-valid specs, applies predictions from already-loaded model docs, then actualizes `AtDockDepartCurr` if a leave-dock actual is present. |
| 9 | `appendPredictionsFromLoadedModels` (`appendPredictions.ts`) | Preloaded models, trip, specs | `ConvexVesselTripWithML` | Checks prediction readiness, resolves model docs from the preloaded map, runs each spec, and overlays successful prediction fields on the trip. |
| 10 | `predictFromSpec` (`domain/ml/prediction/vesselTripPredictions.ts`) | Trip, `PredictionSpec`, optional preloaded model | `ConvexPrediction \| null` | Validates required fields and anchors, runs the linear model when a model doc exists, converts predicted minutes to an absolute timestamp, clamps scheduled minimums, and returns prediction bounds/metrics. |
| 11 | `predictTripValueWithModel` (`domain/ml/prediction/predictTrip.ts`) | Trip, model type, production model parameters | `{ predictedValue, mae, stdDev }` | Converts the trip to the ML training-window shape, extracts features, applies the linear coefficients/intercept, and rounds the prediction and uncertainty metrics. |
| 12 | `buildCompletedOverlay` / `buildCurrentOverlay` (`updateVesselPredictions.ts`) | Final ML-enriched trip, optional completed handoff | `MlTimelineOverlay[]` | Emits one `current` overlay for active-only pings, or both `completed` and `current` overlays for completion pings, reusing the same predicted trip object. |
| 13 | `vesselTripPredictionProposalsFromMlTrip` (`vesselTripPredictionProposalsFromMlTrip.ts`) | Final ML-enriched trip | `VesselTripPredictionProposal[]` | Emits one `vesselTripPredictions` proposal per full ML prediction field present on the trip; joined/minimal prediction shapes are ignored. |

## Canonical code

- **Implementation:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts) — `applyVesselPredictions`, handoff type `VesselTripCoreProposal`.
- **Stage plan:** [`./predictionStagePlan.ts`](./predictionStagePlan.ts) —
  `VesselTripUpdate` → active trip, optional completed handoff, and optional
  production model preload request.
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

Public API: [`index.ts`](./index.ts) — **`buildPredictionStagePlan`**,
**`updateVesselPredictions`**, compatibility helpers
**`predictionInputsFromTripUpdate`** /
**`predictionModelLoadRequestForTripUpdate`**, contract types, and phase
routing helpers. Other modules in this folder are internal; colocated tests
import them via relative paths. Timeline assembly lives under
[`../updateTimeline`](../updateTimeline).

Primary runner implementation now lives in
[`updateVesselPredictions.ts`](./updateVesselPredictions.ts).
