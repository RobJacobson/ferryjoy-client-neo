// ============================================================================
// STEP 4: CALCULATE INITIAL PREDICTIONS FOR NEW TRIP
// Called when vessel arrives at dock and a new trip starts
// ============================================================================

import type { ActionCtx, MutationCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { predictEta, predictLeftDock } from "./predictors";

/**
 * Initial predictions result for a new trip
 */
export type InitialPredictions = {
  LeftDockPred: number | undefined;
  LeftDockPredMae: number | undefined;
  EtaPred: number | undefined;
  EtaPredMae: number | undefined;
};

/**
 * Calculate initial predictions for a new trip
 * Runs both LeftDock and ETA predictions in parallel
 *
 * This function is called when a vessel arrives at dock and a new trip starts.
 * It uses the completed trip's data as context for predicting the new trip's
 * departure time and arrival time.
 *
 * @param ctx - Convex action or mutation context
 * @param completedTrip - The trip that just completed
 * @param newTrip - The new trip that just started
 * @returns Initial predictions with MAE margins, or undefined if prediction not possible
 */
export const calculateInitialPredictions = async (
  ctx: ActionCtx | MutationCtx,
  completedTrip: ConvexVesselTrip,
  newTrip: ConvexVesselTrip
): Promise<InitialPredictions> => {
  const [leftDockResult, etaResult] = await Promise.all([
    predictLeftDock(ctx, completedTrip, newTrip),
    predictEta(ctx, completedTrip, newTrip),
  ]);

  return {
    LeftDockPred: leftDockResult.predictedTime,
    LeftDockPredMae: leftDockResult.mae,
    EtaPred: etaResult.predictedTime,
    EtaPredMae: etaResult.mae,
  };
};
