/**
 * **updateVesselPredictions** (domain): ML attachment for one vessel-trip ping.
 *
 * Callers should invoke this with schedule/lifecycle trip rows from
 * **`updateVesselTrip`** (schedule-enriched `ConvexVesselTrip`). Canonical
 * prediction logic lives in {@link ./appendPredictions}; this module routes by
 * physical phase (`AtDock` vs `AtSea`) and then applies leave-dock
 * actualization.
 */

import { actualizePredictionsOnLeaveDock } from "domain/ml/prediction";
import type {
  ProductionModelParameters,
  VesselTripPredictionModelAccess,
} from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ModelType } from "domain/ml/shared/types";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  appendAtDockPredictions,
  appendAtSeaPredictions,
  appendPredictionsFromLoadedModels,
} from "./appendPredictions";
import {
  isAtDockPhase,
  isAtSeaPhase,
  predictionSpecsForTrip,
} from "./predictionPolicy";

/**
 * Trip state immediately before this ping’s `appendAtDockPredictions` /
 * `appendAtSeaPredictions` (and leave-dock actualize): schedule + lifecycle
 * fields from **updateVesselTrip**, storage-shaped only.
 */
export type VesselTripCoreProposal = ConvexVesselTrip;

/**
 * Append at-dock / at-sea predictions and actualize on leave-dock.
 *
 * Order is fixed: at-dock attempts → at-sea attempts → leave-dock
 * actualization. Predictions re-run every ping whenever the trip is in the
 * matching physical phase; unchanged results are deduped at persistence time.
 *
 * @param modelAccess - Production ML model reads for this ping
 * @param coreTrip - Schedule-enriched proposal (see {@link VesselTripCoreProposal})
 * @returns Trip with ML fields applied for this ping
 */
export const applyVesselPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  coreTrip: VesselTripCoreProposal
): Promise<ConvexVesselTripWithML> => {
  const withAtDockPredictions = isAtDockPhase(coreTrip)
    ? await appendAtDockPredictions(modelAccess, coreTrip)
    : coreTrip;
  const withAtSeaPredictions = isAtSeaPhase(withAtDockPredictions)
    ? await appendAtSeaPredictions(modelAccess, withAtDockPredictions)
    : withAtDockPredictions;

  return actualizePredictionsOnLeaveDock(withAtSeaPredictions);
};

export const applyVesselPredictionsFromLoadedModels = async (
  productionModelsByPair:
    | Readonly<
        Record<
          string,
          Partial<Record<ModelType, ProductionModelParameters | null>>
        >
      >
    | undefined,
  coreTrip: VesselTripCoreProposal
): Promise<ConvexVesselTripWithML> => {
  const specs = predictionSpecsForTrip(coreTrip);
  const withPredictions =
    specs.length === 0
      ? coreTrip
      : await appendPredictionsFromLoadedModels(
          productionModelsByPair,
          coreTrip,
          specs
        );

  return actualizePredictionsOnLeaveDock(withPredictions);
};
