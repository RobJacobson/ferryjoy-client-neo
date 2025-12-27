// ============================================================================
// ETA PREDICTION ON NEW TRIP (arrive-arrive-total-duration model)
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { formatTerminalPairKey } from "../../training/shared/config";
import { extractArriveDepartFeatures } from "../step_1_extractFeatures";
import { combinedDurationToEtaPred } from "../step_3_makePrediction";
import { predict } from "./shared";
import type {
  NewTripContext,
  PredictionConfig,
  PredictionResult,
} from "./types";

/**
 * Predict EtaPred when a new trip starts
 * Uses arrive-arrive-total-duration model to predict total arrival time
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
    modelName: "arrive-arrive-total-duration",
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
