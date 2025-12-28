// ============================================================================
// ETA PREDICTION ON NEW TRIP (arrive-arrive-total-duration model)
// ============================================================================

/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { formatTerminalPairKey } from "../../shared/core/config";
import { MODEL_TYPES } from "../../shared/core/modelTypes";
import { extractArriveDepartFeatures } from "../../shared/features/extractFeatures";
import { combinedDurationToEtaPred } from "../predictLinearRegression";
import { predict } from "./shared";
import type {
  NewTripContext,
  PredictionConfig,
  PredictionResult,
} from "./types";

/**
 * Predict ETA for a new trip using the arrive-arrive-total-duration model
 *
 * This function predicts the absolute arrival time for a new trip by modeling
 * the total duration from vessel arrival at dock to arrival at the next terminal.
 * Used when a vessel arrives at dock and a new trip is about to start.
 *
 * @param ctx - Convex action or mutation context for database access
 * @param completedTrip - The trip that just completed (provides context for the new trip)
 * @param newTrip - The new trip that is about to start
 * @returns Prediction result with ETA timestamp and model accuracy (MAE)
 */
export const predictEtaOnArrival = async (
  ctx: ActionCtx | MutationCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: ConvexVesselTrip
): Promise<PredictionResult> => {
  const _predictionContext: NewTripContext = {
    completedTrip,
    newTrip,
    departingTerminal: newTrip.DepartingTerminalAbbrev,
    arrivingTerminal: newTrip.ArrivingTerminalAbbrev || "",
  };

  const config: PredictionConfig<NewTripContext> = {
    modelName: MODEL_TYPES.ARRIVE_ARRIVE_TOTAL_DURATION,
    skipPrediction: (_ctx) =>
      !_ctx.completedTrip.Delay ||
      !_ctx.completedTrip.AtSeaDuration ||
      !_ctx.newTrip.TripStart ||
      !_ctx.newTrip.ScheduledDeparture,
    extractFeatures: (_ctx) => {
      const terminalPairKey = formatTerminalPairKey(
        _ctx.departingTerminal,
        _ctx.arrivingTerminal
      );
      try {
        const features = extractArriveDepartFeatures(
          _ctx.newTrip.ScheduledDeparture!,
          _ctx.completedTrip.Delay!,
          _ctx.completedTrip.AtSeaDuration!,
          _ctx.newTrip.TripStart!,
          terminalPairKey
        );
        return { features };
      } catch (error) {
        return { features: {}, error: String(error) };
      }
    },
    convertToAbsolute: (predictedDuration, ctx) => ({
      absoluteTime: combinedDurationToEtaPred(
        ctx.newTrip.TripStart!,
        predictedDuration
      ),
      referenceTime: ctx.newTrip.TripStart!,
      minimumGap: 2,
    }),
  };

  return predict(ctx, config, _predictionContext);
};
