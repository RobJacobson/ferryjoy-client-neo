// ============================================================================
// ETA UPDATE ON DEPARTURE (depart-arrive-atsea-duration model)
// ============================================================================

/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import { extractDepartArriveAtSeaFeatures } from "../../shared/features/extractFeatures";
import { atSeaDurationToEtaPred } from "../predictLinearRegression";
import { predict } from "./shared";
import type {
  DepartureContext,
  PredictionConfig,
  PredictionResult,
} from "./types";

/**
 * Update ETA prediction when vessel departs from dock
 *
 * This function refines the ETA prediction using the depart-arrive-atsea-duration model
 * with the actual time the vessel spent at dock. Called when a vessel leaves dock
 * to provide more accurate arrival time predictions.
 *
 * @param ctx - Convex action or mutation context for database access
 * @param currentTrip - The current trip being executed
 * @param currentLocation - Current vessel location data including actual departure time
 * @returns Updated prediction result with refined ETA timestamp and model accuracy (MAE)
 */
export const predictEtaOnDeparture = async (
  ctx: ActionCtx | MutationCtx,
  currentTrip: ConvexVesselTrip,
  currentLocation: ConvexVesselLocation
): Promise<PredictionResult> => {
  const _predictionContext: DepartureContext = {
    currentTrip,
    currentLocation,
    departingTerminal: currentTrip.DepartingTerminalAbbrev,
    arrivingTerminal: currentTrip.ArrivingTerminalAbbrev || "",
  };

  const config: PredictionConfig<DepartureContext> = {
    modelName: MODEL_TYPES.DEPART_ARRIVE_ATSEA_DURATION,
    skipPrediction: (ctx) =>
      !ctx.currentLocation.LeftDock ||
      !ctx.currentTrip.AtDockDuration ||
      !ctx.currentTrip.Delay ||
      !ctx.currentTrip.ScheduledDeparture,
    extractFeatures: (ctx) => {
      try {
        const features = extractDepartArriveAtSeaFeatures(
          ctx.currentTrip.ScheduledDeparture,
          ctx.currentTrip.AtDockDuration,
          ctx.currentTrip.Delay
        );
        return { features };
      } catch (error) {
        return { features: {}, error: String(error) };
      }
    },
    convertToAbsolute: (predictedDuration, _ctx) => ({
      absoluteTime: atSeaDurationToEtaPred(
        _ctx.currentLocation.LeftDock!,
        predictedDuration
      ),
      referenceTime: _ctx.currentLocation.LeftDock!,
      minimumGap: 2,
    }),
  };

  return predict(ctx, config, _predictionContext);
};
