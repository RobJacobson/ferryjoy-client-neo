/**
 * Orchestrator trip writes: optional completion + active upsert only.
 */

import type { MutationCtx } from "_generated/server";
import { stripVesselTripPredictions } from "domain/vesselOrchestration/updateVesselTrip";
import {
  insertCompletedVesselTripInDb,
  upsertActiveVesselTrip,
} from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type PerVesselTripPersistInput = {
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
    await insertCompletedVesselTripInDb(ctx, completedTrip);
    await upsertActiveVesselTrip(ctx, activeTrip);
  } else {
    await upsertActiveVesselTrip(ctx, activeTrip);
  }
};
