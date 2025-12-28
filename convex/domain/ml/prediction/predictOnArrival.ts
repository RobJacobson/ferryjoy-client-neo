// ============================================================================
// STEP 4: CALCULATE INITIAL PREDICTIONS FOR NEW TRIP
// Called when vessel arrives at dock and a new trip starts
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { predictDelayOnArrival, predictEtaOnArrival } from "./predictors";
import type { DelayPredictionParams } from "./predictors/types";

/**
 * Initial predictions result for a new trip
 */
export type InitialPredictions = {
  DelayPred: number | undefined;
  DelayPredMae: number | undefined;
  EtaPred: number | undefined;
  EtaPredMae: number | undefined;
};

/**
 * Calculate initial predictions for a new trip
 * Runs both delay and ETA predictions in parallel
 *
 * This function is called when a vessel arrives at dock and a new trip starts.
 * It uses the completed trip's data as context for predicting the new trip's
 * departure delay and arrival time.
 *
 * Only returns successful predictions, throws errors for all failure cases.
 *
 * @param ctx - Convex action or mutation context
 * @param completedTrip - The trip that just completed
 * @param newTrip - The new trip that just started
 * @returns Initial predictions with MAE margins
 */
export const calculateArrivalPredictions = async (
  ctx: ActionCtx | MutationCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: ConvexVesselTrip
): Promise<InitialPredictions> => {
  // Construct prediction parameters for delay prediction
  const delayParams: DelayPredictionParams = {
    scheduledDeparture: newTrip.ScheduledDeparture!,
    departingTerminal: newTrip.DepartingTerminalAbbrev!,
    arrivingTerminal: newTrip.ArrivingTerminalAbbrev!,
    tripStart: newTrip.TripStart!,
    previousDelay: completedTrip.Delay!,
    previousAtSeaDuration: completedTrip.AtSeaDuration!,
    vesselAbbrev: newTrip.VesselAbbrev,
  };

  const [delayResult, etaResult] = await Promise.all([
    predictDelayOnArrival(ctx, delayParams),
    predictEtaOnArrival(ctx, completedTrip, newTrip),
  ]);

  return {
    DelayPred: delayResult.predictedTime, // Delay in minutes
    DelayPredMae: delayResult.mae,
    EtaPred: etaResult.predictedTime, // ETA as absolute timestamp
    EtaPredMae: etaResult.mae,
  };
};
