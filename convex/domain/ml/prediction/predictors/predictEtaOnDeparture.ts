// ============================================================================
// ETA UPDATE ON DEPARTURE (depart-arrive-atsea-duration model)
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { extractDepartArriveFeatures } from "../step_1_extractFeatures";
import { atSeaDurationToEtaPred } from "../step_3_makePrediction";
import { predict } from "./shared";
import type {
  DepartureContext,
  PredictionConfig,
  PredictionResult,
} from "./types";

/**
 * Update EtaPred when vessel leaves dock
 * Uses depart-arrive-atsea-duration model with actual at-dock duration
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
    modelName: "depart-arrive-atsea-duration",
    skipPrediction: (ctx) =>
      !ctx.currentLocation.LeftDock ||
      !ctx.currentTrip.AtDockDuration ||
      !ctx.currentTrip.Delay ||
      !ctx.currentTrip.ScheduledDeparture,
    extractFeatures: (ctx) => {
      try {
        const features = extractDepartArriveFeatures(
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
