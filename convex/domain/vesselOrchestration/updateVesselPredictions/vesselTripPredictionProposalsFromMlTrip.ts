/**
 * Maps an ML-enriched vessel trip row into `vesselTripPredictions` proposal rows
 * (one per present prediction slot).
 */

import type { PredictionType } from "functions/predictions/schemas";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";
import type {
  ConvexJoinedTripPrediction,
  ConvexPrediction,
  ConvexVesselTripWithML,
} from "functions/vesselTrips/schemas";

const PREDICTION_FIELD_NAMES = [
  "AtDockDepartCurr",
  "AtDockArriveNext",
  "AtDockDepartNext",
  "AtSeaArriveNext",
  "AtSeaDepartNext",
] as const satisfies readonly PredictionType[];

/**
 * Builds proposal payloads for each non-absent ML field on the trip. Skips
 * undefined slots so `batchUpsertProposals` only receives real predictions.
 *
 * @param trip - Post-`applyVesselPredictions` trip (`TripKey` required)
 * @returns Zero or more proposals for this vessel/trip natural keys
 */
export const vesselTripPredictionProposalsFromMlTrip = (
  trip: ConvexVesselTripWithML
): VesselTripPredictionProposal[] => {
  const proposals: VesselTripPredictionProposal[] = [];

  for (const field of PREDICTION_FIELD_NAMES) {
    const raw = trip[field];
    if (!isFullPrediction(raw)) {
      continue;
    }
    proposals.push({
      VesselAbbrev: trip.VesselAbbrev,
      TripKey: trip.TripKey,
      PredictionType: field,
      prediction: raw,
    });
  }

  return proposals;
};

const isFullPrediction = (
  value: ConvexPrediction | ConvexJoinedTripPrediction | undefined
): value is ConvexPrediction =>
  value !== undefined &&
  "MinTime" in value &&
  "MaxTime" in value &&
  "MAE" in value &&
  "StdDev" in value;
