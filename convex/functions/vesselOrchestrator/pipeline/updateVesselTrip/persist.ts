/**
 * Orchestrator trip writes: optional completion + active, then leave-dock
 * actualization on the last completed leg when needed.
 */

import type { MutationCtx } from "_generated/server";
import {
  currentTripEvents,
  stripVesselTripPredictions,
} from "domain/vesselOrchestration/updateVesselTrip";
import {
  rolloverCompletedAndActiveInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertActiveVesselTrip,
} from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type PerVesselTripPersistInput = {
  vesselAbbrev: string;
  existingActiveTrip?: ConvexVesselTrip;
  activeVesselTrip: ConvexVesselTrip;
  completedVesselTrip?: ConvexVesselTrip;
};

/**
 * @param ctx - Mutation context
 * @param input - Active row and optional completed leg for this branch
 */
export const persistVesselTripWrites = async (
  ctx: MutationCtx,
  input: PerVesselTripPersistInput
): Promise<void> => {
  const activeTrip = stripVesselTripPredictions(input.activeVesselTrip);
  const completedTrip =
    input.completedVesselTrip === undefined
      ? undefined
      : stripVesselTripPredictions(input.completedVesselTrip);

  if (completedTrip !== undefined) {
    await rolloverCompletedAndActiveInDb(ctx, completedTrip, activeTrip);
  } else {
    await upsertActiveVesselTrip(ctx, activeTrip);
  }

  const events = currentTripEvents(input.existingActiveTrip, activeTrip);
  if (!events.didJustLeaveDock || activeTrip.LeftDockActual === undefined) {
    return;
  }

  await setDepartNextActualsForMostRecentCompletedTripInDb(
    ctx,
    input.vesselAbbrev,
    activeTrip.LeftDockActual
  );
};
