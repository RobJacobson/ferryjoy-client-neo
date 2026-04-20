/**
 * **updateVesselPredictions** (domain): ML attachment for one vessel-trip tick.
 *
 * Callers should invoke this with schedule/lifecycle trip rows from
 * **`buildTripCore`** (`withFinalSchedule`). **`VesselPredictionGates`** come from
 * {@link ./predictionPolicy.derivePredictionGatesForComputation} on the orchestrator
 * path (not from `buildTripCore`). Canonical prediction logic lives in
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

/**
 * Trip state immediately before this tick’s `appendArriveDockPredictions` /
 * `appendLeaveDockPredictions` (and leave-dock actualize): schedule + lifecycle
 * fields from **updateVesselTrips** (`buildTripCore`), storage-shaped only.
 */
export type VesselTripCoreProposal = ConvexVesselTrip;

/**
 * Boolean guards for ML phases from {@link ./predictionPolicy.derivePredictionGatesForComputation}
 * (or {@link ./predictionPolicy.computeVesselPredictionGates} in the `buildTrip` composer).
 * `didJustLeaveDock` is threaded from `TripEvents.didJustLeaveDock` and must not be recomputed here.
 */
export type VesselPredictionGates = {
  readonly shouldAttemptAtDockPredictions: boolean;
  readonly shouldAttemptAtSeaPredictions: boolean;
  readonly didJustLeaveDock: boolean;
};

/**
 * Append at-dock / at-sea predictions and actualize on leave-dock when gated.
 *
 * Order is fixed: at-dock attempts → at-sea attempts → leave-dock
 * actualization. Matches the former inline tail of `buildTrip`.
 *
 * @param modelAccess - Production ML model reads for this tick
 * @param coreTrip - Schedule-enriched proposal (see {@link VesselTripCoreProposal})
 * @param gates - Precomputed flags from prediction policy (phase + attempt mode)
 * @returns Trip with ML fields applied for this tick
 */
export const applyVesselPredictions = async (
  modelAccess: VesselTripPredictionModelAccess,
  coreTrip: VesselTripCoreProposal,
  gates: VesselPredictionGates
): Promise<ConvexVesselTripWithML> => {
  const withAtDockPredictions = gates.shouldAttemptAtDockPredictions
    ? await appendArriveDockPredictions(modelAccess, coreTrip)
    : coreTrip;
  const withAtSeaPredictions = gates.shouldAttemptAtSeaPredictions
    ? await appendLeaveDockPredictions(modelAccess, withAtDockPredictions)
    : withAtDockPredictions;

  return gates.didJustLeaveDock
    ? actualizePredictionsOnLeaveDock(withAtSeaPredictions)
    : withAtSeaPredictions;
};
