/**
 * Derives which prediction model parameters to load for a vessel trip update,
 * using the same at-dock vs at-sea routing as inference
 * (`getPredictionModelTypesFromTrip`).
 */

import { formatTerminalPairKey } from "domain/ml/shared/config";
import type { VesselTripUpdate } from "domain/vesselOrchestration/updateVesselTrip";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { getPredictionModelTypesFromTrip } from "./tripDockStatePredictionSpecs";
import type { PredictionModelParametersRequest } from "./types";

/**
 * Builds the **`getPredictionModelParameters`** request for the active trip on
 * this update, or **`null`** when the route or phase yields nothing to load.
 *
 * @param tripUpdate - Sparse trip rows for this vessel branch
 * @returns Terminal pair key and model types for the query, or `null` to skip
 *   loading parameters
 */
export const getPredictionModelParametersFromTripUpdate = (
  tripUpdate: VesselTripUpdate
): PredictionModelParametersRequest | null => {
  const active = tripUpdate.activeVesselTrip;
  const pairKey = terminalPairKeyForActiveTrip(active);
  const modelTypes = getPredictionModelTypesFromTrip(active);
  if (pairKey === null || modelTypes.length === 0) {
    return null;
  }
  return { pairKey, modelTypes };
};

/**
 * Canonical terminal-pair string when both endpoints exist on the trip row.
 *
 * @param active - Active vessel trip row carrying departing/arriving abbrevs
 * @returns Canonical pair string, or `null` when the route is incomplete
 */
const terminalPairKeyForActiveTrip = (
  active: ConvexVesselTrip
): string | null => {
  const departing = active.DepartingTerminalAbbrev;
  const arriving = active.ArrivingTerminalAbbrev;
  if (departing === undefined || arriving === undefined) {
    return null;
  }
  return formatTerminalPairKey(departing, arriving);
};
