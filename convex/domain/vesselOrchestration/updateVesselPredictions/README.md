# updateVesselPredictions (orchestrator concern)

Prediction model–backed enrichment of the active trip, `vesselTripPredictions`
proposal rows, and same-update **`PredictedTripTimelineHandoff`** values for
**`updateTimeline`**. On the orchestrator path **`runOrchestratorPing`** calls
**`getVesselTripPredictionsForTripUpdate`**, which delegates to
**`getVesselTripPredictionsFromTripUpdate`** with **`loadPredictionModelParameters`**
bound to **`ActionCtx`**. That flow derives when to load parameters, loads weights
when needed, runs inference once on **`tripUpdate.activeVesselTrip`**, and returns
proposal rows plus timeline handoffs. Persistence stays outside this domain layer.

```text
VesselTripUpdate
  -> getVesselTripPredictionsFromTripUpdate(tripUpdate, { loadPredictionModelParameters })
  -> predictionRows + predictedTripTimelineHandoffs
```

Completion ticks predict the replacement active trip once. The same enriched
trip is reused for both the `completed` and `current` timeline handoffs, while
**`predictionRows`** are generated once from that enriched trip.

## Stage 4 control flow

| Step | Module / function | Main input | Main output | Synopsis |
| --- | --- | --- | --- | --- |
| 1 | `actions/ping/runOrchestratorPing.ts` Stage 4 | Non-null `VesselTripUpdate` | `predictionRows`, `predictedTripTimelineHandoffs` | Calls **`getVesselTripPredictionsForTripUpdate`**, which wires **`loadPredictionModelParameters`** to **`ActionCtx`**. |
| 2 | `getPredictionModelParametersFromTripUpdate` | `VesselTripUpdate` | `PredictionModelParametersRequest \| null` | Uses **`getPredictionModelTypesFromTrip`** on **`activeVesselTrip`**, verifies terminal abbrevs, builds the terminal-pair key for **`getPredictionModelParameters`**. |
| 3 | `getPredictionModelTypesFromTrip` / `getPredictionSpecsFromTrip` (`tripDockStatePredictionSpecs.ts`) | Candidate trip | `ModelType[]` / `PredictionSpec[]` | Routes by **`AtDock`**: at-dock vs at-sea entries in **`PREDICTION_SPECS`**. |
| 4 | `loadPredictionModelParameters` (`actions/ping/updateVesselPredictions/load.ts`) | `ActionCtx`, request | **`PredictionModelParametersByPairKey`** | Runs **`getPredictionModelParameters`** when the domain supplies a non-null request. |
| 5 | `getPredictionModelParameters` (`functions/predictions/queries.ts`) | `{ pairKey, modelTypes }` | `{ [pairKey]: { [modelType]: model \| null } }` | Reads the active production version tag and returns inference-ready parameters. |
| 6 | `getVesselTripPredictionsFromTripUpdate` (`getVesselTripPredictionsFromTripUpdate.ts`) | `tripUpdate`, deps | **`VesselTripPredictionsFromTripUpdateResult`** | Loads parameters when needed, applies **`applyVesselPredictionsFromLoadedModels`**, builds handoffs and proposal rows. |
| 7 | `applyVesselPredictionsFromLoadedModels` (`applyVesselPredictions.ts`) | Loaded models, trip | `ConvexVesselTripWithML` | Phase-valid specs, **`appendPredictionsFromLoadedModels`**, then leave-dock actualization. |
| 8 | `appendPredictionsFromLoadedModels` (`appendPredictions.ts`) | Preloaded models, trip, specs | `ConvexVesselTripWithML` | Runs **`predictFromSpec`** for each spec using preloaded docs. |
| 9 | `predictFromSpec` (`domain/ml/prediction/vesselTripPredictions.ts`) | Trip, spec, optional model doc | `ConvexPrediction \| null` | Feature extraction, linear model, timestamps for prediction fields. |
| 10 | `buildCompletedTripTimelineHandoff` / `buildCurrentTripTimelineHandoff` (`getVesselTripPredictionsFromTripUpdate.ts`) | Enriched trip, optional completed leg | **`PredictedTripTimelineHandoff[]`** | One current handoff, or completed + current when both legs exist on **`tripUpdate`**. |
| 11 | `vesselTripPredictionProposalsFromMlTrip` | Enriched trip | **`VesselTripPredictionProposal[]`** | One proposal per populated prediction field. |

## Canonical code

- **Entry:** [`./getVesselTripPredictionsFromTripUpdate.ts`](./getVesselTripPredictionsFromTripUpdate.ts)
- **Orchestrator wiring:** [`../../../functions/vesselOrchestrator/actions/ping/updateVesselPredictions/getVesselTripPredictionsForTripUpdate.ts`](../../../functions/vesselOrchestrator/actions/ping/updateVesselPredictions/getVesselTripPredictionsForTripUpdate.ts)
- **Parameter request:** [`./getPredictionModelParametersFromTripUpdate.ts`](./getPredictionModelParametersFromTripUpdate.ts)
- **Dock vs underway spec routing:** [`./tripDockStatePredictionSpecs.ts`](./tripDockStatePredictionSpecs.ts)
- **Loaded-model apply:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts), [`./appendPredictions.ts`](./appendPredictions.ts)
- **Strip for DB:** [`../shared/orchestratorPersist/stripTripPredictionsForStorage.ts`](../shared/orchestratorPersist/stripTripPredictionsForStorage.ts)

## Handoff types

- **`ConvexVesselTrip`** (schedule + lifecycle from **`updateVesselTrip`**) —
  trip immediately before prediction enrichment in **`applyVesselPredictionsFromLoadedModels`**.
- **`PredictedTripTimelineHandoff`** — defined in
  [`../updateTimeline/handoffTypes.ts`](../updateTimeline/handoffTypes.ts);
  per-branch enriched trip for **`updateTimeline`**.

## Persistence vs timeline merge

- **Persist:** mutations use **`stripTripPredictionsForStorage`** on proposed
  trips where applicable.
- **Timeline:** uses the full enriched trip from handoffs so predicted events
  match the same row used for **`predictionRows`**.

## Imports

Public API: [`index.ts`](./index.ts). Other modules in this folder are internal;
colocated tests may import implementation files directly.
