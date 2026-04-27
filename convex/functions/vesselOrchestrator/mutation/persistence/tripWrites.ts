/**
 * Vessel-orchestrator trip persistence helpers.
 */

import type { MutationCtx } from "_generated/server";
import type {
  ActualDockWriteIntent,
  CompletedArrivalHandoff,
  PredictedDockWriteIntent,
} from "domain/vesselOrchestration/shared";
import { stripTripPredictionsForStorage } from "domain/vesselOrchestration/shared";
import {
  completeAndStartNewTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertActiveVesselTripInDb,
} from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type VesselTripWrites = {
  completedTripWrite?: CompletedArrivalHandoff;
  activeTripUpsert?: ConvexVesselTrip;
  actualDockWrite?: ActualDockWriteIntent;
  predictedDockWrite?: PredictedDockWriteIntent;
};

/**
 * Persists one vessel's trip-table writes for the current ping branch.
 *
 * This function is the mutation-layer adapter between orchestrator write
 * intents and lower-level vessel-trip table mutations. It exists to keep the
 * top-level mutation focused on phase ordering while this helper handles trip
 * lifecycle details and follow-up leave-dock actualization rules. By consuming
 * sparse intents, it avoids unnecessary writes and preserves clear ownership of
 * trip-specific persistence behavior inside the mutation/persistence module.
 *
 * @param ctx - Convex mutation context for trip lifecycle writes
 * @param tripWrites - Sparse trip writes precomputed by action pipeline
 * @returns Resolves when trip writes and follow-up intents are applied
 */
export const persistVesselTripWrites = async (
  ctx: MutationCtx,
  tripWrites: VesselTripWrites
): Promise<void> => {
  const { completedTripWrite, activeTripUpsert, actualDockWrite } = tripWrites;

  if (completedTripWrite !== undefined) {
    await completeAndStartNewTripInDb(
      ctx,
      stripTripPredictionsForStorage(completedTripWrite.tripToComplete),
      stripTripPredictionsForStorage(completedTripWrite.scheduleTrip)
    );
  }

  if (activeTripUpsert !== undefined) {
    await upsertActiveVesselTripInDb(ctx, activeTripUpsert);
  }

  await runLeaveDockFromWriteSetIntent(ctx, actualDockWrite);
};

/**
 * Applies leave-dock follow-up actualization when a branch just left dock.
 *
 * @param ctx - Convex mutation context for completed-trip follow-up updates
 * @param actualDockWrite - Dock intent emitted from trip write construction
 * @returns Resolves when depart-next actuals are applied, if required
 */
const runLeaveDockFromWriteSetIntent = async (
  ctx: MutationCtx,
  actualDockWrite: ActualDockWriteIntent | undefined
): Promise<void> => {
  if (
    actualDockWrite === undefined ||
    !actualDockWrite.events.didJustLeaveDock ||
    actualDockWrite.scheduleTrip.LeftDockActual === undefined
  ) {
    return;
  }
  await setDepartNextActualsForMostRecentCompletedTripInDb(
    ctx,
    actualDockWrite.vesselAbbrev,
    actualDockWrite.scheduleTrip.LeftDockActual
  );
};
