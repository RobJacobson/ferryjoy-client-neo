# updateVesselPredictions (orchestrator concern)

Prediction model-backed enrichment of the active trip and
`vesselTripPredictions` proposal rows. On the orchestrator path
**`runOrchestratorPing`** calls
**`getVesselTripPredictionsForTripUpdate`**, which delegates to
**`getVesselTripPredictionsFromTripUpdate`** with **`loadPredictionModelParameters`**
bound to **`ActionCtx`**. That flow derives when to load parameters, loads weights
when needed, runs inference once on **`tripUpdate.activeVesselTrip`**, and returns
proposal rows plus the enriched active trip. Persistence and timeline handoff
construction stay outside this domain layer.

```text
VesselTripUpdate
  -> getVesselTripPredictionsFromTripUpdate(tripUpdate, { loadPredictionModelParameters })
  -> enrichedActiveVesselTrip + predictionRows
```

Completion ticks predict the replacement active trip once. **`updateTimeline`**
reuses that same enriched trip for completed/current overlay projection, while
**`predictionRows`** are generated once here from the enriched trip.

## Stage 4 control flow

| Step | Module / function | Main input | Main output | Synopsis |
| --- | --- | --- | --- | --- |
| 1 | `actions/ping/runOrchestratorPing.ts` Stage 4 | Non-null `VesselTripUpdate` | `enrichedActiveVesselTrip`, `predictionRows` | Calls **`getVesselTripPredictionsForTripUpdate`**, which wires **`loadPredictionModelParameters`** to **`ActionCtx`**. |
| 2 | `getPredictionModelParametersFromTripUpdate` | `VesselTripUpdate` | `PredictionModelParametersRequest \| null` | Uses runnable specs on **`activeVesselTrip`**, verifies terminal abbrevs, builds the terminal-pair key for **`getPredictionModelParameters`**. |
| 3 | `getRunnablePredictionSpecsFromTrip` / `getPredictionSpecsFromTrip` (`tripDockStatePredictionSpecs.ts`) | Candidate trip | `PredictionSpec[]` | Routes by **`AtDock`** and applies readiness, departure-actual, and anchor-time gates. |
| 4 | `loadPredictionModelParameters` (`actions/ping/updateVesselPredictions/load.ts`) | `ActionCtx`, request | **`PredictionModelParametersByPairKey`** | Runs **`getPredictionModelParameters`** when the domain supplies a non-null request. |
| 5 | `getPredictionModelParameters` (`functions/predictions/queries.ts`) | `{ pairKey, modelTypes }` | `{ [pairKey]: { [modelType]: model \| null } }` | Reads the active production version tag and returns inference-ready parameters. |
| 6 | `getVesselTripPredictionsFromTripUpdate` (`getVesselTripPredictionsFromTripUpdate.ts`) | `tripUpdate`, deps | **`VesselTripPredictionsFromTripUpdateResult`** | Best-effort loads parameters, applies **`applyVesselPredictionsFromLoadedModels`**, builds proposal rows. |
| 7 | `applyVesselPredictionsFromLoadedModels` (`applyVesselPredictions.ts`) | Loaded models, trip | `ConvexVesselTripWithML` | Phase-valid specs, **`appendPredictionsFromLoadedModels`**, then leave-dock actualization. |
| 8 | `appendPredictionsFromLoadedModels` (`appendPredictions.ts`) | Preloaded models, trip, specs | `ConvexVesselTripWithML` | Runs **`predictFromSpec`** for each spec using preloaded docs. |
| 9 | `predictFromSpec` (`domain/ml/prediction/vesselTripPredictions.ts`) | Trip, spec, optional model doc | `ConvexPrediction \| null` | Feature extraction, linear model, timestamps for prediction fields. |
| 10 | `vesselTripPredictionProposalsFromMlTrip` | Enriched trip | **`VesselTripPredictionProposal[]`** | One proposal per populated prediction field. |

## Canonical code

- **Entry:** [`./getVesselTripPredictionsFromTripUpdate.ts`](./getVesselTripPredictionsFromTripUpdate.ts)
- **Orchestrator wiring:** [`../../../functions/vesselOrchestrator/actions/ping/updateVesselPredictions/getVesselTripPredictionsForTripUpdate.ts`](../../../functions/vesselOrchestrator/actions/ping/updateVesselPredictions/getVesselTripPredictionsForTripUpdate.ts)
- **Parameter request:** [`./getPredictionModelParametersFromTripUpdate.ts`](./getPredictionModelParametersFromTripUpdate.ts)
- **Runnable spec routing:** [`./tripDockStatePredictionSpecs.ts`](./tripDockStatePredictionSpecs.ts)
- **Loaded-model apply:** [`./applyVesselPredictions.ts`](./applyVesselPredictions.ts), [`./appendPredictions.ts`](./appendPredictions.ts)
- **Strip for DB:** [`../updateVesselTrip/pipeline/stripTripPredictionsForStorage.ts`](../updateVesselTrip/pipeline/stripTripPredictionsForStorage.ts)

## Handoff types

- **`ConvexVesselTrip`** (schedule + lifecycle from **`updateVesselTrip`**) —
  trip immediately before prediction enrichment in **`applyVesselPredictionsFromLoadedModels`**.
- **`ConvexVesselTripWithML`** — enriched active trip returned to the orchestrator
  and passed into **`updateTimeline`**.

## Persistence vs timeline merge

- **Persist:** mutations use **`stripTripPredictionsForStorage`** on proposed
  trips where applicable.
- **Timeline:** uses the full enriched trip from Stage 4 so predicted events
  match the same row used for **`predictionRows`**.

## Imports

Public API: [`index.ts`](./index.ts). Other modules in this folder are internal;
colocated tests may import implementation files directly.
