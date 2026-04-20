/**
 * **updateVesselPredictions** (domain): ML attachment for one vessel-trip tick.
 *
 * Callers should invoke this with schedule/lifecycle trip rows from
 * **`buildTripCore`** (`withFinalSchedule`). Canonical prediction logic lives in
 * {@link ./appendPredictions}; this module sequences at-dock → at-sea →
 * leave-dock actualization only.
 */

import { actualizePredictionsOnLeaveDock } from "domain/ml/prediction";
import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type {
  ConvexVesselTrip,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";
import {
  appendArriveDockPredictions,
  appendLeaveDockPredictions,
} from "./appendPredictions";
import {
  shouldRunAtDockPredictions,
  shouldRunAtSeaPredictions,
} from "./predictionPolicy";

/**
 * Trip state immediately before this tick’s `appendArriveDockPredictions` /
 * `appendLeaveDockPredictions` (and leave-dock actualize): schedule + lifecycle
 * fields from **updateVesselTrips** (`buildTripCore`), storage-shaped only.
 */
export type VesselTripCoreProposal = ConvexVesselTrip;

/**
 * Append at-dock / at-sea predictions and actualize on leave-dock.
 *
 * Order is fixed: at-dock attempts → at-sea attempts → leave-dock
 * actualization. Predictions re-run every tick whenever the trip is in the
 * matching physical phase; unchanged results are deduped at persistence time.
 *
 * @param modelAccess - Production ML model reads for this tick
 * @param coreTrip - Schedule-enriched proposal (see {@link VesselTripCoreProposal})
 * @returns Trip with ML fields applied for this tick
 */
export const applyVesselPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  coreTrip: VesselTripCoreProposal
): Promise<ConvexVesselTripWithML> => {
  const withAtDockPredictions = shouldRunAtDockPredictions(coreTrip)
    ? await appendArriveDockPredictions(modelAccess, coreTrip)
    : coreTrip;
  const withAtSeaPredictions = shouldRunAtSeaPredictions(withAtDockPredictions)
    ? await appendLeaveDockPredictions(modelAccess, withAtDockPredictions)
    : withAtDockPredictions;

  return actualizePredictionsOnLeaveDock(withAtSeaPredictions);
};
