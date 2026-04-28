/**
 * Vessel-orchestrator trip persistence helpers.
 */

import type { MutationCtx } from "_generated/server";
import {
  currentTripEvents,
  stripVesselTripPredictions,
} from "domain/vesselOrchestration/updateVesselTrip";
import {
  completeAndStartNewTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
  upsertActiveVesselTripInDb,
} from "functions/vesselTrips/mutations";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type PerVesselTripPersistInput = {
  vesselAbbrev: string;
  existingActiveTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
  completedVesselTrip?: ConvexVesselTrip;
};

type TripPersistenceDeps = {
  completeAndStartNewTripInDb: typeof completeAndStartNewTripInDb;
  upsertActiveVesselTripInDb: typeof upsertActiveVesselTripInDb;
  setDepartNextActualsForMostRecentCompletedTripInDb: typeof setDepartNextActualsForMostRecentCompletedTripInDb;
};

const defaultDeps: TripPersistenceDeps = {
  completeAndStartNewTripInDb,
  upsertActiveVesselTripInDb,
  setDepartNextActualsForMostRecentCompletedTripInDb,
};

/**
 * Persists one vessel's trip-table writes for the current ping branch.
 *
 * @param ctx - Convex mutation context for trip lifecycle writes
 * @param input - Existing and updated trip rows for this vessel branch
 * @returns Resolves when trip writes and follow-up intents are applied
 */
export const persistVesselTripWrites = async (
  ctx: MutationCtx,
  input: PerVesselTripPersistInput,
  deps: TripPersistenceDeps = defaultDeps
): Promise<void> => {
  const completedTrip =
    input.completedVesselTrip === undefined
      ? undefined
      : stripVesselTripPredictions(input.completedVesselTrip);
  const activeTrip =
    input.activeVesselTrip === undefined
      ? undefined
      : stripVesselTripPredictions(input.activeVesselTrip);
  if (completedTrip !== undefined && activeTrip !== undefined) {
    await deps.completeAndStartNewTripInDb(ctx, completedTrip, activeTrip);
  } else if (activeTrip !== undefined) {
    await deps.upsertActiveVesselTripInDb(ctx, activeTrip);
  }

  await runLeaveDockFollowUp(
    ctx,
    input.vesselAbbrev,
    input.existingActiveTrip,
    activeTrip,
    deps
  );
};

/**
 * Applies leave-dock follow-up actualization when a branch just left dock.
 *
 * @param ctx - Convex mutation context for completed-trip follow-up updates
 * @param vesselAbbrev - Vessel abbreviation for completed-trip follow-up lookup
 * @param existingActiveTrip - Previously persisted active trip row
 * @param activeVesselTrip - Newly persisted active trip row for this ping
 * @returns Resolves when depart-next actuals are applied, if required
 */
const runLeaveDockFollowUp = async (
  ctx: MutationCtx,
  vesselAbbrev: string,
  existingActiveTrip: ConvexVesselTrip | undefined,
  activeVesselTrip: ConvexVesselTrip | undefined,
  deps: Pick<
    TripPersistenceDeps,
    "setDepartNextActualsForMostRecentCompletedTripInDb"
  >
): Promise<void> => {
  if (activeVesselTrip === undefined) {
    return;
  }
  const events = currentTripEvents(existingActiveTrip, activeVesselTrip);
  if (
    !events.didJustLeaveDock ||
    activeVesselTrip.LeftDockActual === undefined
  ) {
    return;
  }
  await deps.setDepartNextActualsForMostRecentCompletedTripInDb(
    ctx,
    vesselAbbrev,
    activeVesselTrip.LeftDockActual
  );
};
